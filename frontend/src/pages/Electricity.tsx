import { AirVent, Heater, Plug, Thermometer, WashingMachine, Zap } from "lucide-react";
import { useData } from "../lib/data";
import { useMonthSeries, useTodaySeries } from "../lib/series";
import { usePoll, useNow } from "../lib/usePoll";
import { api } from "../lib/api";
import { amps, dt, dtRound, dtUnit, hertz, kwhValue, monthName, num, time, volts, watts } from "../lib/format";
import { Card, CardHeader, Divider, Estimation, IconTile, Label, PageHeader, Skeleton, cx } from "../components/ui";
import { TrancheBar } from "../components/TrancheBar";
import { MonthChart } from "../components/charts/MonthChart";
import { DayCharts } from "../components/charts/DayCharts";
import { DevicePill, LiveCard, LiveFooter, liveStatus } from "../components/status";
import type { Bill, Tariffs } from "../lib/types";
import { dateLabel } from "./Home";

function applianceIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("chauffe-eau") || l.includes("bouilloire")) return <Thermometer size={18} strokeWidth={1.5} />;
  if (l.includes("four") || l.includes("radiateur") || l.includes("plaque")) return <Heater size={18} strokeWidth={1.5} />;
  if (l.includes("clim")) return <AirVent size={18} strokeWidth={1.5} />;
  if (l.includes("machine") || l.includes("lave")) return <WashingMachine size={18} strokeWidth={1.5} />;
  return <Plug size={18} strokeWidth={1.5} />;
}

