import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Fingerprint, ShieldCheck, Tent } from "lucide-react";
import { api, type Me } from "../lib/api";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 text-amber-950">
            <Tent className="h-5 w-5" />
          </span>
          <span>
            KECY <span className="font-normal text-zinc-500 dark:text-zinc-400">file server</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {me && (
            <span
              className="hidden items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 sm:inline-flex dark:bg-zinc-800 dark:text-zinc-300"
              title="This is how the leaders see your device"
            >
              <Fingerprint className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
              {me.label}
            </span>
          )}
          <ThemeToggle />
          <Link
            to="/admin"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="Admin"
          >
            <ShieldCheck className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
