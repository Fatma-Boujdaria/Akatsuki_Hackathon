import type { ReactNode } from "react";
import { Activity, Award, Droplet, Lock, Moon, Sun, Trophy, Users } from "lucide-react";
import { api } from "../lib/api";
import { usePoll, useNow } from "../lib/usePoll";
import { dayMonth, kwh, kwhValue, num, weekdayShort } from "../lib/format";
import { Banner, Pill } from "../components/status";
import { Card, CardHeader, Label, PageHeader, Skeleton, cx } from "../components/ui";
import type { Badge, DayScore } from "../lib/types";
import { dateLabel } from "./Home";

// Badges reuse the icons inside a soft circle (board 05/06): earned in colour,
// locked as a dashed circle with a lock.
const BADGE_LOOK: Record<string, { icon: ReactNode; tone: string }> = {
  premiere_mesure: { icon: <Activity size={22} strokeWidth={1.5} />, tone: "bg-primary-soft text-primary" },
  journee_sobre: { icon: <Sun size={22} strokeWidth={1.5} />, tone: "bg-elec-soft text-elec-ink" },
  semaine_sobre: { icon: <Trophy size={22} strokeWidth={1.5} />, tone: "bg-elec-soft text-elec-ink" },
  zero_veille: { icon: <Moon size={22} strokeWidth={1.5} />, tone: "bg-primary-soft text-primary" },
  sous_le_seuil: { icon: <Award size={22} strokeWidth={1.5} />, tone: "bg-elec-soft text-elec-ink" },
  zero_fuite: { icon: <Droplet size={22} strokeWidth={1.5} />, tone: "bg-water-soft text-water-ink" },
};

function BadgeItem({ badge }: { badge: Badge }) {
  const look = BADGE_LOOK[badge.code] ?? { icon: <Award size={22} strokeWidth={1.5} />, tone: "bg-primary-soft text-primary" };
  return (
    <li className="flex flex-col items-center text-center" title={badge.description}>
      <span
        className={cx(
          "inline-flex size-14 items-center justify-center rounded-full",
          badge.earned ? look.tone : "border border-dashed border-control text-mute",
        )}
        aria-hidden
      >
        {badge.earned ? look.icon : <Lock size={20} strokeWidth={1.5} />}
      </span>
      <p className={cx("mt-2.5 text-[14px] leading-5", badge.earned ? "font-semibold text-ink" : "text-mute")}>{badge.label}</p>
      <p className="mt-0.5 text-[12px] leading-4 text-mute">{badge.description}</p>
      <span className="sr-only">{badge.earned ? "obtenu" : "à débloquer"}</span>
    </li>
  );
}

function DayRow({ day, isToday }: { day: DayScore; isToday: boolean }) {
  const budget = day.budget_kwh;
  const max = Math.max(day.kwh, budget ?? 0, 0.1) * 1.1;
  const over = budget != null && day.kwh > budget;
  const date = new Date(`${day.day}T12:00:00Z`);
  return (
    <li className="grid grid-cols-[64px_1fr_48px] items-center gap-3 py-2.5">
      <div className="font-mono text-[12px] leading-4 text-mute">
        <span className={cx("block uppercase", isToday && "font-semibold text-ink")}>{isToday ? "auj." : weekdayShort(date)}</span>
        {dayMonth(date)}
      </div>
      <div>
        <div className="relative h-2.5 rounded-full bg-sunken">
          <div
            className={cx("absolute inset-y-0 left-0 rounded-full border", over ? "border-harissa bg-harissa" : "border-elec-stroke bg-elec")}
            style={{ width: `${Math.min(100, (day.kwh / max) * 100)}%` }}
          />
          {budget != null && (
            <div
              aria-hidden
              className="absolute -top-1 -bottom-1 w-[2px] -translate-x-1/2 rounded-full bg-ink"
              style={{ left: `${Math.min(100, (budget / max) * 100)}%` }}
            />
          )}
        </div>
        <p className="mt-1 font-mono text-[12px] text-mute tabular-nums">
          {kwhValue(day.kwh)} kWh{budget != null ? ` / budget ${kwhValue(budget)}` : ""}
          {isToday ? " · en cours" : ""}
        </p>
      </div>
      <span className={cx("text-right font-display text-[20px] font-semibold tabular-nums", over ? "text-harissa" : "text-ink")}>{day.score}</span>
    </li>
  );
}

