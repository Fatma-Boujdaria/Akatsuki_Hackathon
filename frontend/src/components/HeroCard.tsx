import { TriangleAlert } from "lucide-react";
import type { Dashboard } from "../lib/types";
import type { TrancheView } from "../lib/tranche";
import { dtRound, dtUnit, kwhValue, monthName, num } from "../lib/format";
import { Card, Divider, Estimation, Label, cx } from "./ui";
import { DevicePill } from "./status";
import { TrancheBar } from "./TrancheBar";

// Principle 01, one number leads: every screen opens on the kWh left before the next tranche.

export function HeroCard({ data, view, ageS }: { data: Dashboard; view: TrancheView; ageS?: number }) {
  const e = data.electricity;
  const month = monthName(data.generated_at);
  const forecastBill = e.forecast.available ? e.forecast.bill : null;
  const headsUp = view.state === "near" || view.state === "crossed";

  return (
    <Card className="flex flex-col">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Label as="h2">Électricité · {month}</Label>
        <DevicePill live={data.live} device={data.device} compact ageOverride={ageS} />
      </div>

      {view.state === "top" || view.state === "none" ? (
        <div>
          <p className="t-body text-[19px] text-body">Ce mois-ci</p>
          <p className="t-hero my-1 text-ink">
            {kwhValue(view.used)} <span className="tracking-[-1px]">kWh</span>
          </p>
          <p className="t-body text-body">
            {view.state === "top" ? `dernière tranche · ${view.currentBandLabel}` : "grille tarifaire non configurée"}
          </p>
        </div>
      ) : (
        <div>
          {view.state === "crossed" && (
            <p className="mb-2 inline-flex items-center gap-1.5 text-[15px] font-semibold text-harissa">
              Tranche {view.currentBandLabel} atteinte
            </p>
          )}
          <p className={cx("t-body flex items-center gap-1.5 text-[19px]", view.state === "near" ? "text-harissa" : "text-body")}>
            {view.state === "near" && <TriangleAlert size={18} strokeWidth={1.75} aria-hidden />}
            Encore
          </p>
          <p className="t-hero my-1 text-ink" aria-live="polite">
            {kwhValue(view.left ?? 0)} <span className="tracking-[-1px]">kWh</span>
          </p>
          <p className="t-body text-body">avant la tranche {view.nextBandLabel}</p>
        </div>
      )}

      <TrancheBar view={view} nextKwhPrice={e.next_kwh_price_dt} className="mt-6" />

      <Divider className="my-5" />

      <dl className="grid grid-cols-2 gap-4">
        <div>
          <Label as="dt">Prochain kWh</Label>
          <dd className="t-h1 mt-1 text-ink">{e.next_kwh_price_dt != null ? dtUnit(e.next_kwh_price_dt) : "—"}</dd>
        </div>
        <div>
          <Label as="dt">Fin du mois</Label>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            {forecastBill ? (
              <>
                <span className="t-h1 text-ink">{dtRound(forecastBill.total_dt)}</span>
                <Estimation />
              </>
            ) : (
              <span className="t-small text-mute">pas encore assez de mesures</span>
            )}
          </dd>
        </div>
      </dl>
      {headsUp && e.crossing_extra_cost_dt != null && view.state === "near" && (
        <p className="sr-only">
          Franchir {num(view.next ?? 0)} kWh coûterait environ {num(e.crossing_extra_cost_dt, 2)} DT de plus, estimation.
        </p>
      )}
    </Card>
  );
}
