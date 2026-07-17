import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { extname, join } from "node:path";
import { admin, ADMIN_COOKIE } from "./admin";
import { api, MAX_UPLOAD_MB } from "./api";
import { config } from "./config";
import { DATA_DIR, createDevice, getDevice, isAdminToken, touchDevice } from "./db";
import { distFiles } from "./dist-manifest";
import type { Env } from "./env";

const DEVICE_COOKIE = "kecy_device";
const CLIENT_DIST = join(import.meta.dir, "..", "client", "dist");

const app = new Hono<Env>();

// Identify (or register) the device on every API request.
app.use("/api/*", async (c, next) => {
  const cookieId = getCookie(c, DEVICE_COOKIE);
  let device = cookieId ? getDevice(cookieId) : null;
  if (!device) {
    device = createDevice(c.req.header("user-agent") ?? "");
    setCookie(c, DEVICE_COOKIE, device.id, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 60, // 60 days — comfortably outlasts the camp week
    });
  } else {
    touchDevice(device.id);
  }
  c.set("deviceId", device.id);
  c.set("isAdmin", isAdminToken(getCookie(c, ADMIN_COOKIE)));
  return next();
});

app.route("/api/admin", admin);
app.route("/api", api);

// Serve the built client: embedded files when compiled into an executable,
// otherwise client/dist from disk (run `bun run build` first).
const MIME: Record<string, string> = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain;charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

async function staticFile(pathname: string): Promise<Response | null> {
  const embedded = distFiles[pathname];
  let file = embedded ? Bun.file(embedded) : null;
  if (!file || !(await file.exists())) {
    file = Bun.file(join(CLIENT_DIST, pathname));
    if (!(await file.exists())) return null;
  }
  const immutable = pathname.startsWith("/assets/");
  return new Response(file, {
    headers: {
      "Content-Type": MIME[extname(pathname).toLowerCase()] ?? file.type,
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    },
  });
}

app.get("*", async (c) => {
  let pathname = decodeURIComponent(new URL(c.req.url).pathname);
  if (pathname.includes("..")) return c.text("Bad request", 400);
  if (pathname.endsWith("/")) pathname += "index.html";

  // Fall back to index.html for SPA routes like /admin or /a/:id.
  const res = (await staticFile(pathname)) ?? (await staticFile("/index.html"));
  if (!res) return c.text("KECY file server: client build not found. Run `bun run build` first.", 503);
  return res;
});

const port = config.port;

Bun.serve({
  port,
  hostname: "0.0.0.0",
  idleTimeout: 240,
  maxRequestBodySize: (MAX_UPLOAD_MB + 32) * 1024 * 1024,
  fetch: app.fetch,
});

// Browsers try https:// first when someone types a bare domain name. With
// nothing listening on 443 the OS firewall usually swallows the attempt, so
// the browser hangs on "page isn't loading" instead of falling back to http.
// Closing 443 connections immediately turns that hang into an instant
// network error, which makes browsers retry over plain http right away.
if (port === 80) {
  try {
    Bun.listen({
      hostname: "0.0.0.0",
      port: 443,
      socket: {
        open(socket) {
          socket.end();
        },
        data() {},
        error() {},
      },
    });
    console.log("Rejecting https:// on port 443 so browsers fall back to http instantly.");
  } catch {
    console.warn(
      "Could not claim port 443 — browsers that try https:// first may hang before falling back to http.",
    );
  }
}

console.log(`KECY file server listening on http://0.0.0.0:${port}`);
console.log(`Data directory: ${DATA_DIR}`);
if (config.usingDefaultPassword) {
  console.warn(
    `NOTE: using default admin password '${config.adminPassword}'. Change it with --admin-password or the ADMIN_PASSWORD env variable.`,
  );
}