export function ChallengesPage() {
  const nowMs = useNow(60_000);
  const score = usePoll((s) => api.score(s), 60_000);
  const sc = score.data;
  const today = sc?.today;
  const ch = sc?.weekly_challenge;

  return (
    <>
      <PageHeader label={dateLabel(new Date(nowMs))} title="Défis" />
      {!sc ? (
        score.error ? (
          <Banner tone="broken" title="Impossible de charger les défis">{score.error}</Banner>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Skeleton className="h-64 lg:col-span-5" />
            <Skeleton className="h-64 lg:col-span-7" />
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            <Label as="h2" className="mb-5">Score du jour</Label>
            {today ? (
              <>
                <p className="t-hero text-ink">
                  {today.score}
                  <span className="ml-1 font-display text-[24px] tracking-normal text-mute">/100</span>
                </p>
                <p className="t-body mt-2 text-body">
                  {today.budget_kwh != null
                    ? `${kwh(today.kwh)} aujourd'hui pour un budget de ${kwh(today.budget_kwh)} par jour.`
                    : `${kwh(today.kwh)} aujourd'hui.`}
                </p>
                <p className="t-small mt-3 text-mute">
                  Le budget du jour est ce qui garde le mois sous la tranche suivante. Le score ne descend jamais sous 20.
                </p>
              </>
            ) : (
              <p className="t-small text-mute">Le score arrive après la première mesure.</p>
            )}
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader title="7 derniers jours" aside={<Label as="span">kWh · score</Label>} />
            <ul className="divide-y divide-hairline">
              {sc.history.map((d) => (
                <DayRow key={d.day} day={d} isToday={d.day === today?.day} />
              ))}
            </ul>
          </Card>

          {ch && (
            <Card className="lg:col-span-7">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <h2 className="t-h2 text-ink">{ch.title}</h2>
                {ch.status === "reussi" ? (
                  <Pill tone="live">Réussi pour l'instant</Pill>
                ) : ch.status === "pas_assez_de_donnees" ? (
                  <Pill tone="neutral">Pas encore assez de mesures</Pill>
                ) : (
                  <Pill tone="neutral">En cours</Pill>
                )}
              </div>
              <p className="t-body text-body">{ch.description}</p>
              {ch.target_kwh != null && (
                <div className="mt-5">
                  {(() => {
                    const max = Math.max(ch.target_kwh, ch.current_kwh) * 1.1;
                    return (
                      <div
                        role="meter"
                        aria-label={`${kwhValue(ch.current_kwh)} kWh cette semaine, objectif ${kwhValue(ch.target_kwh)} kWh`}
                        aria-valuemin={0}
                        aria-valuemax={Math.round(max)}
                        aria-valuenow={Math.round(ch.current_kwh)}
                        className="relative h-3.5 rounded-full bg-sunken"
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-full border border-elec-stroke bg-elec"
                          style={{ width: `${Math.min(100, (ch.current_kwh / max) * 100)}%` }}
                        />
                        <div
                          aria-hidden
                          className="absolute -top-1.5 -bottom-1.5 w-[2px] -translate-x-1/2 rounded-full bg-ink"
                          style={{ left: `${(ch.target_kwh / max) * 100}%` }}
                        />
                      </div>
                    );
                  })()}
                  <div className="mt-2 flex justify-between font-mono text-[13px] text-mute tabular-nums">
                    <span>{kwh(ch.current_kwh)} cette semaine</span>
                    <span>objectif &lt; {kwh(ch.target_kwh)}</span>
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card className="lg:col-span-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden>
                <Users size={20} strokeWidth={1.5} />
              </span>
              <div>
                <Label>Classement · foyers similaires</Label>
                <p className="t-h1 mt-1 text-ink">mieux que {num(sc.ranking.better_than_pct)} %</p>
                <p className="t-small mt-1 text-body">{sc.ranking.label}</p>
                {sc.ranking.is_mock && (
                  <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-mute uppercase">
                    simulation · {sc.ranking.similar_homes} foyers fictifs
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-12">
            <CardHeader
              title="Badges"
              aside={
                <Label as="span">
                  {sc.badges.filter((b) => b.earned).length} / {sc.badges.length} obtenus
                </Label>
              }
            />
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
              {sc.badges.map((b) => (
                <BadgeItem key={b.code} badge={b} />
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
