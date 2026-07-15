// Thin fetch wrapper + shared API types.

export interface Me {
  deviceId: string;
  codename: string;
  name: string | null;
  label: string;
  isAdmin: boolean;
  maxUploadMb: number;
  serverNow: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  isPublic: boolean;
  locked: boolean;
  createdAt: string;
  myCount?: number;
  uploadCount?: number;
  deviceCount?: number;
  totalSize?: number;
}

export interface Upload {
  id: string;
  activityId: string;
  deviceId: string;
  deviceLabel: string;
  originalName: string;
  mime: string;
  size: number;
  createdAt: string;
}

export interface DeviceInfo {
  id: string;
  codename: string;
  name: string | null;
  label: string;
  userAgent: string;
  createdAt: string;
  lastSeen: string;
  uploadCount: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Keep track of the difference between the server clock and this device's
// clock, so deadline countdowns can't be cheated by changing the phone's time.
let offsetMs = 0;
export function noteServerNow(iso: unknown) {
  if (typeof iso === "string") {
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) offsetMs = t - Date.now();
  }
}
export function serverNowMs(): number {
  return Date.now() + offsetMs;
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string })?.error ?? `Request failed (${res.status})`);
  }
  noteServerNow((data as { serverNow?: string })?.serverNow);
  return data as T;
}

// Oversized files must be caught before sending: past the limit the server
// drops the connection mid-upload, so the browser only sees a network error.
let maxUploadMbPromise: Promise<number> | null = null;
function getMaxUploadMb(): Promise<number> {
  maxUploadMbPromise ??= api<Me>("/api/me").then(
    (me) => me.maxUploadMb || Infinity,
    () => Infinity, // server still enforces the limit if this lookup fails
  );
  return maxUploadMbPromise;
}

/**
 * Upload via XHR so we get progress events for the progress bar.
 * Each file is sent as the raw request body of its own request (not multipart)
 * so the server can stream it to disk — multipart parsing broke files over 4 GiB.
 */
export async function uploadFiles(
  activityId: string,
  files: File[],
  onProgress: (fraction: number) => void,
): Promise<{ myUploads: Upload[] }> {
  const valid = files.filter((f) => f.size > 0);
  if (valid.length === 0) throw new ApiError(400, "No files received");
  const maxUploadMb = await getMaxUploadMb();
  const tooBig = valid.find((f) => f.size > maxUploadMb * 1024 * 1024);
  if (tooBig) {
    throw new ApiError(413, `"${tooBig.name}" is too big (limit is ${maxUploadMb} MB per file).`);
  }
  const totalBytes = valid.reduce((sum, f) => sum + f.size, 0);
  let doneBytes = 0;
  let last: { myUploads: Upload[] } = { myUploads: [] };
  for (const f of valid) {
    last = await uploadOne(activityId, f, (loaded) => onProgress((doneBytes + loaded) / totalBytes));
    doneBytes += f.size;
  }
  return last;
}

function uploadOne(
  activityId: string,
  file: File,
  onLoaded: (bytes: number) => void,
): Promise<{ myUploads: Upload[] }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/activities/${activityId}/uploads?filename=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded);
    };
    xhr.onload = () => {
      let data: { error?: string; myUploads?: Upload[] } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.myUploads) {
        resolve({ myUploads: data.myUploads });
      } else {
        reject(new ApiError(xhr.status, data?.error ?? `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error during upload"));
    xhr.send(file);
  });
}

export const fileUrl = (uploadId: string) => `/api/uploads/${uploadId}/file`;
export const downloadUrl = (uploadId: string) => `/api/uploads/${uploadId}/file?download=1`;
