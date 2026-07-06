# KECY file server ⛺

A small file server for camp activities that runs on one computer and works for
everyone on the same wifi. Campers upload memes/photos/videos into activities, only
see their own files, and can delete them until the activity's deadline. Leaders
manage activities in an admin page, put names on devices, browse everything and
download a whole activity as a ZIP. When an activity is switched to **public**,
everyone can browse and download the full gallery.

## Getting started

You don't need to install anything — the app is a single file. Follow the steps for
your computer.

### 1. Pick the right file

The ready-made apps are in the `dist-zip` folder:

| Your computer | File |
| --- | --- |
| Windows | `kecy-server-win-x64.zip` |
| Mac from 2020 or newer (Apple Silicon / M-chips) | `kecy-server-mac-arm64.zip` |
| Older Mac (Intel) | `kecy-server-mac-x64.zip` |

### 2. Unzip it into its own folder

For example `Documents\kecy-camp`. On Windows: right-click the ZIP → **Extract
All…**. On a Mac: double-click the ZIP.

This folder matters: **everything campers upload is saved into a `data` folder that
appears right next to the app** the first time you start it. Keep the app in that
folder all week, and to back everything up just copy the `data` folder.

### 3. Open a terminal in that folder

- **Windows:** open the folder in File Explorer, click into the address bar at the
  top, type `cmd` and press Enter. A black window opens, already "inside" your folder.
- **Mac:** open the **Terminal** app (Cmd+Space, type "Terminal"), type `cd ` (with a
  space), drag your folder from Finder into the Terminal window, and press Enter.

### 4. Start the server

**Windows** — type this and press Enter (choose your own password):

```
kecy-server-win-x64.exe --admin-password MySecretPassword
```

If Windows shows a firewall popup, click **Allow** — otherwise phones won't be able
to connect. If there is no popup and phones can't reach the server, allow the app in
Windows Security → Firewall, or see the developer section below for a command.

**Mac** — the first time, run these three lines (the first two make the app
runnable, since it's not from the App Store):

```
chmod +x kecy-server-mac-arm64
xattr -d com.apple.quarantine kecy-server-mac-arm64
./kecy-server-mac-arm64 --admin-password MySecretPassword
```

(For an Intel Mac use `kecy-server-mac-x64` in all three lines.)

When you see `KECY file server listening on http://0.0.0.0:3000`, it's running.
Leave the window open — closing it (or pressing Ctrl+C) stops the server.

### 5. Open it from phones and other devices

You don't need any DNS setup — devices on the same wifi can connect straight to
your computer's IP address:

1. Find your computer's address on the wifi:
   - **Windows:** in the terminal, type `ipconfig` and look for **IPv4 Address**
     (something like `192.168.1.42`).
   - **Mac:** System Settings → Wi-Fi → **Details…** next to your network → IP address.
2. On the campers' devices, open a browser and go to `http://` + that address +
   `:3000`, for example: **`http://192.168.1.42:3000`**

On the computer running the server you can just open **http://localhost:3000**.

The admin page is at **`/admin`** (e.g. `http://192.168.1.42:3000/admin`) — log in
with the password you chose in step 4. If you didn't choose one, the default is
`KECYisHOME`.

**Optional — drop the `:3000`:** start the server with `--port 80` and addresses
become just `http://192.168.1.42`. Port 80 is protected by the system, so the
terminal must be elevated: on Windows right-click Start → **Terminal (Admin)** and
`cd` to your folder first; on a Mac put `sudo ` in front of the start command. If
your router or a local DNS server lets you give the computer a friendly name, that
name will work too — but the plain IP address is always enough.

---

## For developers

**Stack:** Bun + Hono, SQLite (`bun:sqlite`), files stored on disk, `fflate` for
streamed ZIPs. Client: Vite + React + Tailwind v4 + lucide icons.

### Running from source

```powershell
bun install
bun run dev            # bun server on :3000 + vite dev server on :5173 (proxies /api)

bun run build          # build the client into client/dist
bun run start          # serve client + API from the bun server
```

### Building the standalone executables

```powershell
bun run build:exe        # this platform only -> dist-bin/kecy-server.exe
bun run build:exe:all    # Windows x64 + macOS ARM + macOS Intel -> dist-bin/
```

The built web client is embedded into the binary (`scripts/embed-dist.ts` generates
`server/dist-manifest.ts`), so a single file is all you need to distribute. Cross-
compilation works from any platform. The macOS binaries are unsigned — hence the
`xattr -d com.apple.quarantine` step above.

### Configuration

CLI flag beats env var beats default:

| Flag | Env var | Default | Meaning |
| --- | --- | --- | --- |
| `--admin-password` | `ADMIN_PASSWORD` | `KECYisHOME` | Password for the admin UI at `/admin` |
| `--port` | `PORT` | `3000` | HTTP port |
| `--data-dir` | `DATA_DIR` | `./data` | Where the SQLite DB and uploaded files live |
| `--max-upload-mb` | `MAX_UPLOAD_MB` | `500` | Per-file upload limit |

Note: the default `./data` is relative to the directory the server is *started
from* — which is why the beginner steps open the terminal in the app's folder.

Windows Firewall rule (if the allow popup never appeared):

```powershell
New-NetFirewallRule -DisplayName "KECY" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

### How it works

- **Device identity** — first visit sets a `kecy_device` httpOnly cookie (UUID, 60 days)
  and the device gets a codename like `brave-otter-42`, shown in the top-right corner
  of the camper's screen. In **Admin → Devices** you can attach a real name ("ask the
  kid what their codename is"). Caveat: clearing cookies / private-browsing windows
  create a brand-new device.
- **Deadlines** are enforced server-side against the server clock, so changing a
  phone's clock doesn't help. After the deadline campers can't upload or delete;
  admins can still delete anything at any time.
- **Privacy** — campers only ever see and download their own uploads. Once an activity
  is set to *public* (Admin → edit → "Public gallery"), everyone can browse and
  download all of its files.
- **ZIP export** — Admin → activity → "Download all as ZIP" streams a flat ZIP where
  each file is named `<device label> - <original name>` (name clashes get a `.001`,
  `.002`, … suffix before the extension).

### Data & backup

Everything lives in `data/`: `kecy.sqlite` (metadata, devices, admin sessions) and
`uploads/<activityId>/` (the files). To back up mid-camp, just copy the `data`
folder. Deleting an activity in the admin UI deletes its files from disk too.
