import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BellOff, Check, Droplet, Lightbulb, Moon, Plug, Sparkles, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { useData } from "../lib/data";
import { usePoll, useNow } from "../lib/usePoll";
import { dateTime, dt } from "../lib/format";
import { alertKind, alertLook, sortAlerts } from "../components/alerts";
import { Banner } from "../components/status";
import { Button, Card, IconTile, Label, PageHeader, Skeleton, cx } from "../components/ui";
import type { Alert, Tip } from "../lib/types";
import { dateLabel } from "./Home";

function tipIcon(code: string) {
  switch (code) {
    case "threshold":
    case "keep_pace":
      return <TrendingUp size={18} strokeWidth={1.5} />;
    case "leak":
      return <Droplet size={18} strokeWidth={1.5} />;
    case "standby":
      return <Moon size={18} strokeWidth={1.5} />;
    case "appliance":
      return <Plug size={18} strokeWidth={1.5} />;
    default:
      return <Lightbulb size={18} strokeWidth={1.5} />;
  }
}

function TipCard({ tip, highlight }: { tip: Tip; highlight: boolean }) {
  const saving = tip.saving_dt ?? 0;
  return (
    <li
      className={cx(
        "flex gap-3 rounded-card border bg-surface p-4 sm:p-5",
        highlight ? "border-primary" : "border-hairline",
      )}
    >
      <IconTile tone={tip.code === "leak" ? "water" : "neutral"} size={36}>
        {tipIcon(tip.code)}
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="t-body text-body">{tip.text}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {saving > 0 ? (
            <span className="text-[14px] font-semibold text-primary">
              {tip.code === "keep_pace" ? "Surcoût évité" : "Économie"} ≈ {dt(saving)}{" "}
              <span className="font-normal text-mute">estimation</span>
            </span>
          ) : tip.code === "offpeak" ? (
            <span className="text-[14px] text-mute">Ne change pas ta facture</span>
          ) : null}
          {tip.source === "llm" && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.04em] text-mute uppercase">
              <Sparkles size={12} strokeWidth={1.5} aria-hidden /> reformulé par IA · chiffres calculés
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function AlertsPage() {
  const { dashboard, tranche } = useData();
  const nowMs = useNow(30_000);
  const all = usePoll((s) => api.alerts("all", s), 10_000);
  const tips = usePoll((s) => api.tips(s), 60_000);
  const [busy, setBusy] = useState<string | null>(null);
  const { hash } = useLocation();

  useEffect(() => {
    if (hash === "#conseils" && tips.data) {
      const el = document.getElementById("conseils");
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.5) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [hash, tips.data]);

  const active = sortAlerts((all.data ?? []).filter((a) => !a.acknowledged_at));
  const past = (all.data ?? []).filter((a) => a.acknowledged_at);

  const ack = async (a: Alert) => {
    setBusy(a.id);
    try {
      await api.ackAlert(a.id);
      await Promise.all([all.refresh(), dashboard.refresh()]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader label={dateLabel(new Date(nowMs))} title="Alertes et conseils" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6">
        <section className="lg:col-span-7" aria-labelledby="en-cours">
          <h2 id="en-cours" className="t-h2 mb-4 text-ink">
            En cours
          </h2>
          {!all.data ? (
            all.error ? (
              <Banner tone="broken" title="Impossible de charger les alertes">{all.error}</Banner>
            ) : (
              <Skeleton className="h-32" />
            )
          ) : active.length === 0 ? (
            <Card className="flex items-center gap-3 !p-5">
              <IconTile tone="primary" size={36}>
                <Check size={18} strokeWidth={1.75} />
              </IconTile>
              <div>
                <p className="t-h3 text-ink">Rien à signaler</p>
                <p className="t-small text-mute">Aucune alerte active. Tranche Guard veille.</p>
              </div>
            </Card>
          ) : (
            <ul className="space-y-4">
              {active.map((a) => {
                const look = alertLook(a, tranche);
                return (
                  <li key={a.id}>
                    <Banner
                      tone={look.tone}
                      title={look.title}
                      icon={look.icon}
                      actions={
                        <Button variant="secondary" disabled={busy === a.id} onClick={() => ack(a)}>
                          Marquer comme vu
                        </Button>
                      }
                    >
                      <p>{a.message}</p>
                      <p className="mt-2 font-mono text-[12px] text-mute">{dateTime(a.created_at)}</p>
                    </Banner>
                  </li>
                );
              })}
            </ul>
          )}

          <h2 className="t-h2 mt-10 mb-4 text-ink">Historique</h2>
          {past.length === 0 ? (
            <p className="t-small flex items-center gap-2 text-mute">
              <BellOff size={16} strokeWidth={1.5} aria-hidden /> Aucune alerte passée.
            </p>
          ) : (
            <Card className="!p-0">
              <ul className="divide-y divide-hairline">
                {past.slice(0, 20).map((a) => {
                  const look = alertLook(a);
                  return (
                    <li key={a.id} className="flex gap-3 px-5 py-4">
                      <span className="mt-0.5 shrink-0 opacity-80" aria-hidden>
                        {look.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="text-[15px] font-semibold text-ink">{alertKind(a)}</p>
                          <p className="font-mono text-[12px] text-mute">{dateTime(a.created_at)}</p>
                        </div>
                        <p className="t-small mt-0.5 text-body">{a.message}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>

        <section id="conseils" className="scroll-mt-24 lg:col-span-5" aria-labelledby="conseils-title">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 id="conseils-title" className="t-h2 text-ink">
              Conseils
            </h2>
            <Label as="span">DT · estimation</Label>
          </div>
          {!tips.data ? (
            <Skeleton className="h-48" />
          ) : tips.data.length === 0 ? (
            <p className="t-small text-mute">Les conseils arrivent après les premières mesures.</p>
          ) : (
            <ul className="space-y-3">
              {tips.data.map((t) => (
                <TipCard key={t.id} tip={t} highlight={hash === "#conseils" && (t.code === "threshold" || t.code === "keep_pace")} />
              ))}
            </ul>
          )}
          <p className="mt-4 text-[13px] leading-5 text-mute">
            Les économies sont calculées avec la grille tarifaire, jamais inventées. Elles restent des estimations.
          </p>
        </section>
      </div>
    </>
  );
}
