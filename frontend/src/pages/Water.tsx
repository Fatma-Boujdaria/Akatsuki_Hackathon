import { useMemo, useState } from "react";
import { Droplet, ShieldCheck } from "lucide-react";
import { useData } from "../lib/data";
import { useMonthSeries, useTodaySeries } from "../lib/series";
import { useNow } from "../lib/usePoll";
import { api } from "../lib/api";
import { L } from "../lib/i18n";
import { dt, dtRound, litres, m3, num, shortAge } from "../lib/format";
import { alertText } from "../components/alerts";
import { Button, ButtonLink, Card, CardHeader, Estimation, IconTile, PageHeader, Segmented, Skeleton, cx } from "../components/ui";
import { Banner } from "../components/status";
import { DayCharts } from "../components/charts/DayCharts";
import { WaterMonthBars } from "../components/charts/WaterMonthBars";

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** "Litres par heure" bars of the design (today, local hours). */
function HourlyBars({ points }: { points: { ts: string; volume_l: number | null }[] }) {
  const hours = useMemo(() => {
    const out = Array<number>(24).fill(0);
    for (const p of points) {
      const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Africa/Tunis" }).format(new Date(p.ts)));
      out[h] += p.volume_l ?? 0;
    }
    return out;
  }, [points]);
  const max = Math.max(1, ...hours);
  const nowH = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Africa/Tunis" }).format(new Date()));
  return (
    <div dir="ltr">
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={L("Consommation d'eau par heure aujourd'hui", "Water use per hour today", "استهلاك الماء في كل ساعة اليوم")}>
        {hours.map((v, h) => (
          <div
            key={h}
            title={`${hh(h)} · ${num(v)} L`}
            className={cx("flex-1 rounded-[2px]", v === 0 ? "bg-hairline" : h === nowH ? "bg-bahr ring-[1.5px] ring-water" : "bg-water")}
            style={{ height: `${v === 0 ? 4 : Math.max(8, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-mute">
        <span>00 h</span>
        <span>06 h</span>
        <span>12 h</span>
        <span>18 h</span>
        <span>24 h</span>
      </div>
    </div>
  );
}

export function WaterPage() {
  const { dashboard, settings } = useData();
  const nowMs = useNow(1000);
  const now = new Date(nowMs);
  const today = useTodaySeries("water");
  const month = useMonthSeries("water");
  const [view, setView] = useState<"day" | "month">("day");
  const [acking, setAcking] = useState(false);
  const d = dashboard.data;
  const w = d?.water;
  const live = d?.live?.water;
  const leak = d?.active_alerts.find((a) => a.type === "leak");
  const s = settings.data;
  const stale = !!d?.live?.stale || !d?.device?.online;
  const ageS = d?.live ? d.live.age_s + Math.max(0, (nowMs - (dashboard.updatedAt ?? nowMs)) / 1000) : null;
  const todayL = useMemo(() => (today.data?.points ?? []).reduce((sum, p) => sum + (p.volume_l ?? 0), 0), [today.data]);

  return (
    <>
      <PageHeader
        title={L("Eau", "Water", "الماء")}
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
          {leak && (
            <Banner
              tone="broken"
              title={L("Fuite probable", "Probable leak", "تسريب محتمل")}
              icon={<Droplet size={20} strokeWidth={1.75} className="text-grenade" />}
              role="alert"
              actions={
                <Button
                  variant="secondary"
                  disabled={acking}
                  onClick={async () => {
                    setAcking(true);
                    try {
                      await api.ackAlert(leak.id);
                      await dashboard.refresh();
                    } finally {
                      setAcking(false);
                    }
                  }}
                >
                  {L("J'ai vérifié", "I checked", "ثبّتت")}
                </Button>
              }
            >
              {alertText(leak)}
            </Banner>
          )}

          <div className="flex min-h-24 items-center justify-between rounded-card bg-surface px-[18px] py-3.5">
            <div>
              <p className="text-[13px] text-mute">{stale ? L("Dernier débit reçu", "Last flow received", "آخر دبي وصل") : L("Débit en direct", "Live flow", "الدبي مباشرة")}</p>
              {live && !live.reliable ? (
                <p className="text-[22px] leading-[40px] font-extrabold text-harissa">{live.fault ? L("Capteur en panne", "Sensor fault", "الكابتور معطّل") : L("Mesure peu fiable", "Unreliable reading", "قياس موش مضمون")}</p>
              ) : (
                <p dir="ltr" className={cx("text-start text-[36px] leading-[40px] font-extrabold tabular-nums", stale ? "text-mute" : "text-water-ink")}>{live?.flow_l_min != null ? `${num(live.flow_l_min, 1)} L/min` : "—"}</p>
              )}
              <p className="text-[12px] text-mute">
                {ageS != null ? `${L("Mis à jour il y a", "Updated", "تحدّث قبل")} ${shortAge(ageS)}${L("", " ago", "")}` : L("En attente de mesure", "Waiting for a reading", "نستنّاو في القياس")}
              </p>
            </div>
            <div className="text-end">
              <p className="text-[13px] text-mute">{L("Aujourd'hui", "Today", "اليوم")}</p>
              <p className="text-[22px] font-extrabold tabular-nums text-ink">{litres(todayL)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5">
            <IconTile tone={leak ? "danger" : "success"}>{leak ? <Droplet size={20} /> : <ShieldCheck size={20} />}</IconTile>
            <div className="min-w-0">
              <p className={cx("text-[15px] font-bold", leak ? "text-grenade" : "text-ink")}>
                {leak ? L("Fuite signalée cette nuit", "Leak reported tonight", "تسريب الليلة") : L("Aucune fuite détectée", "No leak detected", "ما فماش تسريب")}
              </p>
              <p className="text-[13px] text-mute">
                {s
                  ? L(
                      `Surveillance de ${hh(s.leak_start_hour)} à ${hh(s.leak_end_hour)}, alerte après ${s.leak_min_minutes} min de débit continu.`,
                      `Watched from ${hh(s.leak_start_hour)} to ${hh(s.leak_end_hour)}, alert after ${s.leak_min_minutes} min of continuous flow.`,
                      `مراقبة من ${hh(s.leak_start_hour)} لـ ${hh(s.leak_end_hour)}، تنبيه بعد ${s.leak_min_minutes} دقيقة دبي متواصل.`,
                    )
                  : L("La box surveille l'eau la nuit.", "The box watches water at night.", "البواطة تراقب الماء في الليل.")}
              </p>
            </div>
          </div>

          {view === "day" ? (
            <Card className="!p-4">
              <CardHeader title={L("Litres par heure", "Litres per hour", "لترات في الساعة")} />
              {today.data ? <HourlyBars points={today.data.points} /> : <Skeleton className="h-28" />}
            </Card>
          ) : (
            <WaterMonthBars series={month.data} now={now} />
          )}

          {view === "day" && (
            <DayCharts
              show="flow"
              title={L("Débit aujourd'hui", "Flow today", "الدبي اليوم")}
              power={null}
              water={today.data}
              livePower={null}
              liveFlow={live?.flow_l_min ?? null}
              now={new Date(d?.live?.ts ?? nowMs)}
            />
          )}
        </div>

        <div className="space-y-3 lg:col-span-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card bg-surface p-4">
              <p className="text-[13px] text-mute">{L("Ce mois", "This month", "هالشهر")}</p>
              <p className="text-[22px] font-extrabold tabular-nums text-ink">{w ? m3(w.month_l / 1000) : "—"}</p>
            </div>
            <div className="rounded-card bg-surface p-4">
              <p className="text-[13px] text-mute">{L("Prévision (estimation)", "Forecast (estimate)", "التوقّع (تقدير)")}</p>
              <p className="text-[22px] font-extrabold tabular-nums text-water-ink">{w?.forecast.qty != null ? m3(w.forecast.qty / 1000) : "—"}</p>
            </div>
          </div>

          {w && w.tariff_configured ? (
            <Card className="!p-4">
              <CardHeader title={L("Facture SONEDE", "SONEDE bill", "فاتورة SONEDE")} aside={<Estimation />} />
              <p className="text-[13px] text-mute">
                {L("À ce jour", "So far", "لتوّا")} : <strong className="text-ink">{w.bill_to_date ? `≈ ${dt(w.bill_to_date.total_dt)}` : "—"}</strong>
              </p>
              <p className="mt-1 text-[13px] text-mute">
                {L("Fin du mois", "End of month", "آخر الشهر")} : <strong className="text-water-ink">{w.forecast.bill ? dtRound(w.forecast.bill.total_dt) : "—"}</strong>
              </p>
            </Card>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface px-4 py-3.5">
              <div className="min-w-[12rem] flex-1">
                <p className="text-[15px] font-bold text-ink">{L("Tranches SONEDE", "SONEDE tranches", "شرائح SONEDE")}</p>
                <p className="text-[13px] text-mute">
                  {L("Grille pas encore vérifiée : pas de montant ni d'alerte de tranche eau.", "Grid not verified yet: no water amount or tranche alert.", "الجدول مازال ما تثبّتش: ما فماش مبلغ ولا تنبيه شريحة.")}
                </p>
              </div>
              <ButtonLink to="/aide" variant="secondary" className="shrink-0">
                {L("En savoir plus", "Learn more", "اعرف أكثر")}
              </ButtonLink>
            </div>
          )}

          {live?.total_l != null && (
            <Card className="!p-4">
              <CardHeader title={L("Compteur YF-S201", "YF-S201 counter", "كونتور YF-S201")} />
              <p className="text-[14px] font-bold text-ink">
                {litres(live.total_l)} {L("depuis l'installation", "since installation", "من التركيب")}
              </p>
              {d?.device && <p className="mt-1 text-[12px] text-mute">{num(d.device.calib_pulses_per_l)} {L("impulsions / L", "pulses / L", "نبضة / لتر")}</p>}
            </Card>
          )}

          <ButtonLink to="/reglages#fuites" variant="secondary" className="w-full">
            {L("Régler la surveillance des fuites", "Set up leak watch", "اضبط مراقبة التسريب")}
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
