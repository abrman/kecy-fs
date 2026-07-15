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
    maxUploadMb: MAX_UPLOAD_MB,
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

// The file arrives as the raw request body (one file per request), with the
// name in the `filename` query param. Never parse uploads with formData():
// it buffers the whole body in RAM and Bun's multipart parser corrupts
// bodies over 4 GiB (oven-sh/bun#21490).
api.post("/activities/:id/uploads", async (c) => {
  const activity = getActivity(c.req.param("id"));
  if (!activity) return c.json({ error: "Activity not found" }, 404);
  if (isLocked(activity)) return c.json({ error: "This activity is closed — the deadline has passed." }, 403);

  if ((c.req.header("content-type") ?? "").includes("multipart/form-data")) {
    return c.json({ error: "This page is out of date — refresh and try again." }, 400);
  }

  const name = (c.req.query("filename") ?? "").trim();
  if (!name) return c.json({ error: "No files received" }, 400);

  const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
  const tooBig = () => c.json({ error: `"${name}" is too big (limit is ${MAX_UPLOAD_MB} MB per file).` }, 413);
  const declaredSize = Number(c.req.header("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) return tooBig();

  const body = c.req.raw.body;
  if (!body) return c.json({ error: "No files received" }, 400);

  mkdirSync(join(UPLOADS_DIR, activity.id), { recursive: true });

  const id = crypto.randomUUID();
  const rawExt = extname(name).slice(1);
  const ext = SAFE_EXT.test(rawExt) ? `.${rawExt.toLowerCase()}` : "";
  const storedPath = `${activity.id}/${id}${ext}`;
  const absPath = join(UPLOADS_DIR, storedPath);

  const sink = Bun.file(absPath).writer();
  let size = 0;
  let oversized = false;
  try {
    // Bun's ReadableStream is async-iterable at runtime; the DOM lib types don't know that.
    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength;
      if (size > maxBytes) {
        oversized = true;
        break;
      }
      sink.write(chunk);
      await sink.flush();
    }
    await sink.end();
  } catch {
    await Promise.resolve(sink.end()).catch(() => {});
    await unlink(absPath).catch(() => {});
    return c.json({ error: "Upload failed — connection interrupted." }, 400);
  }
  if (oversized || size === 0) {
    await unlink(absPath).catch(() => {});
    return oversized ? tooBig() : c.json({ error: "No files received" }, 400);
  }

  const row: UploadRow = {
    id,
    activity_id: activity.id,
    device_id: c.get("deviceId"),
    original_name: name.slice(0, 300),
    stored_path: storedPath,
    mime: c.req.header("content-type") || "application/octet-stream",
    size,
    created_at: now(),
  };
  insertUpload(row);

  const mine = listUploads(activity.id, c.get("deviceId")).map(uploadDto);
  return c.json({ ok: true, createdCount: 1, myUploads: mine }, 201);
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
