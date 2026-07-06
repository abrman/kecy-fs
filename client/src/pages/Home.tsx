import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ImageUp, PartyPopper } from "lucide-react";
import { api, type Activity } from "../lib/api";
import { useNow } from "../lib/useNow";
import { DeadlineChip, PublicChip } from "../components/StatusChips";
import { Spinner } from "../components/ui/spinner";

export function Home() {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState("");
  const nowMs = useNow();

  useEffect(() => {
    api<{ activities: Activity[] }>("/api/activities")
      .then((d) => setActivities(d.activities))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="py-12 text-center text-red-600">{error}</p>;
  if (!activities) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Activities</h1>
      {activities.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-zinc-500">
          <PartyPopper className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="font-medium">Nothing here yet</p>
          <p className="text-sm">Activities will show up as the leaders create them.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {activities.map((a) => (
          <Link
            key={a.id}
            to={`/a/${a.id}`}
            className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-bold text-zinc-900 group-hover:text-amber-700">{a.title}</h2>
              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 group-hover:text-amber-500" />
            </div>
            {a.description && <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{a.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <DeadlineChip activity={a} nowMs={nowMs} />
              <PublicChip activity={a} />
              {(a.myCount ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
                  <ImageUp className="h-3.5 w-3.5" />
                  {a.myCount} of yours
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
