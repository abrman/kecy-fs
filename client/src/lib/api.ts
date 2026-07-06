// Thin fetch wrapper + shared API types.

export interface Me {
  deviceId: string;
  codename: string;
  name: string | null;
  label: string;
  isAdmin: boolean;
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

/** Upload via XHR so we get progress events for the progress bar. */
export function uploadFiles(
  activityId: string,
  files: File[],
  onProgress: (fraction: number) => void,
): Promise<{ myUploads: Upload[] }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/activities/${activityId}/uploads`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
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
    xhr.send(fd);
  });
}

export const fileUrl = (uploadId: string) => `/api/uploads/${uploadId}/file`;
export const downloadUrl = (uploadId: string) => `/api/uploads/${uploadId}/file?download=1`;
