import { useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { uploadFiles, type Upload } from "../lib/api";
import { cn } from "../lib/utils";

export function UploadZone({
  activityId,
  onUploaded,
  onError,
}: {
  activityId: string;
  onUploaded: (myUploads: Upload[]) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  async function send(files: File[]) {
    if (files.length === 0 || progress !== null) return;
    setProgress(0);
    try {
      const res = await uploadFiles(activityId, files, setProgress);
      onUploaded(res.myUploads);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const busy = progress !== null;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        send([...e.dataTransfer.files]);
      }}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
        dragging ? "border-amber-500 bg-amber-50" : "border-zinc-300 bg-white hover:border-amber-400 hover:bg-amber-50/50",
        busy && "pointer-events-none",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => send([...(e.target.files ?? [])])}
      />
      {busy ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-700">Uploading… {Math.round((progress ?? 0) * 100)}%</p>
          <div className="mx-auto h-2 w-full max-w-sm overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width]"
              style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <CloudUpload className="mx-auto h-8 w-8 text-amber-500" />
          <p className="text-sm font-semibold text-zinc-800">Tap to choose files, or drop them here</p>
          <p className="text-xs text-zinc-500">Photos, videos, memes — anything goes</p>
        </div>
      )}
    </button>
  );
}
