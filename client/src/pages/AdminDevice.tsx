import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChevronLeft, Smartphone } from "lucide-react";
import { api, type Upload } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { FileCard, FileGrid } from "../components/FileCard";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";

type DeviceUpload = Upload & { activityTitle: string };

interface Detail {
  device: {
    id: string;
    codename: string;
    name: string | null;
    label: string;
    userAgent: string;
    createdAt: string;
    lastSeen: string;
  };
  uploads: DeviceUpload[];
}

export function AdminDevice() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(() => {
    api<Detail>(`/api/admin/devices/${id}`)
      .then((d) => {
        setDetail(d);
        setName((n) => n ?? (d.device.name ?? ""));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(refresh, [refresh]);

  const groups = useMemo(() => {
    if (!detail) return [];
    const map = new Map<string, DeviceUpload[]>();
    for (const u of detail.uploads) {
      const list = map.get(u.activityId) ?? [];
      list.push(u);
      map.set(u.activityId, list);
    }
    return [...map.entries()];
  }, [detail]);

  if (error) return <p className="py-12 text-center text-red-600 dark:text-red-400">{error}</p>;
  if (!detail || name === null) return <Spinner />;
  const { device } = detail;

  async function saveName() {
    try {
      await api(`/api/admin/devices/${device.id}`, { method: "PATCH", body: { name } });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
    }
  }

  async function deleteUpload(upload: Upload) {
    if (!window.confirm(`Delete "${upload.originalName}"?`)) return;
    try {
      await api(`/api/uploads/${upload.id}`, { method: "DELETE" });
      setDetail((d) => (d ? { ...d, uploads: d.uploads.filter((u) => u.id !== upload.id) } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" /> Admin
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Smartphone className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
          <h1 className="text-2xl font-bold">{device.label}</h1>
          <Badge variant="amber">{device.codename}</Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {detail.uploads.length} uploads · last seen {formatDateTime(device.lastSeen)}
        </p>
        <p className="mt-0.5 max-w-xl truncate text-xs text-zinc-400 dark:text-zinc-500" title={device.userAgent}>
          {device.userAgent || "unknown browser"}
        </p>
        <form
          className="mt-3 flex max-w-sm items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Camper's name…" />
          <Button type="submit" variant="secondary" size="sm" disabled={name.trim() === (device.name ?? "")}>
            Save
          </Button>
          {saved && <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
        </form>
      </div>

      {detail.uploads.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No uploads from this device yet.</p>
      )}

      {groups.map(([activityId, uploads]) => (
        <section key={activityId} className="space-y-2">
          <h2 className="font-semibold text-zinc-700 dark:text-zinc-300">
            <Link to={`/admin/a/${activityId}`} className="hover:text-amber-700 dark:hover:text-amber-400">
              {uploads[0].activityTitle}
            </Link>{" "}
            <span className="font-normal text-zinc-400 dark:text-zinc-500">({uploads.length})</span>
          </h2>
          <FileGrid>
            {uploads.map((u) => (
              <FileCard key={u.id} upload={u} onDelete={deleteUpload} />
            ))}
          </FileGrid>
        </section>
      ))}
    </div>
  );
}