function BillRows({ bill, kva }: { bill: Bill; kva: number }) {
  const rows: [string, number][] = [
    [`Énergie · ${kwhValue(bill.qty)} kWh`, bill.energy_dt],
    ["TVA", bill.vat_dt],
    [`Redevance puissance · ${num(kva, 1, false)} kVA`, bill.fixed_dt],
    ["Taxes (municipale, transition)", bill.taxes_dt],
  ];
  return (
    <dl className="space-y-2.5">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4">
          <dt className="t-small text-body">{k}</dt>
          <dd className="t-data text-ink">{dt(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TariffTable({ tariffs, currentIndex }: { tariffs: Tariffs | null; currentIndex: number | null }) {
  if (!tariffs) return <Skeleton className="h-40" />;
  const rows = tariffs.tranches.filter((t) => t.resource === "electricity").sort((a, b) => a.min_qty - b.min_qty);
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[320px] border-separate border-spacing-x-1 text-left">
        <thead>
          <tr>
            <th className="t-label pb-2 font-medium text-mute">Tranche</th>
            <th className="t-label pb-2 text-right font-medium text-mute">Prix HT</th>
            <th className="t-label pb-2 text-right font-medium text-mute">TVA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const current = currentIndex === i + 1;
            return (
              <tr key={`${r.min_qty}-${r.valid_from}`} className={cx(current && "bg-elec-soft")}>
                <td className={cx("t-data rounded-l-[8px] border-t border-hairline px-2 py-2.5", current ? "font-semibold text-ink" : "text-body")}>
                  {r.max_qty == null ? `> ${num(r.min_qty)} kWh` : `${r.min_qty === 0 ? 0 : num(r.min_qty + 1)}–${num(r.max_qty)} kWh`}
                  {current && <span className="ml-2 font-sans text-[12px] font-medium text-elec-ink">ce mois</span>}
                </td>
                <td className="t-data border-t border-hairline px-2 py-2.5 text-right text-ink">{dtUnit(r.price_millimes / 1000)}</td>
                <td className="t-data rounded-r-[8px] border-t border-hairline px-2 py-2.5 text-right text-body">{num(r.vat_rate * 100)} %</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[13px] leading-5 text-mute">
        {tariffs.pricing_mode === "progressive"
          ? "Chaque tranche de kWh est payée à son propre prix."
          : "La tranche atteinte s'applique à tous les kWh du mois."}{" "}
        Grille STEG basse tension, à vérifier sur une vraie facture.
      </p>
    </div>
  );
}

export function ElectricityPage() {
  const { dashboard, tranche } = useData();
  const nowMs = useNow(5000);
  const now = new Date(nowMs);
  const month = useMonthSeries("electricity");
  const today = useTodaySeries("electricity");
  const tariffs = usePoll((s) => api.tariffs(s), 0);
  const d = dashboard.data;
  const e = d?.electricity;
  const status = liveStatus(d?.live ?? null, "electricity");
  const L = d?.live?.electricity;

  return (
    <>
      <PageHeader
        label={dateLabel(now)}
        title="Électricité"
        aside={d ? <DevicePill live={d.live} device={d.device} /> : undefined}
      />

      <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Label as="h2">Tranche STEG · {monthName(now)}</Label>
          </div>
          {e && tranche ? (
            <>
              <TrancheBar view={tranche} nextKwhPrice={e.next_kwh_price_dt} showHeader />
              <Divider className="my-5" />
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <Label as="dt">Ce mois-ci</Label>
                  <dd className="t-h1 mt-1 text-ink">{kwhValue(e.month_kwh)} kWh</dd>
                </div>
                <div>
                  <Label as="dt">Prochain kWh</Label>
                  <dd className="t-h1 mt-1 text-ink">{e.next_kwh_price_dt != null ? dtUnit(e.next_kwh_price_dt) : "—"}</dd>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label as="dt">Saut de tranche</Label>
                  <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                    {e.crossing_extra_cost_dt != null ? (
                      <>
                        <span className="t-h1 text-ink">+{dt(e.crossing_extra_cost_dt)}</span>
                        <Estimation />
                      </>
                    ) : (
                      <span className="t-small text-mute">dernière tranche</span>
                    )}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <Skeleton className="h-40" />
          )}
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader title="Facture du mois" aside={<Label as="span">DT · estimation</Label>} />
          {e?.bill_to_date ? (
            <>
              <Label className="mb-2.5">À ce jour</Label>
              <BillRows bill={e.bill_to_date} kva={d!.subscribed_kva} />
              <div className="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
                <span className="t-h3 text-ink">Total à ce jour</span>
                <span className="font-display text-[22px] font-semibold text-ink tabular-nums">≈ {dt(e.bill_to_date.total_dt)}</span>
              </div>
              <div className="mt-5 rounded-ctl bg-sunken p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="t-label text-mute">Fin du mois</span>
                  {e.forecast.bill ? (
                    <span className="flex items-baseline gap-1.5">
                      <span className="t-h1 text-ink">{dtRound(e.forecast.bill.total_dt)}</span>
                      <Estimation />
                    </span>
                  ) : (
                    <span className="t-small text-mute">—</span>
                  )}
                </div>
                <p className="mt-1 text-[13px] leading-5 text-mute">{e.forecast.assumption}</p>
              </div>
            </>
          ) : (
            <Skeleton className="h-52" />
          )}
        </Card>

        <div className="lg:col-span-12">
          <MonthChart series={month.data} elec={e ?? null} view={tranche} now={new Date(d?.generated_at ?? nowMs)} />
        </div>

        <div className="lg:col-span-8">
          <DayCharts
            show="power"
            title="Puissance aujourd'hui"
            power={today.data}
            water={null}
            livePower={L?.power_w ?? null}
            liveFlow={null}
            now={new Date(d?.live?.ts ?? nowMs)}
          />
        </div>

        <div className="grid grid-cols-1 content-start gap-4 sm:gap-5 lg:col-span-4">
          <LiveCard
            tone="elec"
            icon={<Zap size={18} strokeWidth={1.5} />}
            label="Puissance"
            value={L?.power_w != null ? watts(L.power_w) : null}
            status={status}
            footer={<LiveFooter status={status} live={d?.live ?? null} />}
          />
          <Card className="!p-5">
            <Label className="mb-3">Mesures PZEM-004T</Label>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                ["Tension", L?.voltage_v != null ? volts(L.voltage_v) : "—"],
                ["Courant", L?.current_a != null ? amps(L.current_a) : "—"],
                ["Facteur de puiss.", L?.power_factor != null ? num(L.power_factor, 2) : "—"],
                ["Fréquence", L?.frequency_hz != null ? hertz(L.frequency_hz) : "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="t-small text-mute">{k}</dt>
                  <dd className="t-data text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <Card className="lg:col-span-6">
          <CardHeader title="Gros consommateurs aujourd'hui" aside={<Label as="span">appareil probable</Label>} />
          {d && d.heavy_consumers.length ? (
            <ul className="divide-y divide-hairline">
              {d.heavy_consumers.map((h) => (
                <li key={h.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <IconTile tone="neutral" size={36}>
                    {applianceIcon(h.label)}
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">{h.label}</p>
                    <p className="font-mono text-[12px] text-mute">
                      {h.starts_today} démarrage{h.starts_today > 1 ? "s" : ""} · dernier à {time(h.last_seen_at)}
                    </p>
                  </div>
                  <span className="t-data text-ink">≈ {watts(h.typical_w)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-small text-mute">Aucun gros appareil repéré aujourd'hui.</p>
          )}
        </Card>

        <Card className="lg:col-span-6">
          <CardHeader title="Grille tarifaire" aside={<Label as="span">STEG · millimes</Label>} />
          <TariffTable tariffs={tariffs.data} currentIndex={e?.tranche?.index ?? null} />
        </Card>
      </div>
    </>
  );
}
