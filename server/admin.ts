import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { join } from "node:path";
import {
  UPLOADS_DIR,
  activityStats,
  createActivity,
  createAdminSession,
  deleteActivity,
  deleteAdminSession,
  deviceLabel,
  getActivity,
  getDevice,
  listActivities,
  listDeviceUploads,
  listDevices,
  listUploads,
  now,
  renameDevice,
  updateActivity,
} from "./db";
import { activityDto, uploadDto } from "./dto";
import type { Env } from "./env";
import { zipStream } from "./zip";

import { config } from "./config";

export const ADMIN_PASSWORD = config.adminPassword;
export const ADMIN_COOKIE = "kecy_admin";

export const admin = new Hono<Env>();

admin.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const expected = Buffer.from(ADMIN_PASSWORD);
  const given = Buffer.from(password);
  const ok = expected.length === given.length && crypto.timingSafeEqual(expected, given);
  if (!ok) {
    await Bun.sleep(600); // slow down guessing
    return c.json({ error: "Wrong password" }, 401);
  }
  const token = createAdminSession();
  setCookie(c, ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return c.json({ ok: true });
});

// Everything below requires an admin session.
admin.use("*", async (c, next) => {
  if (!c.get("isAdmin")) return c.json({ error: "Admin login required" }, 401);
  return next();
});

admin.post("/logout", (c) => {
  const token = getCookie(c, ADMIN_COOKIE);
  if (token) deleteAdminSession(token);
  deleteCookie(c, ADMIN_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

admin.get("/state", (c) => {
  const activities = listActivities().map((a) => {
    const stats = activityStats(a.id);
    return {
      ...activityDto(a),
      uploadCount: stats.upload_count,
      deviceCount: stats.device_count,
      totalSize: stats.total_size,
    };
  });
  const devices = listDevices().map((d) => ({
    id: d.id,
    codename: d.codename,
    name: d.name,
    label: deviceLabel(d),
    userAgent: d.user_agent,
    createdAt: d.created_at,
    lastSeen: d.last_seen,
    uploadCount: d.upload_count,
  }));
  return c.json({ serverNow: now(), activities, devices });
});

admin.post("/activities", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return c.json({ error: "Title is required" }, 400);
  const activity = createActivity({
    title: title.slice(0, 200),
    description: typeof body.description === "string" ? body.description.slice(0, 2000) : "",
    deadline: parseDeadline(body.deadline),
    isPublic: body.isPublic === true,
  });
  return c.json({ activity: activityDto(activity) }, 201);
});

admin.patch("/activities/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const patch: Parameters<typeof updateActivity>[1] = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 2000);
  if ("deadline" in body) patch.deadline = parseDeadline(body.deadline);
  if (typeof body.isPublic === "boolean") patch.isPublic = body.isPublic;
  const updated = updateActivity(c.req.param("id"), patch);
  if (!updated) return c.json({ error: "Activity not found" }, 404);
  return c.json({ activity: activityDto(updated) });
});

admin.delete("/activities/:id", (c) => {
  const activity = getActivity(c.req.param("id"));
  if (!activity) return c.json({ error: "Activity not found" }, 404);
  deleteActivity(activity.id);
  return c.json({ ok: true });
});

admin.get("/activities/:id", (c) => {
  const activity = getActivity(c.req.param("id"));
  if (!activity) return c.json({ error: "Activity not found" }, 404);
  return c.json({
    serverNow: now(),
    activity: activityDto(activity),
    uploads: listUploads(activity.id).map(uploadDto),
  });
});

admin.get("/activities/:id/zip", (c) => {
  const activity = getActivity(c.req.param("id"));
  if (!activity) return c.json({ error: "Activity not found" }, 404);

  const uploads = listUploads(activity.id);
  if (uploads.length === 0) return c.json({ error: "No files in this activity yet" }, 404);

  const seen = new Set<string>();
  const entries = uploads.map((u) => {
    const label = sanitizeEntry(deviceLabel({ name: u.device_name, codename: u.codename })) || "device";
    const original = sanitizeEntry(u.original_name) || "file";
    const dot = original.lastIndexOf(".");
    const stem = dot > 0 ? original.slice(0, dot) : original;
    const ext = dot > 0 ? original.slice(dot) : "";
    let candidate = `${label} - ${stem}${ext}`;
    for (let i = 1; seen.has(candidate); i++) {
      candidate = `${label} - ${stem}.${String(i).padStart(3, "0")}${ext}`;
    }
    seen.add(candidate);
    return { entryName: candidate, diskPath: join(UPLOADS_DIR, u.stored_path) };
  });

  const zipName = (sanitizeEntry(activity.title) || "activity").replace(/\s+/g, "_");
  return new Response(zipStream(entries), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}.zip`,
    },
  });
});

admin.get("/devices/:id", (c) => {
  const device = getDevice(c.req.param("id"));
  if (!device) return c.json({ error: "Device not found" }, 404);
  return c.json({
    serverNow: now(),
    device: {
      id: device.id,
      codename: device.codename,
      name: device.name,
      label: deviceLabel(device),
      userAgent: device.user_agent,
      createdAt: device.created_at,
      lastSeen: device.last_seen,
    },
    uploads: listDeviceUploads(device.id).map((u) => ({ ...uploadDto(u), activityTitle: u.activity_title })),
  });
});

admin.patch("/devices/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const ok = renameDevice(c.req.param("id"), name || null);
  if (!ok) return c.json({ error: "Device not found" }, 404);
  return c.json({ ok: true });
});

function parseDeadline(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

function sanitizeEntry(name: string): string {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim();
}
