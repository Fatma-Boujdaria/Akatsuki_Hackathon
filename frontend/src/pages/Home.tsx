import { Link, useNavigate } from "react-router-dom";
import { Droplet, Lightbulb, Zap } from "lucide-react";
import { useData } from "../lib/data";
import { useNow } from "../lib/usePoll";
import { useTodaySeries } from "../lib/series";
import { api } from "../lib/api";
import { daysLeftInMonth } from "../lib/time";
import { dt, flow, watts, weekdayDayMonth } from "../lib/format";
import { HeroCard } from "../components/HeroCard";
import { Banner, LiveCard, LiveFooter, liveStatus } from "../components/status";
import { alertLook, sortAlerts } from "../components/alerts";
import { Button, ButtonLink, Card, Label, PageHeader, Skeleton } from "../components/ui";
import { DayCharts } from "../components/charts/DayCharts";
import { LogoMark } from "../components/Logo";
import { usePoll } from "../lib/usePoll";
import type { Alert } from "../lib/types";
import { useState } from "react";

export function dateLabel(now: Date): string {
  const left = daysLeftInMonth(now);
  return `${weekdayDayMonth(now)} · ${left === 0 ? "dernier jour" : `encore ${left} jour${left > 1 ? "s" : ""}`}`;
}

export function HomePage() {
  const { dashboard, tranche, snoozed, snooze } = useData();
  const nowMs = useNow(1000);
  const navigate = useNavigate();
  const d = dashboard.data;
  const power = useTodaySeries("electricity");
  const water = useTodaySeries("water");
  const alertKey = (d?.active_alerts ?? []).map((a) => a.id).join(",");
  const tips = usePoll((s) => api.tips(s), 20_000, [alertKey]);
  const [acking, setAcking] = useState<string | null>(null);

  const now = new Date(nowMs);
  const header = <PageHeader label={dateLabel(now)} title="Tableau de bord" />;

  if (!d) {
    return (
      <>
        {header}
        {dashboard.error ? (
          <Banner tone="broken" title="Impossible de charger le tableau de bord" role="alert">
            {dashboard.error}
          </Banner>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Skeleton className="h-[420px] lg:col-span-7" />
            <div className="grid grid-cols-1 content-start gap-4 lg:col-span-5">
              <Skeleton className="h-[150px]" />
              <Skeleton className="h-[132px]" />
            </div>
          </div>
        )}
      </>
    );
  }

  if (d.state === "empty") {
    return (
      <>
        {header}
        <Card className="flex flex-col items-center px-6 py-12 text-center">
          <LogoMark size={64} state="loading" />
          <h2 className="t-h2 mt-5 text-ink">En attente de la première mesure</h2>
          <p className="t-body mt-2 max-w-md text-body">
            Branche ta box Tranche Guard ou lance le simulateur. Le tableau de bord se remplit dès que la première mesure
            arrive.
          </p>
          <ButtonLink to="/reglages#demo" variant="secondary" className="mt-6">
            Contrôle démo
          </ButtonLink>
        </Card>
      </>
    );
  }

  // Seconds since the reading, counted locally between two polls.
  const ageS = d.live ? d.live.age_s + Math.max(0, (nowMs - (dashboard.updatedAt ?? nowMs)) / 1000) : undefined;
  const elecStatus = liveStatus(d.live, "electricity");
  const waterStatus = liveStatus(d.live, "water");
  const banners = sortAlerts(d.active_alerts.filter((a) => !snoozed.has(a.id))).slice(0, 2);
  const topTip = tips.data?.find((t) => t.code !== "offpeak") ?? tips.data?.[0];

  // With a banner on the right, the tip moves under the hero so both columns stay balanced.
  const tipUnderHero = banners.length > 0;
  const tipCard = topTip ? (
    <Card className="!p-5">
      <div className="flex gap-3">
        <span className="mt-0.5 text-ink" aria-hidden>
          <Lightbulb size={20} strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <Label>Conseil du moment</Label>
          <p className="t-body mt-1.5 text-body">{topTip.text}</p>
          {topTip.saving_dt != null && topTip.saving_dt > 0 && (
            <p className="mt-2 text-[14px] font-semibold text-primary">
              {topTip.code === "keep_pace" ? "Surcoût évité" : "Économie"} ≈ {dt(topTip.saving_dt)}{" "}
              <span className="font-normal text-mute">estimation</span>
            </p>
          )}
          <Link
            to="/alertes#conseils"
            className="mt-3 inline-flex min-h-11 items-center text-[15px] font-semibold text-primary hover:underline"
          >
            Tous les conseils
          </Link>
        </div>
      </div>
    </Card>
  ) : null;

  const ack = async (a: Alert) => {
    setAcking(a.id);
    try {
      await api.ackAlert(a.id);
      await dashboard.refresh();
    } finally {
      setAcking(null);
    }
  };

  return (
    <>
      {header}
      <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1">
          {tranche && <HeroCard data={d} view={tranche} ageS={ageS} />}
        </div>

        <div className="grid grid-cols-1 content-start gap-4 sm:gap-5 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          {banners.map((a) => {
            const look = alertLook(a, tranche);
            return (
              <Banner
                key={a.id}
                tone={look.tone}
                title={look.title}
                icon={look.icon}
                role="alert"
                actions={
                  a.type === "threshold" ? (
                    <>
                      <Button onClick={() => navigate("/alertes#conseils")}>Voir le conseil</Button>
                      <Button variant="secondary" onClick={() => snooze(a.id)}>
                        Plus tard
                      </Button>
                    </>
                  ) : a.type === "leak" ? (
                    <>
                      <Button onClick={() => navigate("/eau")}>Voir l'eau</Button>
                      <Button variant="secondary" disabled={acking === a.id} onClick={() => ack(a)}>
                        J'ai vérifié
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => navigate("/reglages#appareil")}>
                        Voir l'appareil
                      </Button>
                      <Button variant="ghost" onClick={() => snooze(a.id)}>
                        Plus tard
                      </Button>
                    </>
                  )
                }
              >
                {a.message}
              </Banner>
            );
          })}

          <div className="grid grid-cols-2 gap-4 sm:gap-5">
            <LiveCard
              tone="elec"
              icon={<Zap size={18} strokeWidth={1.5} />}
              label="Puissance"
              value={d.live?.electricity.power_w != null ? watts(d.live.electricity.power_w) : null}
              status={elecStatus}
              footer={<LiveFooter status={elecStatus} live={d.live} />}
            />
            <LiveCard
              tone="water"
              icon={<Droplet size={18} strokeWidth={1.5} />}
              label="Débit"
              value={d.live?.water.flow_l_min != null ? flow(d.live.water.flow_l_min) : null}
              status={waterStatus}
              footer={<LiveFooter status={waterStatus} live={d.live} />}
            />
          </div>

          {!tipUnderHero && tipCard}
        </div>

        {tipUnderHero && tipCard && <div className="lg:col-span-7 lg:col-start-1 lg:row-start-2">{tipCard}</div>}

        <div className="lg:col-span-12 lg:row-start-3">
          <DayCharts
            power={power.data}
            water={water.data}
            livePower={d.live?.electricity.power_w ?? null}
            liveFlow={d.live?.water.flow_l_min ?? null}
            now={new Date(d.live?.ts ?? d.generated_at)}
          />
        </div>
      </div>
    </>
  );
}
