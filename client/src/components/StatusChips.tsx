import { Clock, Globe, Lock, LockOpen } from "lucide-react";
import type { Activity } from "../lib/api";
import { formatDateTime, timeLeft } from "../lib/format";
import { Badge } from "./ui/badge";

export function isActivityLocked(activity: Pick<Activity, "deadline">, nowMs: number): boolean {
  return activity.deadline !== null && nowMs > Date.parse(activity.deadline);
}

export function DeadlineChip({ activity, nowMs }: { activity: Activity; nowMs: number }) {
  if (!activity.deadline) {
    return (
      <Badge variant="green">
        <LockOpen className="h-3 w-3" /> Open
      </Badge>
    );
  }
  if (isActivityLocked(activity, nowMs)) {
    return (
      <Badge variant="red" title={`Closed ${formatDateTime(activity.deadline)}`}>
        <Lock className="h-3 w-3" /> Closed
      </Badge>
    );
  }
  return (
    <Badge variant="amber" title={`Deadline: ${formatDateTime(activity.deadline)}`}>
      <Clock className="h-3 w-3" /> Closes in {timeLeft(Date.parse(activity.deadline), nowMs)}
    </Badge>
  );
}

export function PublicChip({ activity }: { activity: Activity }) {
  if (!activity.isPublic) return null;
  return (
    <Badge variant="purple">
      <Globe className="h-3 w-3" /> Gallery open
    </Badge>
  );
}
