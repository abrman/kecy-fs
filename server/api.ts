import { Hono } from "hono";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  UPLOADS_DIR,
  type UploadRow,
  countMyUploads,
  deleteUploadRow,
  getActivity,
  getDevice,
  getUpload,
  deviceLabel,
  insertUpload,
  isLocked,
  listActivities,
  listUploads,
  now,
} from "./db";
import { activityDto, uploadDto } from "./dto";
import type { Env } from "./env";

import { config } from "./config";

export const MAX_UPLOAD_MB = config.maxUploadMb;

export const api = new Hono<Env>();

api.get("/me", (c) => {
  const device = getDevice(c.get("deviceId"))!;
  return c.json({
    deviceId: device.id,
    codename: device.codename,
    name: device.name,
    label: deviceLabel(device),
    isAdmin: c.get("isAdmin"),
    serverNow: now(),
  });
});

api.get("/activities", (c) => {
  const deviceId = c.get("deviceId");
  const activities = listActivities().map((a) => ({
    ...activityDto(a),
    myCount: countMyUploads(a.id, deviceId),
  }));
  return c.json({ serverNow: now(), activities });
});

api.get("/activities/:id", (c) => {
  const activity = getActivity(c.req.param("id"));
  if (!activity) return c.json({ error: "Activity not found" }, 404);
  const deviceId = c.get("deviceId");
  const myUploads = listUploads(activity.id, deviceId).map(uploadDto);
  const allUploads = activity.is_public === 1 ? listUploads(activity.id).map(uploadDto) : null;
  return c.json({ serverNow: now(), activity: activityDto(activity), myUploads, allUploads });
});

const SAFE_EXT = /^[a-z0-9]{1,10}$/i;

api.post("/activities/:id/uploads", async (c) => {
  const activity = getActivity(c.req.param("id"));
  if (!activity) return c.json({ error: "Activity not found" }, 404);
  if (isLocked(activity)) return c.json({ error: "This activity is closed — the deadline has passed." }, 403);

  const form = await c.req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return c.json({ error: "No files received" }, 400);

  const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
  for (const f of files) {
    if (f.size > maxBytes) {
      return c.json({ error: `"${f.name}" is too big (limit is ${MAX_UPLOAD_MB} MB per file).` }, 413);
    }
  }

  const dir = join(UPLOADS_DIR, activity.id);
  mkdirSync(dir, { recursive: true });

  const created: UploadRow[] = [];
  for (const f of files) {
    const id = crypto.randomUUID();
    const rawExt = extname(f.name).slice(1);
    const ext = SAFE_EXT.test(rawExt) ? `.${rawExt.toLowerCase()}` : "";
    const storedPath = `${activity.id}/${id}${ext}`;
    await Bun.write(join(UPLOADS_DIR, storedPath), f);
    const row: UploadRow = {
      id,
      activity_id: activity.id,
      device_id: c.get("deviceId"),
      original_name: f.name.slice(0, 300) || `file${ext}`,
      stored_path: storedPath,
      mime: f.type || "application/octet-stream",
      size: f.size,
      created_at: now(),
    };
    insertUpload(row);
    created.push(row);
  }

  const mine = listUploads(activity.id, c.get("deviceId")).map(uploadDto);
  return c.json({ ok: true, createdCount: created.length, myUploads: mine }, 201);
});

api.delete("/uploads/:id", async (c) => {
  const upload = getUpload(c.req.param("id"));
  if (!upload) return c.json({ error: "File not found" }, 404);

  const isAdmin = c.get("isAdmin");
  if (!isAdmin) {
    if (upload.device_id !== c.get("deviceId")) return c.json({ error: "This is not your file" }, 403);
    const activity = getActivity(upload.activity_id)!;
    if (isLocked(activity)) {
      return c.json({ error: "This activity is closed — files can no longer be deleted." }, 403);
    }
  }

  deleteUploadRow(upload.id);
  await unlink(join(UPLOADS_DIR, upload.stored_path)).catch(() => {});
  return c.json({ ok: true });
});

api.get("/uploads/:id/file", async (c) => {
  const upload = getUpload(c.req.param("id"));
  if (!upload) return c.json({ error: "File not found" }, 404);

  const isOwner = upload.device_id === c.get("deviceId");
  if (!isOwner && !c.get("isAdmin")) {
    const activity = getActivity(upload.activity_id);
    if (!activity || activity.is_public !== 1) return c.json({ error: "This file is not public" }, 403);
  }

  const file = Bun.file(join(UPLOADS_DIR, upload.stored_path));
  if (!(await file.exists())) return c.json({ error: "File missing on disk" }, 404);

  const asDownload = c.req.query("download") === "1";
  const encoded = encodeURIComponent(upload.original_name).replace(/'/g, "%27");
  const headers: Record<string, string> = {
    "Content-Type": upload.mime,
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`,
    "Cache-Control": "private, max-age=3600",
  };

  // Range support so <video> seeking works
  const range = c.req.header("range");
  const size = file.size;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && (m[1] !== "" || m[2] !== "")) {
      let start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
      let end = m[1] !== "" && m[2] !== "" ? Number(m[2]) : size - 1;
      end = Math.min(end, size - 1);
      if (start <= end && start < size) {
        headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
        headers["Content-Length"] = String(end - start + 1);
        return new Response(file.slice(start, end + 1), { status: 206, headers });
      }
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
  }

  headers["Content-Length"] = String(size);
  return new Response(file, { headers });
});
