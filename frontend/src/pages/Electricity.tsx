import { useMemo, useState } from "react";
import { useData } from "../lib/data";
import { useMonthSeries, useTodaySeries } from "../lib/series";
import { usePoll, useNow } from "../lib/usePoll";
import { api } from "../lib/api";
import { L } from "../lib/i18n";
import { amps, dt, dtRound, hertz, kwh, kwhValue, num, shortAge, time, volts } from "../lib/format";
import { applianceIcon } from "../lib/appliances";
import { Card, CardHeader, Estimation, PageHeader, ProgressBar, Segmented, Skeleton, cx } from "../components/ui";
import { MonthChart } from "../components/charts/MonthChart";
import { DayCharts } from "../components/charts/DayCharts";
import type { Bill, Tariffs } from "../lib/types";

function BillRows({ bill, kva }: { bill: Bill; kva: number }) {
  const rows: [string, number][] = [
    [`${L("Énergie", "Energy", "الطاقة")} · ${kwhValue(bill.qty)} kWh`, bill.energy_dt],
    [L("TVA", "VAT", "TVA"), bill.vat_dt],
    [`${L("Redevance puissance", "Power fee", "معلوم القوة")} · ${num(kva, 1, false)} kVA`, bill.fixed_dt],
    [L("Taxes (municipale, transition)", "Taxes (municipal, transition)", "الأداءات (البلدية، الانتقال)"), bill.taxes_dt],
  ];
  return (
    <dl className="space-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 text-[13px]">
          <dt className="text-body">{k}</dt>
          <dd className="font-bold text-ink tabular-nums">{dt(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Tranches STEG · prix par kWh": the current band framed in Chams with its progress. */
function TrancheList({ tariffs, currentIndex, used }: { tariffs: Tariffs | null; currentIndex: number | null; used: number }) {
  if (!tariffs) return <Skeleton className="h-44" />;
  const rows = tariffs.tranches.filter((t) => t.resource === "electricity").sort((a, b) => a.min_qty - b.min_qty);
  const latest = rows.reduce((a, b) => (b.valid_from > a ? b.valid_from : a), rows[0]?.valid_from ?? "");
  const band = rows.filter((r) => r.valid_from === latest);
  const label = (r: (typeof band)[number]) =>
    r.max_qty == null
      ? L(`Plus de ${num(r.min_qty)} kWh`, `Over ${num(r.min_qty)} kWh`, `أكثر من ${num(r.min_qty)} kWh`)
      : `${r.min_qty === 0 ? 0 : num(r.min_qty + 1)} – ${num(r.max_qty)} kWh`;
  return (
    <div className="space-y-2">
      {band.map((r, i) => {
        const current = currentIndex === i + 1;
        const span = r.max_qty == null ? null : r.max_qty - r.min_qty;
        const pct = span ? ((used - r.min_qty) / span) * 100 : 100;
        return current ? (
          <div key={r.min_qty} className="space-y-1.5 rounded-[12px] border-[1.5px] border-chams px-3 py-2">
            <div className="flex justify-between text-[13px]">
              <span className="font-bold text-ink">
                {label(r)} · {L("actuelle", "current", "الحالية")}
              </span>
              <span className="font-bold text-elec-ink">
                {r.price_millimes} {L("mil.", "mill.", "مليم")}
              </span>
            </div>
            <ProgressBar pct={pct} label={L(`${Math.round(pct)} % de la tranche`, `${Math.round(pct)} % of the tranche`, `${Math.round(pct)} % من الشريحة`)} />
          </div>
        ) : (
          <div key={r.min_qty} className="flex justify-between px-3 py-0.5 text-[13px] text-body">
            <span>{label(r)}</span>
            <span>
              {r.price_millimes} {L("mil.", "mill.", "مليم")}
            </span>
          </div>
        );
      })}
      <p className="px-1 pt-1 text-[12px] text-mute">
        {tariffs.pricing_mode === "progressive"
          ? L("Chaque tranche est payée à son prix.", "Each tranche is paid at its own price.", "كل شريحة بسومها.")
          : L("La tranche atteinte s'applique à tout le mois.", "The tranche reached applies to the whole month.", "الشريحة اللي توصلها تتطبّق على الشهر الكل.")}{" "}
        {L("Hors TVA et taxes ; à vérifier sur une vraie facture.", "Before VAT and taxes; to check on a real bill.", "بلا TVA والأداءات؛ لازم يتثبّت في فاتورة.")}
      </p>
    </div>
  );
}

export function ElectricityPage() {
  const { dashboard, tranche, insights } = useData();
  const nowMs = useNow(1000);
  const [view, setView] = useState<"day" | "month">("day");
  const month = useMonthSeries("electricity");
  const today = useTodaySeries("electricity");
  const tariffs = usePoll((s) => api.tariffs(s), 0);
  const d = dashboard.data;
  const e = d?.electricity;
  const live = d?.live?.electricity;
  const stale = !!d?.live?.stale || !d?.device?.online;
  const ageS = d?.live ? d.live.age_s + Math.max(0, (nowMs - (dashboard.updatedAt ?? nowMs)) / 1000) : null;
  const todayKwh = useMemo(() => (today.data?.points ?? []).reduce((s, p) => s + (p.energy_kwh ?? 0), 0), [today.data]);
  const consumers = d?.heavy_consumers ?? [];
  const maxW = Math.max(1, ...consumers.map((c) => c.typical_w));
  const profile = insights.data?.breakdown ?? [];

  return (
    <>
      <PageHeader
        title={L("Électricité", "Electricity", "الضو")}
        aside={
          <Segmented
            label={L("Période", "Period", "المدة")}
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: L("Jour", "Day", "نهار") },
              { value: "month", label: L("Mois", "Month", "شهر") },
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12 lg:gap-5">
        <div className="space-y-3 lg:col-span-7">
          {/* Live power + today */}
          <div className="flex min-h-24 items-center justify-between rounded-card bg-surface px-[18px] py-3.5">
            <div>
              <p className="text-[13px] text-mute">{stale ? L("Dernière puissance reçue", "Last power received", "آخر قوة وصلت") : L("Puissance en direct", "Live power", "القوة مباشرة")}</p>
              {live && !live.reliable ? (
                <p className="text-[22px] leading-[40px] font-extrabold text-harissa">{live.fault ? L("Capteur en panne", "Sensor fault", "الكابتور معطّل") : L("Mesure peu fiable", "Unreliable reading", "قياس موش مضمون")}</p>
              ) : (
                <p dir="ltr" className={cx("text-start text-[36px] leading-[40px] font-extrabold tabular-nums", stale ? "text-mute" : "text-elec-ink")}>
                  {live?.power_w != null ? `${num(live.power_w / 1000, 2)} kW` : "—"}
                </p>
              )}
              <p className="text-[12px] text-mute">
                {ageS != null
                  ? `${L("Mis à jour il y a", "Updated", "تحدّث قبل")} ${shortAge(ageS)}${L("", " ago", "")}`
                  : L("En attente de mesure", "Waiting for a reading", "نستنّاو في القياس")}
              </p>
            </div>
            <div className="text-end">
              <p className="text-[13px] text-mute">{L("Aujourd'hui", "Today", "اليوم")}</p>
              <p className="text-[22px] font-extrabold tabular-nums text-ink">{kwh(todayKwh)}</p>
              {e?.next_kwh_price_dt != null && <p className="text-[12px] text-mute">≈ {dt(todayKwh * e.next_kwh_price_dt)}</p>}
            </div>
          </div>

          {view === "day" ? (
            <DayCharts
              show="power"
              title={L("Puissance aujourd'hui", "Power today", "القوة اليوم")}
              power={today.data}
              water={null}
              livePower={live?.power_w ?? null}
              liveFlow={null}
              now={new Date(d?.live?.ts ?? nowMs)}
            />
          ) : (
            <MonthChart series={month.data} elec={e ?? null} view={tranche} now={new Date(d?.generated_at ?? nowMs)} />
          )}

          <Card className="!p-4">
            <CardHeader title={L("Tranches STEG", "STEG tranches", "شرائح STEG")} aside={L("prix par kWh", "price per kWh", "السوم لكل kWh")} />
            <TrancheList tariffs={tariffs.data} currentIndex={e?.tranche?.index ?? null} used={e?.month_kwh ?? 0} />
          </Card>
        </div>

        <div className="space-y-3 lg:col-span-5">
          <Card className="!p-4">
            <CardHeader title={L("Facture du mois", "This month's bill", "فاتورة الشهر")} aside={<Estimation />} />
            {e?.bill_to_date ? (
              <>
                <BillRows bill={e.bill_to_date} kva={d!.subscribed_kva} />
                <div className="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
                  <span className="text-[14px] font-bold text-ink">{L("Total à ce jour", "Total so far", "المجموع لتوّا")}</span>
                  <span className="text-[20px] font-extrabold text-ink tabular-nums">≈ {dt(e.bill_to_date.total_dt)}</span>
                </div>
                <div className="mt-3 rounded-ctl bg-sunken p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-bold text-mute">{L("Fin du mois", "End of month", "آخر الشهر")}</span>
                    <span className="text-[20px] font-extrabold text-elec-ink">{e.forecast.bill ? dtRound(e.forecast.bill.total_dt) : "—"}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-mute">{e.forecast.assumption}</p>
                  {e.crossing_extra_cost_dt != null && e.next_threshold_kwh != null && (
                    <p className="mt-1 text-[12px] text-mute">
                      {L(
                        `Passer ${num(e.next_threshold_kwh)} kWh : ≈ +${dt(e.crossing_extra_cost_dt)}`,
                        `Crossing ${num(e.next_threshold_kwh)} kWh: ≈ +${dt(e.crossing_extra_cost_dt)}`,
                        `تعدّي ${num(e.next_threshold_kwh)} kWh: ≈ +${dt(e.crossing_extra_cost_dt)}`,
                      )}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <Skeleton className="h-40" />
            )}
          </Card>

          <Card className="!p-4">
            <CardHeader title={L("Gros consommateurs (probables)", "Heavy consumers (probable)", "اللي ياكلو برشا (محتمل)")} aside={L("aujourd'hui", "today", "اليوم")} />
            {consumers.length ? (
              <ul className="space-y-2.5">
                {consumers.map((c, i) => (
                  <li key={c.label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2.5 text-[13px]">
                    <span className="truncate text-ink" title={`${c.starts_today} × · ${time(c.last_seen_at)}`}>
                      {c.label}
                    </span>
                    <ProgressBar pct={(c.typical_w / maxW) * 100} tone={i === 0 ? "elec" : i === 1 ? "sable" : "water"} />
                    <span className="font-bold text-ink tabular-nums">{num(c.typical_w / 1000, 2)} kW</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-mute">{L("Aucun gros appareil repéré aujourd'hui.", "No large appliance spotted today.", "ما تلقّاش آلة كبيرة اليوم.")}</p>
            )}
            <p className="mt-3 text-[12px] text-mute">
              {L(
                "Repérés aux sauts de puissance du compteur : un appareil probable, pas une mesure par appareil.",
                "Spotted from power steps at the meter: a probable appliance, not a per-appliance measurement.",
                "تلقيناهم من القفزات في القوة: آلة محتملة، موش قياس لكل آلة.",
              )}
            </p>
          </Card>

          {profile.length > 0 && (
            <Card className="!p-4">
              <CardHeader title={L("Répartition d'après ton profil", "Split from your profile", "التقسيم حسب البروفيل")} aside={<Estimation />} />
              <ul className="space-y-2">
                {profile.slice(0, 6).map((p) => (
                  <li key={p.id ?? p.name} className="flex items-center gap-2.5 text-[13px]">
                    <span className="text-mute">{applianceIcon(p.category, 16)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                    <span className="text-mute tabular-nums">{p.share_pct} %</span>
                    {p.cost_dt != null && <span className="w-16 text-end font-bold tabular-nums text-ink">≈ {dt(p.cost_dt)}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="!p-4">
            <CardHeader title={L("Mesures PZEM-004T", "PZEM-004T readings", "قياسات PZEM-004T")} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                [L("Tension", "Voltage", "الجهد"), live?.voltage_v != null ? volts(live.voltage_v) : "—"],
                [L("Courant", "Current", "التيار"), live?.current_a != null ? amps(live.current_a) : "—"],
                [L("Facteur de puiss.", "Power factor", "معامل القوة"), live?.power_factor != null ? num(live.power_factor, 2) : "—"],
                [L("Fréquence", "Frequency", "التردد"), live?.frequency_hz != null ? hertz(live.frequency_hz) : "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12px] text-mute">{k}</dt>
                  <dd className={cx("text-[14px] font-bold text-ink tabular-nums")}>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
