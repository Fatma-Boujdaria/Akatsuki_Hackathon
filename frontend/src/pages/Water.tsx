import { Droplet, Moon, ShieldCheck } from "lucide-react";
import { useData } from "../lib/data";
import { useMonthSeries, useTodaySeries } from "../lib/series";
import { useNow } from "../lib/usePoll";
import { api } from "../lib/api";
import { dt, dtRound, flow, litres, m3, monthName, num } from "../lib/format";
import { Button, ButtonLink, Card, Divider, Estimation, IconTile, Label, PageHeader, Skeleton } from "../components/ui";
import { Banner, DevicePill, LiveCard, LiveFooter, liveStatus } from "../components/status";
import { DayCharts } from "../components/charts/DayCharts";
import { WaterMonthBars } from "../components/charts/WaterMonthBars";
import { dateLabel } from "./Home";
import { useState } from "react";

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function WaterPage() {
  const { dashboard, settings } = useData();
  const nowMs = useNow(5000);
  const now = new Date(nowMs);
  const today = useTodaySeries("water");
  const month = useMonthSeries("water");
  const [acking, setAcking] = useState(false);
  const d = dashboard.data;
  const w = d?.water;
  const status = liveStatus(d?.live ?? null, "water");
  const leak = d?.active_alerts.find((a) => a.type === "leak");
  const s = settings.data;

  return (
    <>
      <PageHeader label={dateLabel(now)} title="Eau" aside={d ? <DevicePill live={d.live} device={d.device} /> : undefined} />

      <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-12">
        {leak && (
          <div className="lg:col-span-12">
            <Banner
              tone="broken"
              title="Fuite probable"
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
                  J'ai vérifié
                </Button>
              }
            >
              {leak.message}
            </Banner>
          </div>
        )}

        <Card className="lg:col-span-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <Label as="h2">Eau · {monthName(now)}</Label>
          </div>
          {w ? (
            <>
              <p className="t-body text-[19px] text-body">Ce mois-ci</p>
              <p className="t-hero my-1 text-ink">{litres(w.month_l)}</p>
              <p className="t-body text-body">soit {m3(w.month_l / 1000)}</p>
              <Divider className="my-5" />
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <Label as="dt">Fin du mois</Label>
                  <dd className="t-h1 mt-1 text-ink">
                    {w.forecast.available && w.forecast.qty != null ? `≈ ${num(Math.round(w.forecast.qty))} L` : "—"}
                  </dd>
                </div>
                <div>
                  <Label as="dt">Facture SONEDE</Label>
                  <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                    {w.tariff_configured && w.forecast.bill ? (
                      <>
                        <span className="t-h1 text-ink">{dtRound(w.forecast.bill.total_dt)}</span>
                        <Estimation />
                      </>
                    ) : (
                      <span className="t-small text-mute">grille pas encore saisie</span>
                    )}
                  </dd>
                </div>
              </dl>
              {w.tariff_configured && w.bill_to_date && (
                <p className="mt-3 text-[13px] text-mute">À ce jour : ≈ {dt(w.bill_to_date.total_dt)} (estimation).</p>
              )}
            </>
          ) : (
            <Skeleton className="h-52" />
          )}
        </Card>

        <div className="grid grid-cols-1 content-start gap-4 sm:gap-5 lg:col-span-5">
          <LiveCard
            tone="water"
            icon={<Droplet size={18} strokeWidth={1.5} />}
            label="Débit"
            value={d?.live?.water.flow_l_min != null ? flow(d.live.water.flow_l_min) : null}
            status={status}
            footer={<LiveFooter status={status} live={d?.live ?? null} />}
          />
          <Card className="!p-5">
            <div className="flex items-start gap-3">
              <IconTile tone={leak ? "neutral" : "water"} size={36}>
                {leak ? <Moon size={18} strokeWidth={1.5} /> : <ShieldCheck size={18} strokeWidth={1.5} />}
              </IconTile>
              <div className="min-w-0">
                <p className="t-h3 text-ink">{leak ? "Surveillance de nuit : fuite signalée" : "Aucune fuite détectée"}</p>
                <p className="t-small mt-1 text-body">
                  {s
                    ? `Entre ${hh(s.leak_start_hour)} et ${hh(s.leak_end_hour)}, une eau qui coule sans arrêt pendant ${s.leak_min_minutes >= 60 ? `${num(s.leak_min_minutes / 60, 1, false)} h` : `${s.leak_min_minutes} min`} déclenche une alerte.`
                    : "La box surveille l'eau la nuit, quand personne ne devrait en utiliser."}
                </p>
                <ButtonLink to="/reglages#fuites" variant="ghost" className="mt-2 -ml-3 !px-3">
                  Régler la surveillance
                </ButtonLink>
              </div>
            </div>
          </Card>
          {d?.live?.water.total_l != null && (
            <Card className="!p-5">
              <Label>Compteur YF-S201</Label>
              <p className="t-data mt-1.5 text-ink">{litres(d.live.water.total_l)} depuis l'installation</p>
              {d.device && <p className="mt-1 font-mono text-[12px] text-mute">{num(d.device.calib_pulses_per_l)} impulsions / L</p>}
            </Card>
          )}
        </div>

        {w && !w.tariff_configured && (
          <div className="lg:col-span-12">
            <Banner tone="info">
              La grille SONEDE n'est pas encore saisie : les montants en DT de l'eau et l'alerte de tranche d'eau
              s'activeront dès qu'elle le sera (Réglages, grille tarifaire).
            </Banner>
          </div>
        )}

        <div className="lg:col-span-7">
          <DayCharts
            show="flow"
            title="Débit aujourd'hui"
            power={null}
            water={today.data}
            livePower={null}
            liveFlow={d?.live?.water.flow_l_min ?? null}
            now={new Date(d?.live?.ts ?? nowMs)}
          />
        </div>
        <div className="lg:col-span-5">
          <WaterMonthBars series={month.data} now={now} />
        </div>
      </div>
    </>
  );
}
