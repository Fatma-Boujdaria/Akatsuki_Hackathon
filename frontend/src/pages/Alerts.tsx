import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BellOff, CheckCheck, Droplet, Lightbulb, Moon, Plug, Sparkles, Thermometer, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { useData } from "../lib/data";
import { useHouseholds } from "../lib/households";
import { usePoll } from "../lib/usePoll";
import { L } from "../lib/i18n";
import { dateTime, dt } from "../lib/format";
import { alertKind, alertLook, alertText, sortAlerts, tipText } from "../components/alerts";
import { Banner } from "../components/status";
import { Button, Card, Chip, IconTile, PageHeader, Skeleton, cx } from "../components/ui";
import type { Alert, Notification, Tip } from "../lib/types";

type View = "tout" | "alertes" | "conseils" | "historique";

function tipIcon(code: string) {
  switch (code) {
    case "threshold":
    case "keep_pace":
      return <TrendingUp size={20} strokeWidth={1.8} />;
    case "leak":
      return <Droplet size={20} strokeWidth={1.8} />;
    case "standby":
      return <Moon size={20} strokeWidth={1.8} />;
    case "appliance":
      return <Plug size={20} strokeWidth={1.8} />;
    case "ac":
    case "water_heater":
      return <Thermometer size={20} strokeWidth={1.8} />;
    default:
      return <Lightbulb size={20} strokeWidth={1.8} />;
  }
}

function TipCard({ tip }: { tip: Tip }) {
  const saving = tip.saving_dt ?? 0;
  return (
    <li className="flex items-center gap-3 rounded-card bg-surface px-4 py-3.5">
      <IconTile tone="tile">{tipIcon(tip.code)}</IconTile>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-[21px] font-bold text-ink">{tipText(tip)}</p>
        {saving > 0 ? (
          <p className="mt-0.5 text-[13px] font-bold text-success">
            ≈ {dt(saving)} {tip.code === "keep_pace" ? L("de surcoût évité", "extra cost avoided", "زيادة تتفادى") : L("gagnés ce mois", "saved this month", "توفير هالشهر")}{" "}
            <span className="font-medium text-mute">· {L("estimation", "estimate", "تقدير")}</span>
          </p>
        ) : tip.code === "offpeak" ? (
          <p className="mt-0.5 text-[13px] text-mute">{L("Pas d'économie sur ta facture.", "No saving on your bill.", "ما يوفّرش في الفاتورة.")}</p>
        ) : null}
        {tip.source === "llm" && (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-mute">
            <Sparkles size={12} aria-hidden /> {L("reformulé par IA · chiffres calculés", "worded by AI · figures computed", "صياغة بالذكاء الاصطناعي · الأرقام محسوبة")}
          </p>
        )}
      </div>
    </li>
  );
}

function ActiveAlert({ alert, onAck, busy }: { alert: Alert; onAck: () => void; busy: boolean }) {
  const { tranche } = useData();
  const navigate = useNavigate();
  const look = alertLook(alert, tranche);
  return (
    <Banner
      tone={look.tone}
      title={look.title}
      icon={look.icon}
      role="alert"
      actions={
        <>
          {alert.type === "threshold" && (
            <Button onClick={() => document.getElementById("conseils")?.scrollIntoView({ behavior: "smooth" })}>
              {L("Voir le conseil", "See the tip", "شوف النصيحة")}
            </Button>
          )}
          {alert.type === "leak" && <Button onClick={() => navigate("/eau")}>{L("Voir l'eau", "See water", "شوف الماء")}</Button>}
          <Button variant="secondary" disabled={busy} onClick={onAck}>
            {alert.type === "leak" ? L("J'ai vérifié", "I checked", "ثبّتت") : L("Marquer comme lu", "Mark as read", "علّم مقري")}
          </Button>
        </>
      }
    >
      {alertText(alert)}
      {alert.extra_cost_dt != null && alert.extra_cost_dt > 0 && (
        <span className="mt-1 block text-[12px] font-bold">
          {L("Surcoût estimé", "Estimated extra cost", "الزيادة المقدّرة")} : ≈ {dt(alert.extra_cost_dt)}
        </span>
      )}
      <span className="mt-1 block text-[12px] opacity-80">{dateTime(alert.created_at)}</span>
    </Banner>
  );
}

