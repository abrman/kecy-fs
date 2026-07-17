import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, FolderDown, Pencil } from "lucide-react";
import { api, type Activity, type Upload } from "../lib/api";
import { formatBytes } from "../lib/format";
import { useNow } from "../lib/useNow";
import { ActivityDialog } from "../components/ActivityDialog";
import { DownloadAllButton, MAX_ZIP_BYTES } from "../components/DownloadAllButton";
import { FileCard, FileGrid } from "../components/FileCard";
import { DeadlineChip, PublicChip } from "../components/StatusChips";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";

interface Detail {
  activity: Activity;
  uploads: Upload[];
}

export function AdminActivity() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const nowMs = useNow(5000);

  const refresh = useCallback(() => {
    api<Detail>(`/api/admin/activities/${id}`)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(refresh, [refresh]);

  const groups = useMemo(() => {
    if (!detail) return [];
    const map = new Map<string, Upload[]>();
    for (const u of detail.uploads) {
      const list = map.get(u.deviceLabel) ?? [];
      list.push(u);
      map.set(u.deviceLabel, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [detail]);

  if (error) return <p className="py-12 text-center text-red-600 dark:text-red-400">{error}</p>;
  if (!detail) return <Spinner />;
  const { activity, uploads } = detail;
  const totalSize = uploads.reduce((sum, u) => sum + u.size, 0);

  async function deleteUpload(upload: Upload) {
    if (!window.confirm(`Delete "${upload.originalName}" (from ${upload.deviceLabel})?`)) return;
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
          <h1 className="text-2xl font-bold">{activity.title}</h1>
          <DeadlineChip activity={activity} nowMs={nowMs} />
          <PublicChip activity={activity} />
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {uploads.length} files · {formatBytes(totalSize)} · {groups.length} devices
        </p>
        <div className="mt-3 flex gap-2">
          {uploads.length > 0 &&
            (totalSize > MAX_ZIP_BYTES ? (
              <DownloadAllButton activityId={activity.id} fileCount={uploads.length} onError={setError} />
            ) : (
              <a href={`/api/admin/activities/${activity.id}/zip`}>
                <Button variant="secondary" size="sm" tabIndex={-1}>
                  <FolderDown className="h-4 w-4" /> Download all as ZIP
                </Button>
              </a>
            ))}
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>
      </div>

      {uploads.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No uploads yet.</p>}

      {groups.map(([label, groupUploads]) => (
        <section key={label} className="space-y-2">
          <h2 className="font-semibold text-zinc-700 dark:text-zinc-300">
            {label} <span className="font-normal text-zinc-400 dark:text-zinc-500">({groupUploads.length})</span>
          </h2>
          <FileGrid>
            {groupUploads.map((u) => (
              <FileCard key={u.id} upload={u} onDelete={deleteUpload} />
            ))}
          </FileGrid>
        </section>
      ))}

      <ActivityDialog open={editOpen} onClose={() => setEditOpen(false)} onSaved={refresh} activity={activity} />
    </div>
  );
}
