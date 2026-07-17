import { Download, File, FileText, Music, Trash2 } from "lucide-react";
import { downloadUrl, fileUrl, type Upload } from "../lib/api";
import { formatBytes } from "../lib/format";
import { Button } from "./ui/button";

function Preview({ upload }: { upload: Upload }) {
  const src = fileUrl(upload.id);
  if (upload.mime.startsWith("image/")) {
    return <img src={src} alt={upload.originalName} loading="lazy" className="h-full w-full object-cover" />;
  }
  if (upload.mime.startsWith("video/")) {
    return <video src={src} controls preload="metadata" className="h-full w-full bg-black object-contain" />;
  }
  if (upload.mime.startsWith("audio/")) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-3">
        <Music className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
        <audio src={src} controls preload="metadata" className="w-full" />
      </div>
    );
  }
  const Icon = upload.mime.startsWith("text/") ? FileText : File;
  const ext = upload.originalName.includes(".") ? upload.originalName.split(".").pop() : "";
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500">
      <Icon className="h-10 w-10" />
      {ext && <span className="text-xs font-semibold uppercase">{ext}</span>}
    </div>
  );
}

export function FileCard({
  upload,
  onDelete,
  showOwner,
}: {
  upload: Upload;
  onDelete?: (upload: Upload) => void;
  showOwner?: boolean;
}) {
  return (
    <div className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-40 bg-zinc-100 dark:bg-zinc-800">
        <Preview upload={upload} />
      </div>
      <div className="flex items-center gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={upload.originalName}>
            {upload.originalName}
          </p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {showOwner ? `${upload.deviceLabel} · ` : ""}
            {formatBytes(upload.size)}
          </p>
        </div>
        <a href={downloadUrl(upload.id)} download title="Download">
          <Button variant="ghost" size="icon" tabIndex={-1}>
            <Download className="h-4 w-4" />
          </Button>
        </a>
        {onDelete && (
          <Button variant="dangerGhost" size="icon" title="Delete" onClick={() => onDelete(upload)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function FileGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
