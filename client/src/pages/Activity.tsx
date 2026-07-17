import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Globe, Lock } from "lucide-react";
import { api, type Activity as ActivityType, type Upload } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useNow } from "../lib/useNow";
import { FileCard, FileGrid } from "../components/FileCard";
import { DeadlineChip, PublicChip, isActivityLocked } from "../components/StatusChips";
import { UploadZone } from "../components/UploadZone";
import { Spinner } from "../components/ui/spinner";

interface Detail {
  activity: ActivityType;
  myUploads: Upload[];
  allUploads: Upload[] | null;
}

export function Activity() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const nowMs = useNow();

  useEffect(() => {
    api<Detail>(`/api/activities/${id}`)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [id]);

  const locked = detail ? isActivityLocked(detail.activity, nowMs) : false;

  const others = useMemo(() => {
    if (!detail?.allUploads) return null;
    const groups = new Map<string, Upload[]>();
    for (const u of detail.allUploads) {
      const list = groups.get(u.deviceLabel) ?? [];
      list.push(u);
      groups.set(u.deviceLabel, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [detail?.allUploads]);

  if (error) return <p className="py-12 text-center text-red-600 dark:text-red-400">{error}</p>;
  if (!detail) return <Spinner />;
  const { activity } = detail;

  async function deleteUpload(upload: Upload) {
    if (!window.confirm(`Delete "${upload.originalName}"?`)) return;
    setActionError("");
    try {
      await api(`/api/uploads/${upload.id}`, { method: "DELETE" });
      setDetail((d) =>
        d
          ? {
              ...d,
              myUploads: d.myUploads.filter((u) => u.id !== upload.id),
              allUploads: d.allUploads?.filter((u) => u.id !== upload.id) ?? null,
            }
          : d,
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" /> All activities
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{activity.title}</h1>
          <DeadlineChip activity={activity} nowMs={nowMs} />
          <PublicChip activity={activity} />
        </div>
        {activity.description && (
          <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{activity.description}</p>
        )}
      </div>

      {locked ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          <Lock className="h-5 w-5 shrink-0" />
          <p>
            This activity closed{activity.deadline ? ` on ${formatDateTime(activity.deadline)}` : ""}. Uploading and
            deleting is no longer possible.
          </p>
        </div>
      ) : (
        <UploadZone
          activityId={activity.id}
          onUploaded={(myUploads) => {
            setActionError("");
            setDetail((d) => (d ? { ...d, myUploads } : d));
            // refresh the shared gallery too if it's open
            if (detail.allUploads) {
              api<Detail>(`/api/activities/${activity.id}`).then(setDetail).catch(() => {});
            }
          }}
          onError={setActionError}
        />
      )}
      {actionError && <p className="text-sm font-medium text-red-600 dark:text-red-400">{actionError}</p>}

      <section className="space-y-3">
        <h2 className="font-bold text-zinc-800 dark:text-zinc-200">
          Your uploads <span className="font-normal text-zinc-400 dark:text-zinc-500">({detail.myUploads.length})</span>
        </h2>
        {detail.myUploads.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing uploaded from this device yet.</p>
        ) : (
          <FileGrid>
            {detail.myUploads.map((u) => (
              <FileCard key={u.id} upload={u} onDelete={locked ? undefined : deleteUpload} />
            ))}
          </FileGrid>
        )}
      </section>

      {others && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-violet-500" />
            <h2 className="font-bold text-zinc-800 dark:text-zinc-200">
              Everyone's uploads{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">({detail.allUploads!.length})</span>
            </h2>
          </div>
          {others.map(([label, uploads]) => (
            <div key={label} className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{label}</h3>
              <FileGrid>
                {uploads.map((u) => (
                  <FileCard key={u.id} upload={u} />
                ))}
              </FileGrid>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
