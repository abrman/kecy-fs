import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { config } from "./config";

export const DATA_DIR = config.dataDir;
export const UPLOADS_DIR = join(DATA_DIR, "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(join(DATA_DIR, "kecy.sqlite"), { create: true });

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  codename TEXT NOT NULL,
  name TEXT,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  deadline TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id),
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_uploads_activity ON uploads(activity_id);
CREATE INDEX IF NOT EXISTS idx_uploads_device ON uploads(device_id);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
`);

export interface DeviceRow {
  id: string;
  codename: string;
  name: string | null;
  user_agent: string;
  created_at: string;
  last_seen: string;
}

export interface ActivityRow {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  is_public: number;
  created_at: string;
}

export interface UploadRow {
  id: string;
  activity_id: string;
  device_id: string;
  original_name: string;
  stored_path: string;
  mime: string;
  size: number;
  created_at: string;
}

export const now = () => new Date().toISOString();

export function isLocked(activity: ActivityRow): boolean {
  return activity.deadline !== null && Date.now() > Date.parse(activity.deadline);
}

export function deviceLabel(d: Pick<DeviceRow, "name" | "codename">): string {
  return d.name?.trim() || d.codename;
}

// ---------- devices ----------

const ADJECTIVES = [
  "brave", "swift", "sunny", "fuzzy", "mighty", "sneaky", "happy", "wild",
  "cosmic", "sparkly", "turbo", "gentle", "loud", "silent", "golden", "neon",
  "spicy", "frosty", "dizzy", "epic", "lucky", "rapid", "royal", "shiny",
  "bouncy", "crafty", "daring", "electric", "fluffy", "groovy", "jolly", "zesty",
];
const ANIMALS = [
  "otter", "falcon", "panda", "tiger", "koala", "wolf", "fox", "eagle",
  "dolphin", "lynx", "badger", "rabbit", "moose", "owl", "penguin", "gecko",
  "hedgehog", "raccoon", "walrus", "beaver", "puma", "heron", "bison", "ferret",
  "marmot", "toucan", "iguana", "stork", "weasel", "yak", "ibex", "quokka",
];

function makeCodename(): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  for (let i = 0; i < 50; i++) {
    const c = `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${Math.floor(Math.random() * 90) + 10}`;
    const taken = db.query("SELECT 1 FROM devices WHERE codename = ?").get(c);
    if (!taken) return c;
  }
  return `device-${crypto.randomUUID().slice(0, 8)}`;
}

export function getDevice(id: string): DeviceRow | null {
  return db.query("SELECT * FROM devices WHERE id = ?").get(id) as DeviceRow | null;
}

export function createDevice(userAgent: string): DeviceRow {
  const device: DeviceRow = {
    id: crypto.randomUUID(),
    codename: makeCodename(),
    name: null,
    user_agent: userAgent.slice(0, 400),
    created_at: now(),
    last_seen: now(),
  };
  db.query(
    "INSERT INTO devices (id, codename, name, user_agent, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(device.id, device.codename, device.name, device.user_agent, device.created_at, device.last_seen);
  return device;
}

export function touchDevice(id: string): void {
  db.query("UPDATE devices SET last_seen = ? WHERE id = ?").run(now(), id);
}

export function renameDevice(id: string, name: string | null): boolean {
  const res = db.query("UPDATE devices SET name = ? WHERE id = ?").run(name, id);
  return res.changes > 0;
}

export function listDevices(): (DeviceRow & { upload_count: number })[] {
  return db
    .query(
      `SELECT d.*, (SELECT COUNT(*) FROM uploads u WHERE u.device_id = d.id) AS upload_count
       FROM devices d
       WHERE EXISTS (SELECT 1 FROM uploads u WHERE u.device_id = d.id)
       ORDER BY d.last_seen DESC`,
    )
    .all() as (DeviceRow & { upload_count: number })[];
}

// ---------- activities ----------

export function createActivity(a: { title: string; description: string; deadline: string | null; isPublic: boolean }): ActivityRow {
  const row: ActivityRow = {
    id: crypto.randomUUID(),
    title: a.title,
    description: a.description,
    deadline: a.deadline,
    is_public: a.isPublic ? 1 : 0,
    created_at: now(),
  };
  db.query(
    "INSERT INTO activities (id, title, description, deadline, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(row.id, row.title, row.description, row.deadline, row.is_public, row.created_at);
  return row;
}

export function getActivity(id: string): ActivityRow | null {
  return db.query("SELECT * FROM activities WHERE id = ?").get(id) as ActivityRow | null;
}

export function listActivities(): ActivityRow[] {
  return db.query("SELECT * FROM activities ORDER BY created_at DESC").all() as ActivityRow[];
}

export function updateActivity(
  id: string,
  patch: { title?: string; description?: string; deadline?: string | null; isPublic?: boolean },
): ActivityRow | null {
  const current = getActivity(id);
  if (!current) return null;
  const next = {
    title: patch.title ?? current.title,
    description: patch.description ?? current.description,
    deadline: patch.deadline === undefined ? current.deadline : patch.deadline,
    is_public: patch.isPublic === undefined ? current.is_public : patch.isPublic ? 1 : 0,
  };
  db.query("UPDATE activities SET title = ?, description = ?, deadline = ?, is_public = ? WHERE id = ?").run(
    next.title, next.description, next.deadline, next.is_public, id,
  );
  return getActivity(id);
}

export function deleteActivity(id: string): void {
  db.query("DELETE FROM activities WHERE id = ?").run(id);
  rmSync(join(UPLOADS_DIR, id), { recursive: true, force: true });
}

export function activityStats(id: string): { upload_count: number; device_count: number; total_size: number } {
  return db
    .query(
      `SELECT COUNT(*) AS upload_count, COUNT(DISTINCT device_id) AS device_count, COALESCE(SUM(size), 0) AS total_size
       FROM uploads WHERE activity_id = ?`,
    )
    .get(id) as { upload_count: number; device_count: number; total_size: number };
}

// ---------- uploads ----------

export type UploadWithDevice = UploadRow & { codename: string; device_name: string | null };

export function insertUpload(u: UploadRow): void {
  db.query(
    "INSERT INTO uploads (id, activity_id, device_id, original_name, stored_path, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(u.id, u.activity_id, u.device_id, u.original_name, u.stored_path, u.mime, u.size, u.created_at);
}

export function getUpload(id: string): UploadRow | null {
  return db.query("SELECT * FROM uploads WHERE id = ?").get(id) as UploadRow | null;
}

export function deleteUploadRow(id: string): void {
  db.query("DELETE FROM uploads WHERE id = ?").run(id);
}

export function listUploads(activityId: string, deviceId?: string): UploadWithDevice[] {
  if (deviceId) {
    return db
      .query(
        `SELECT u.*, d.codename, d.name AS device_name FROM uploads u JOIN devices d ON d.id = u.device_id
         WHERE u.activity_id = ? AND u.device_id = ? ORDER BY u.created_at DESC`,
      )
      .all(activityId, deviceId) as UploadWithDevice[];
  }
  return db
    .query(
      `SELECT u.*, d.codename, d.name AS device_name FROM uploads u JOIN devices d ON d.id = u.device_id
       WHERE u.activity_id = ? ORDER BY d.codename, u.created_at DESC`,
    )
    .all(activityId) as UploadWithDevice[];
}

export type DeviceUpload = UploadWithDevice & { activity_title: string };

export function listDeviceUploads(deviceId: string): DeviceUpload[] {
  return db
    .query(
      `SELECT u.*, d.codename, d.name AS device_name, a.title AS activity_title
       FROM uploads u
       JOIN devices d ON d.id = u.device_id
       JOIN activities a ON a.id = u.activity_id
       WHERE u.device_id = ?
       ORDER BY a.created_at DESC, u.created_at DESC`,
    )
    .all(deviceId) as DeviceUpload[];
}

export function countMyUploads(activityId: string, deviceId: string): number {
  const r = db
    .query("SELECT COUNT(*) AS c FROM uploads WHERE activity_id = ? AND device_id = ?")
    .get(activityId, deviceId) as { c: number };
  return r.c;
}

// ---------- admin sessions ----------

export function createAdminSession(): string {
  const token = crypto.randomUUID() + crypto.randomUUID();
  db.query("INSERT INTO admin_sessions (token, created_at) VALUES (?, ?)").run(token, now());
  return token;
}

export function isAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  return !!db.query("SELECT 1 FROM admin_sessions WHERE token = ?").get(token);
}

export function deleteAdminSession(token: string): void {
  db.query("DELETE FROM admin_sessions WHERE token = ?").run(token);
}
