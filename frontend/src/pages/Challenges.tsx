import type { ReactNode } from "react";
import { Activity, Award, Droplet, Lock, Moon, Sun, Trophy, Users } from "lucide-react";
import { api } from "../lib/api";
import { usePoll, useNow } from "../lib/usePoll";
import { dayMonth, kwh, kwhValue, num, weekdayShort } from "../lib/format";
import { Banner, Pill } from "../components/status";
import { Card, CardHeader, Label, PageHeader, Skeleton, cx } from "../components/ui";
import type { Badge, DayScore } from "../lib/types";
import { dateLabel } from "./Home";
import { L } from "../lib/i18n";

/** Score ring of the design (124 px, Chams arc on the card colour). */
function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? "var(--success)" : score >= 40 ? "var(--chams)" : "var(--grenade)";
  return (
    <div className="relative size-[124px] shrink-0">
      <svg width="124" height="124" viewBox="0 0 124 124" role="img" aria-label={L(`Score du jour ${score} sur 100`, `Today's score ${score} out of 100`, `سكور اليوم ${score} على 100`)}>
        <circle cx="62" cy="62" r={r} fill="none" stroke="var(--hairline)" strokeWidth="12" />
        <circle cx="62" cy="62" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 62 62)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[34px] leading-9 font-extrabold text-ink tabular-nums">{score}</span>
        <span className="text-[12px] text-mute">{L("sur 100", "out of 100", "على 100")}</span>
      </div>
    </div>
  );
}

function scoreWord(score: number): string {
  if (score >= 85) return L("Très bonne journée", "Great day", "نهار ممتاز");
  if (score >= 70) return L("Bonne journée", "Good day", "نهار باهي");
  if (score >= 40) return L("Peut mieux faire", "Could do better", "تنجم تعمل خير");
  return L("Journée chargée", "Heavy day", "نهار ثقيل");
}

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
            className={cx("absolute inset-y-0 start-0 rounded-full border", over ? "border-harissa bg-harissa" : "border-elec-stroke bg-elec")}
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
        <p className="mt-1 text-[12px] text-mute tabular-nums">
          {kwhValue(day.kwh)} kWh{budget != null ? ` / ${L("budget", "budget", "الميزانية")} ${kwhValue(budget)}` : ""}
          {isToday ? ` · ${L("en cours", "in progress", "جاري")}` : ""}
        </p>
      </div>
      <span className={cx("text-end font-display text-[20px] font-extrabold tabular-nums", over ? "text-harissa" : "text-ink")}>{day.score}</span>
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
      <PageHeader label={dateLabel(new Date(nowMs))} title={L("Défis", "Challenges", "التحديات")} />
      {!sc ? (
        score.error ? (
          <Banner tone="broken" title={L("Impossible de charger les défis", "Could not load the challenges", "ما نجّمناش نحمّلو التحديات")}>{score.error}</Banner>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Skeleton className="h-64 lg:col-span-5" />
            <Skeleton className="h-64 lg:col-span-7" />
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            {today ? (
              <>
                <div className="flex items-center gap-4">
                  <ScoreRing score={today.score} />
                  <div>
                    <p className="text-[13px] text-mute">{L("Score du jour", "Today's score", "سكور اليوم")}</p>
                    <p className="text-[18px] font-extrabold text-ink">{scoreWord(today.score)}</p>
                    <p className="mt-1 text-[13px] text-body">
                      {today.budget_kwh != null
                        ? L(
                            `${kwh(today.kwh)} aujourd'hui, budget ${kwh(today.budget_kwh)} par jour.`,
                            `${kwh(today.kwh)} today, budget ${kwh(today.budget_kwh)} a day.`,
                            `${kwh(today.kwh)} اليوم، الميزانية ${kwh(today.budget_kwh)} في النهار.`,
                          )
                        : L(`${kwh(today.kwh)} aujourd'hui.`, `${kwh(today.kwh)} today.`, `${kwh(today.kwh)} اليوم.`)}
                    </p>
                  </div>
                </div>
                <p className="t-small mt-4 text-mute">
                  {L(
                    "Le budget du jour est ce qui garde le mois sous la tranche suivante. Le score ne descend jamais sous 20.",
                    "The daily budget keeps the month under the next tranche. The score never drops below 20.",
                    "ميزانية النهار هي اللي تخلّي الشهر تحت الشريحة الجاية. السكور عمرو ما ينزل تحت 20.",
                  )}
                </p>
              </>
            ) : (
              <p className="t-small text-mute">{L("Le score arrive après la première mesure.", "The score arrives after the first reading.", "السكور يجي بعد أول قياس.")}</p>
            )}
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader title={L("7 derniers jours", "Last 7 days", "آخر 7 أيام")} aside="kWh · score" />
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
                  <Pill tone="live">{L("Réussi pour l'instant", "On track so far", "ماشي مليح لتوّا")}</Pill>
                ) : ch.status === "pas_assez_de_donnees" ? (
                  <Pill tone="neutral">{L("Pas encore assez de mesures", "Not enough readings yet", "مازال ما فماش قياسات كافية")}</Pill>
                ) : (
                  <Pill tone="neutral">{L("En cours", "In progress", "جاري")}</Pill>
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
                        aria-label={L(`${kwhValue(ch.current_kwh)} kWh cette semaine, objectif ${kwhValue(ch.target_kwh)} kWh`, `${kwhValue(ch.current_kwh)} kWh this week, target ${kwhValue(ch.target_kwh)} kWh`, `${kwhValue(ch.current_kwh)} kWh هالجمعة، الهدف ${kwhValue(ch.target_kwh)} kWh`)}
                        aria-valuemin={0}
                        aria-valuemax={Math.round(max)}
                        aria-valuenow={Math.round(ch.current_kwh)}
                        className="relative h-3.5 rounded-full bg-sunken"
                      >
                        <div
                          className="absolute inset-y-0 start-0 rounded-full border border-elec-stroke bg-elec"
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
                  <div className="mt-2 flex justify-between text-[13px] text-mute tabular-nums">
                    <span>{kwh(ch.current_kwh)} {L("cette semaine", "this week", "هالجمعة")}</span>
                    <span>{L("objectif", "target", "الهدف")} &lt; {kwh(ch.target_kwh)}</span>
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
                <Label>{L("Classement · foyers similaires", "Ranking · similar homes", "الترتيب · ديار شبيهة")}</Label>
                <p className="t-h1 mt-1 text-ink">{L("mieux que", "better than", "خير من")} {num(sc.ranking.better_than_pct)} %</p>
                <p className="t-small mt-1 text-body">{sc.ranking.label}</p>
                {sc.ranking.is_mock && (
                  <p className="mt-2 text-[11px] font-semibold text-mute">
                    {L("simulation", "simulation", "محاكاة")} · {sc.ranking.similar_homes} {L("foyers fictifs, classement anonyme", "fictional homes, anonymous ranking", "ديار وهمية، ترتيب بلا أسامي")}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-12">
            <CardHeader
              title={L("Badges", "Badges", "الشارات")}
              aside={
                <Label as="span">
                  {sc.badges.filter((b) => b.earned).length} / {sc.badges.length} {L("obtenus", "earned", "ربحتهم")}
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