function HistoryList() {
  const { households } = useHouseholds();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [type, setType] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const list = usePoll((s) => api.notifications(unreadOnly ? "unread" : "all", type, s), 30_000, [unreadOnly, type]);
  const { dashboard } = useData();

  const read = async (n: Notification) => {
    setBusy(n.id);
    try {
      await api.readNotification(n.id);
      await Promise.all([list.refresh(), dashboard.refresh()]);
    } finally {
      setBusy(null);
    }
  };

  const readAll = async () => {
    setBusy("all");
    try {
      await api.readAll();
      await Promise.all([list.refresh(), dashboard.refresh()]);
    } finally {
      setBusy(null);
    }
  };

  const types: { v: string; label: string }[] = [
    { v: "all", label: L("Tous types", "All types", "الكل") },
    { v: "threshold", label: L("Tranches", "Tranches", "الشرائح") },
    { v: "leak", label: L("Fuites", "Leaks", "التسريبات") },
    { v: "device_offline", label: L("Boîtier", "Box", "البواطة") },
    { v: "sensor_fault", label: L("Capteurs", "Sensors", "الكابتورات") },
  ];

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {types.map((t) => (
          <Chip key={t.v} active={type === t.v} onClick={() => setType(t.v)}>
            {t.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[14px] font-semibold text-body">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="size-5 accent-[var(--primary)]" />
          {L("Non lues seulement", "Unread only", "غير المقروّة برك")}
        </label>
        <Button variant="ghost" onClick={readAll} disabled={busy === "all"}>
          <CheckCheck size={18} aria-hidden /> {L("Tout marquer comme lu", "Mark all as read", "علّم الكل مقري")}
        </Button>
      </div>
      {!list.data ? (
        <Skeleton className="h-40" />
      ) : list.data.length === 0 ? (
        <Card className="flex flex-col items-center py-10 text-center">
          <BellOff size={28} className="text-mute" aria-hidden />
          <p className="mt-3 text-[14px] text-mute">{L("Aucune notification.", "No notifications.", "ما فماش إشعارات.")}</p>
        </Card>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-card bg-surface">
          {list.data.map((n) => {
            const unread = !n.acknowledged_at;
            return (
              <li key={n.id} className="flex gap-3 px-4 py-3">
                <span aria-hidden className={cx("mt-2 size-2 shrink-0 rounded-full", unread ? "bg-chams" : "bg-transparent")} />
                <div className="min-w-0 flex-1">
                  <p className={cx("text-[14px] text-ink", unread ? "font-bold" : "font-semibold")}>
                    {alertKind(n)}
                    {households.length > 1 && <span className="ms-2 text-[12px] font-medium text-mute">· {n.household_name}</span>}
                  </p>
                  <p className="mt-0.5 text-[13px] text-body">{alertText(n)}</p>
                  <p className="mt-1 text-[12px] text-mute">
                    {dateTime(n.created_at)}
                    {unread ? ` · ${L("non lue", "unread", "غير مقروّة")}` : ` · ${L("lue", "read", "مقروّة")}`}
                  </p>
                </div>
                {unread && (
                  <Button variant="ghost" className="shrink-0 self-center px-3" disabled={busy === n.id} onClick={() => read(n)} aria-label={L("Marquer comme lu", "Mark as read", "علّم مقري")}>
                    <CheckCheck size={18} aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AlertsPage() {
  const { dashboard } = useData();
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const initial = (params.get("vue") as View | null) ?? (hash === "#conseils" ? "conseils" : "tout");
  const [view, setViewState] = useState<View>(initial);
  const alertKey = (dashboard.data?.active_alerts ?? []).map((a) => a.id).join(",");
  const tips = usePoll((s) => api.tips(s), 30_000, [alertKey]);
  const [acking, setAcking] = useState<string | null>(null);

  const setView = (v: View) => {
    setViewState(v);
    setParams(v === "tout" ? {} : { vue: v }, { replace: true });
  };

  useEffect(() => {
    if (initial === "conseils") document.getElementById("conseils")?.scrollIntoView();
  }, [initial]);

  const active = sortAlerts(dashboard.data?.active_alerts ?? []);
  const tipList = tips.data ?? [];

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
      <PageHeader back="/" title={L("Alertes et conseils", "Alerts and tips", "التنبيهات والنصائح")} />
      <div className="no-scrollbar -mx-4 mb-3.5 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <Chip active={view === "tout"} onClick={() => setView("tout")}>
          {L("Tout", "All", "الكل")}
        </Chip>
        <Chip active={view === "alertes"} onClick={() => setView("alertes")}>
          {L("Alertes", "Alerts", "التنبيهات")} · {active.length}
        </Chip>
        <Chip active={view === "conseils"} onClick={() => setView("conseils")}>
          {L("Conseils", "Tips", "النصائح")} · {tipList.length}
        </Chip>
        <Chip active={view === "historique"} onClick={() => setView("historique")}>
          {L("Historique", "History", "التاريخ")}
        </Chip>
      </div>

      {view === "historique" ? (
        <HistoryList />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
          {view !== "conseils" && (
            <div className="space-y-3">
              {active.length === 0 ? (
                <Card className="flex items-center gap-3">
                  <IconTile tone="success">
                    <CheckCheck size={20} />
                  </IconTile>
                  <p className="text-[14px] font-semibold text-ink">{L("Aucune alerte en cours. Tout va bien.", "No active alert. All good.", "ما فماش تنبيه. كل شي لاباس.")}</p>
                </Card>
              ) : (
                active.map((a) => <ActiveAlert key={a.id} alert={a} busy={acking === a.id} onAck={() => ack(a)} />)
              )}
              <button type="button" onClick={() => setView("historique")} className="cursor-pointer px-1 text-[13px] font-bold text-link">
                {L("Voir l'historique des notifications", "See the notification history", "شوف تاريخ الإشعارات")}
              </button>
            </div>
          )}
          {view !== "alertes" && (
            <section id="conseils" className="scroll-mt-24">
              <h2 className="sr-only">{L("Conseils", "Tips", "النصائح")}</h2>
              {!tips.data ? (
                <Skeleton className="h-40" />
              ) : (
                <ul className="space-y-3">
                  {tipList.map((t) => (
                    <TipCard key={t.id} tip={t} />
                  ))}
                </ul>
              )}
              <p className="mt-3 px-1 text-[12px] text-mute">
                {L(
                  "Les économies sont calculées avec les tarifs enregistrés, jamais par l'IA. Les conseils « profil » se basent sur les appareils que tu as déclarés.",
                  "Savings are computed with the stored tariffs, never by the AI. \"Profile\" tips are based on the appliances you declared.",
                  "التوفير محسوب بالأسوام المسجّلة، موش بالذكاء الاصطناعي. نصائح البروفيل على حساب الآلات اللي صرّحت بيها.",
                )}
              </p>
            </section>
          )}
        </div>
      )}
    </>
  );
}
