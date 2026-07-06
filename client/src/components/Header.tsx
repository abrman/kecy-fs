import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Fingerprint, ShieldCheck, Tent } from "lucide-react";
import { api, type Me } from "../lib/api";

export function Header() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-zinc-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 text-amber-950">
            <Tent className="h-5 w-5" />
          </span>
          <span>
            KECY <span className="font-normal text-zinc-500">file server</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {me && (
            <span
              className="hidden items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 sm:inline-flex"
              title="This is how the leaders see your device"
            >
              <Fingerprint className="h-3.5 w-3.5 text-amber-600" />
              {me.label}
            </span>
          )}
          <Link
            to="/admin"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            title="Admin"
          >
            <ShieldCheck className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
