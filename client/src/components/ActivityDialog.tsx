import { useEffect, useState } from "react";
import { api, type Activity } from "../lib/api";
import { fromLocalInput, toLocalInput } from "../lib/format";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input, Label, Textarea } from "./ui/input";
import { Switch } from "./ui/switch";

export function ActivityDialog({
  open,
  onClose,
  onSaved,
  activity,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When set, edits this activity; otherwise creates a new one. */
  activity?: Activity | null;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(activity?.title ?? "");
    setDescription(activity?.description ?? "");
    setDeadline(toLocalInput(activity?.deadline ?? null));
    setIsPublic(activity?.isPublic ?? false);
    setError("");
  }, [open, activity]);

  async function save() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");
    const body = { title, description, deadline: fromLocalInput(deadline), isPublic };
    try {
      if (activity) {
        await api(`/api/admin/activities/${activity.id}`, { method: "PATCH", body });
      } else {
        await api("/api/admin/activities", { method: "POST", body });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={activity ? "Edit activity" : "New activity"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <Label htmlFor="act-title">Title</Label>
          <Input
            id="act-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meme Monday"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="act-desc">Description</Label>
          <Textarea
            id="act-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Make the funniest meme about camp life…"
          />
        </div>
        <div>
          <Label htmlFor="act-deadline">Deadline</Label>
          <Input
            id="act-deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            After the deadline campers can't add or delete files. Leave empty to keep it open.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <div>
            <p className="text-sm font-medium">Public gallery</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Campers can see and download everyone's uploads</p>
          </div>
          <Switch checked={isPublic} onChange={setIsPublic} />
        </div>
        {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : activity ? "Save changes" : "Create activity"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
