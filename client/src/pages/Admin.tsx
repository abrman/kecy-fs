import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronRight,
  FolderDown,
  HardDrive,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";
import { api, ApiError, type Activity, type DeviceInfo } from "../lib/api";
import { formatBytes, formatDateTime } from "../lib/format";
import { useNow } from "../lib/useNow";
import { ActivityDialog } from "../components/ActivityDialog";
import { DeadlineChip, PublicChip } from "../components/StatusChips";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";

interface AdminState {
  activities: Activity[];
  devices: DeviceInfo[];
}

export function Admin() {
  const [state, setState] = useState<AdminState | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"activities" | "devices">("activities");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const nowMs = useNow(5000);

  const refresh = useCallback(() => {
    api<AdminState>("/api/admin/state")
      .then((s) => {
        setState(s);
        setNeedsLogin(false);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setNeedsLogin(true);
        else setError(e.message);
      });
  }, []);

  useEffect(refresh, [refresh]);

  if (error) return <p className="py-12 text-center text-red-600">{error}</p>;
  if (needsLogin) return <Login onSuccess={refresh} />;
  if (!state) return <Spinner />;

  async function deleteActivity(a: Activity) {
    if (!window.confirm(`Delete "${a.title}" and ALL ${a.uploadCount ?? 0} uploaded files? This cannot be undone.`))
      return;
    await api(`/api/admin/activities/${a.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    refresh();
  }

  async function logout() {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    setNeedsLogin(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-amber-500" /> Admin
        </h1>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </div>

      <div className="flex gap-1 rounded-xl bg-zinc-200/70 p-1 text-sm font-semibold">
        {(["activities", "devices"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-1.5 capitalize transition ${
              tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t} {t === "devices" && `(${state.devices.length})`}
          </button>
        ))}
      </div>

      {tab === "activities" ? (
        <div className="space-y-3">
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> New activity
          </Button>
          {state.activities.length === 0 && (
            <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              No activities yet — create the first one!
            </p>
          )}
          {state.activities.map((a) => (
            <div key={a.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/admin/a/${a.id}`} className="font-bold text-zinc-900 hover:text-amber-700">
                  {a.title}
                </Link>
                <DeadlineChip activity={a} nowMs={nowMs} />
                <PublicChip activity={a} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  {a.uploadCount} files · {formatBytes(a.totalSize ?? 0)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {a.deviceCount} devices
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/admin/a/${a.id}`}>
                  <Button variant="secondary" size="sm" tabIndex={-1}>
                    View files
                  </Button>
                </Link>
                {(a.uploadCount ?? 0) > 0 && (
                  <a href={`/api/admin/activities/${a.id}/zip`}>
                    <Button variant="secondary" size="sm" tabIndex={-1}>
                      <FolderDown className="h-4 w-4" /> ZIP
                    </Button>
                  </a>
                )}
                <Button variant="secondary" size="sm" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="dangerGhost" size="sm" onClick={() => deleteActivity(a)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DevicesTable devices={state.devices} onChanged={refresh} />
      )}

      <ActivityDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={refresh}
        activity={editing}
      />
    </div>
  );
}

function DevicesTable({ devices, onChanged }: { devices: DeviceInfo[]; onChanged: () => void }) {
  if (devices.length === 0) {
    return (
      <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
        No devices have connected yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">
        Give devices real names — campers see their codename in the top-right corner of their screen, so just ask
        "who is <em>{devices[0]?.codename}</em>?"
      </p>
      {devices.map((d) => (
        <DeviceRow key={d.id} device={d} onChanged={onChanged} />
      ))}
    </div>
  );
}

function DeviceRow({ device, onChanged }: { device: DeviceInfo; onChanged: () => void }) {
  const [name, setName] = useState(device.name ?? "");
  const [saved, setSaved] = useState(false);
  const dirty = name.trim() !== (device.name ?? "");

  async function save() {
    if (!dirty) return;
    await api(`/api/admin/devices/${device.id}`, { method: "PATCH", body: { name } });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChanged();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <Smartphone className="h-5 w-5 shrink-0 text-zinc-400" />
      <Link to={`/admin/d/${device.id}`} className="group min-w-0 flex-1" title="View this device's uploads">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="amber" className="group-hover:bg-amber-200">{device.codename}</Badge>
          <span className="text-xs text-zinc-400">
            {device.uploadCount} uploads · last seen {formatDateTime(device.lastSeen)}
          </span>
          <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-amber-500" />
        </div>
        <p className="mt-0.5 truncate text-xs text-zinc-400" title={device.userAgent}>
          {device.userAgent || "unknown browser"}
        </p>
      </Link>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          placeholder="Camper's name…"
          className="w-44"
        />
        {saved && <Check className="h-4 w-4 text-emerald-600" />}
      </form>
    </div>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/login", { method: "POST", body: { password } });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <KeyRound className="h-5 w-5 text-amber-500" /> Admin login
      </h1>
      <p className="mb-4 text-sm text-zinc-500">Leaders only. Campers, nothing to see here 👀</p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !password}>
          {busy ? "Checking…" : "Log in"}
        </Button>
      </form>
    </div>
  );
}
