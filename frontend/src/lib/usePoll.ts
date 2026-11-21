import { useCallback, useEffect, useRef, useState } from "react";

export interface PollState<T> {
  data: T | null;
  error: string | null;
  /** HTTP status of the last error (0 = server unreachable). */
  errorStatus: number | null;
  loading: boolean;
  /** Time of the last successful fetch (ms since epoch). */
  updatedAt: number | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch now, then every `intervalMs` while the tab is visible. Keeps the last good
 * data on error (the screen shows it as stale rather than blanking out).
 * `intervalMs = 0` fetches once (plus manual refresh()).
 */
export function usePoll<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const inFlight = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    try {
      const result = await fetcherRef.current(ctrl.signal);
      if (ctrl.signal.aborted) return;
      setData(result);
      setError(null);
      setErrorStatus(null);
      setUpdatedAt(Date.now());
    } catch (err) {
      if ((err as Error).name === "AbortError" || ctrl.signal.aborted) return;
      setError((err as Error).message || "Erreur inconnue");
      setErrorStatus(typeof (err as { status?: unknown }).status === "number" ? (err as { status: number }).status : null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void run();
    if (!intervalMs) return () => inFlight.current?.abort();
    let timer: number | undefined;
    const schedule = () => {
      window.clearInterval(timer);
      if (document.visibilityState === "visible") timer = window.setInterval(run, intervalMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void run();
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      inFlight.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, run, ...deps]);

  return { data, error, errorStatus, loading, updatedAt, refresh: run };
}

/** Re-render every `ms` so "il y a 4 s" keeps counting between polls. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
