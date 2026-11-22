import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getHouseholdId, setHouseholdId } from "./api";
import type { Household } from "./types";

// Several homes per account (main residence, parents' house, rental...). The chosen
// one is sent as X-Household-Id on every call; switching re-mounts the data layer so
// the dashboard, alerts and settings all follow.

interface HouseholdsCtx {
  households: Household[];
  current: Household | null;
  loading: boolean;
  error: string | null;
  switchTo: (id: string) => void;
  refresh: () => Promise<Household[]>;
}

const Ctx = createContext<HouseholdsCtx | null>(null);

export function HouseholdsProvider({ children }: { children: ReactNode }) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(getHouseholdId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.households();
      setHouseholds(list);
      setError(null);
      const saved = getHouseholdId();
      const valid = list.find((h) => h.id === saved) ?? list[0] ?? null;
      setHouseholdId(valid?.id ?? null);
      setCurrentId(valid?.id ?? null);
      return list;
    } catch (err) {
      setError((err as Error).message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchTo = useCallback((id: string) => {
    setHouseholdId(id);
    setCurrentId(id);
  }, []);

  const current = households.find((h) => h.id === currentId) ?? null;
  const value = useMemo(
    () => ({ households, current, loading, error, switchTo, refresh }),
    [households, current, loading, error, switchTo, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHouseholds(): HouseholdsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHouseholds outside HouseholdsProvider");
  return v;
}
