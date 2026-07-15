import { useState } from "react";
import { FolderDown } from "lucide-react";
import { api, downloadUrl, type Upload } from "../lib/api";
import { Button } from "./ui/button";

/**
 * Above this total size the admin UI offers per-file downloads instead of a
 * ZIP — huge archives are slow to assemble, and entries over 4 GiB corrupt
 * the ZIP (fflate has no ZIP64 support).
 */
export const MAX_ZIP_BYTES = 500 * 1024 * 1024;

/** Triggers a browser download for every file in the activity, one by one.
 * The browser asks once to allow multiple downloads, then drops them all
 * into the Downloads folder. */
export function DownloadAllButton({
  activityId,
  fileCount,
  label = "Download all files",
  onError,
}: {
  activityId: string;
  fileCount: number;
  label?: string;
  onError?: (message: string) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);

  async function downloadAll() {
    setProgress(0);
    try {
      const { uploads } = await api<{ uploads: Upload[] }>(`/api/admin/activities/${activityId}`);
      for (let i = 0; i < uploads.length; i++) {
        const a = document.createElement("a");
        a.href = downloadUrl(uploads[i].id);
        a.download = uploads[i].originalName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setProgress(i + 1);
        // Space the clicks out so the browser doesn't drop downloads.
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Download failed");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Button variant="secondary" size="sm" disabled={progress !== null} onClick={downloadAll}>
      <FolderDown className="h-4 w-4" />
      {progress !== null ? `Downloading ${progress}/${fileCount}…` : label}
    </Button>
  );
}
