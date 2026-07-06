import { join } from "node:path";

// CLI flag > env variable > default.
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`KECY file server ⛺

Usage: kecy-server [options]

Options:
  --port <n>              Port to listen on (default: env PORT or 3000)
                          Port 80 needs an elevated terminal on Windows / sudo on macOS.
  --admin-password <pw>   Password for the admin UI (default: env ADMIN_PASSWORD or KECYisHOME)
  --data-dir <path>       Where the database and uploads live (default: env DATA_DIR or ./data)
  --max-upload-mb <n>     Per-file upload limit in MB (default: env MAX_UPLOAD_MB or 500)
  -h, --help              Show this help
`);
  process.exit(0);
}

const port = Number(flag("port") ?? process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${flag("port") ?? process.env.PORT}`);
  process.exit(1);
}

const maxUploadMb = Number(flag("max-upload-mb") ?? process.env.MAX_UPLOAD_MB ?? 500);
if (!Number.isFinite(maxUploadMb) || maxUploadMb <= 0) {
  console.error(`Invalid max upload size: ${flag("max-upload-mb") ?? process.env.MAX_UPLOAD_MB}`);
  process.exit(1);
}

export const config = {
  port,
  maxUploadMb,
  adminPassword: flag("admin-password") ?? process.env.ADMIN_PASSWORD ?? "KECYisHOME",
  usingDefaultPassword: flag("admin-password") === undefined && !process.env.ADMIN_PASSWORD,
  dataDir: flag("data-dir") ?? process.env.DATA_DIR ?? join(process.cwd(), "data"),
};
