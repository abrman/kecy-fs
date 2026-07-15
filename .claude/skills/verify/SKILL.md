---
name: verify
description: Build/launch/drive recipe for verifying kecy-fs changes end-to-end.
---

# Verifying kecy-fs

Bun + Hono server with a React SPA. The API is fully drivable with curl; the
built client is only needed for UI-level checks.

## Launch

```sh
bun server/index.ts --port 3777 --data-dir <scratch>/data --max-upload-mb 10000
```

Use a scratch `--data-dir` so the real `./data` is untouched. A second instance
with a tiny `--max-upload-mb` is the easy way to exercise size-limit paths.

## Drive

- Device identity is automatic: pass a curl cookie jar (`-c dev.txt -b dev.txt`)
  and the server creates a device on first request.
- Admin: `POST /api/admin/login` with `{"password":"KECYisHOME"}` (default),
  keep the cookie; create an activity with
  `POST /api/admin/activities` `{"title":"..."}`.
- Upload protocol (raw body, NOT multipart — multipart is rejected on purpose):
  `curl -b dev.txt -X POST "/api/activities/<id>/uploads?filename=<enc>" -H "Content-Type: <mime>" -T file`
  Use `-T` (streams), not `--data-binary` (buffers the whole file in RAM).
- Download back: `GET /api/uploads/<id>/file?download=1`.
- Admin ZIP of an activity: `GET /api/admin/activities/<id>/zip`.

## Gotchas

- `bun run typecheck` fails on pre-existing `server/dist-manifest.ts` errors
  when `client/dist` hashes are stale; rebuild with `bun run build` or ignore.
- For >4 GiB upload tests, create the file instantly with
  `fsutil file createnew big.bin 4831838208`, then write ASCII markers at
  offset 0, 4294967288 (straddles 2^32), and EOF-16 via a .NET FileStream;
  compare size + markers + MD5 of the stored file under
  `<data-dir>/uploads/<activityId>/`.
- Watch `bun` working-set memory during big uploads to confirm streaming
  (should stay ~200 MB, not grow with the file).
