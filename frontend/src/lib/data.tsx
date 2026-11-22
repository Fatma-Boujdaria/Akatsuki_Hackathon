import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Dashboard, Insights, Settings } from "./types";
import { usePoll, type PollState } from "./usePoll";
import { trancheView, type TrancheView } from "./tranche";

/** The dashboard is polled every 2.5 s: a new reading shows within 5 s. */
export const DASHBOARD_POLL_MS = 2500;
const SNOOZE_KEY = "tg-snoozed-alerts";
const SNOOZE_MS = 2 * 60 * 60 * 1000; // "Plus tard" hides a banner for 2 h

interface DataCtx {
  dashboard: PollState<Dashboard>;
  settings: PollState<Settings>;
  /** Status (normal...critical), trends and appliance breakdown, every 30 s. */
  insights: PollState<Insights>;
  tranche: TrancheView | null;
  snoozed: Set<string>;
  snooze: (alertId: string) => void;
}

const Ctx = createContext<DataCtx | null>(null);

function readSnoozed(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}") as Record<string, number>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, until]) => until > now));
  } catch {
    return {};
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const dashboard = usePoll((s) => api.dashboard(s), DASHBOARD_POLL_MS);
  const settings = usePoll((s) => api.settings(s), 60_000);
  const insights = usePoll((s) => api.insights(s), 30_000);
  const [snoozedMap, setSnoozedMap] = useState(readSnoozed);

  const snooze = useCallback((id: string) => {
    setSnoozedMap((prev) => {
      const next = { ...prev, [id]: Date.now() + SNOOZE_MS };
      try {
        localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
      } catch {
        /* kept in memory only */
      }
      return next;
    });
  }, []);

  const margin = settings.data?.alert_margin_kwh ?? 10;
  const tranche = useMemo(
    () => (dashboard.data ? trancheView(dashboard.data.electricity, margin, new Date(dashboard.data.generated_at)) : null),
    [dashboard.data, margin],
  );
  const snoozed = useMemo(() => new Set(Object.keys(snoozedMap)), [snoozedMap]);

  const value = useMemo(
    () => ({ dashboard, settings, insights, tranche, snoozed, snooze }),
    [dashboard, settings, insights, tranche, snoozed, snooze],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}
