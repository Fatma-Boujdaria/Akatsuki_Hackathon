import { api } from "./api";
import type { Resource } from "./types";
import { usePoll } from "./usePoll";
import { monthStartIso, todayStartIso } from "./time";

/** Today's curve (since local midnight, per minute), refreshed every 15 s. */
export function useTodaySeries(resource: Resource, enabled = true) {
  return usePoll(
    (signal) =>
      enabled
        ? api.readings({ resource, from: todayStartIso(), bucket: "minute" }, signal)
        : Promise.resolve(null),
    enabled ? 15_000 : 0,
    [resource, enabled],
  );
}

/** This month, one point per local day, refreshed every minute. */
export function useMonthSeries(resource: Resource) {
  return usePoll((signal) => api.readings({ resource, from: monthStartIso(), bucket: "day" }, signal), 60_000, [resource]);
}
