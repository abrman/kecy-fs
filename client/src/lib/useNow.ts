import { useEffect, useState } from "react";
import { serverNowMs } from "./api";

/** Server-synced "now" that re-renders on an interval — drives countdowns. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(serverNowMs());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNowMs()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
