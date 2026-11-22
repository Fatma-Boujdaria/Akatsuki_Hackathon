import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Droplet, Lightbulb, Sparkles, Trophy, Zap } from "lucide-react";
import { useData } from "../lib/data";
import { firstName, useAuth } from "../lib/auth";
import { useHouseholds } from "../lib/households";
import { useNow, usePoll } from "../lib/usePoll";
import { useTodaySeries } from "../lib/series";
import { api } from "../lib/api";
import { daysLeftInMonth } from "../lib/time";
import { dt, dtRound, dtUnit, kwh, kwhValue, litres, m3, num, weekdayDayMonth } from "../lib/format";
import { L } from "../lib/i18n";
import type { Alert, ConsumptionStatus, Dashboard, Insights } from "../lib/types";
import type { TrancheView } from "../lib/tranche";
import { Banner } from "../components/status";
import { alertLook, alertText, sortAlerts, tipText } from "../components/alerts";
import { Button, ButtonLink, Card, Chip, Estimation, IconTile, Skeleton, cx } from "../components/ui";
import { HouseScene, Sparkline, downsample } from "../components/HouseScene";
import { LogoMark } from "../components/Logo";

export function dateLabel(now: Date): string {
  const left = daysLeftInMonth(now);
  const rest =
    left === 0
      ? L("dernier jour", "last day", "آخر نهار")
      : L(`encore ${left} jour${left > 1 ? "s" : ""}`, `${left} day${left > 1 ? "s" : ""} left`, `باقي ${left} يوم`);
  return `${weekdayDayMonth(now)} · ${rest}`;
}

const STATUS: Record<ConsumptionStatus, { label: () => string; cls: string }> = {
  normal: { label: () => L("Normal", "Normal", "عادي"), cls: "bg-success-soft text-success" },
  attention: { label: () => L("Attention", "Attention", "رد بالك"), cls: "bg-water-soft text-water-ink" },
  warning: { label: () => L("Avertissement", "Warning", "تحذير"), cls: "bg-harissa-soft text-harissa" },
  critical: { label: () => L("Critique", "Critical", "خطير"), cls: "bg-grenade-soft text-grenade" },
  unavailable: { label: () => L("Mesure indisponible", "Reading unavailable", "القياس موش متوفر"), cls: "bg-sunken text-mute" },
};

export function StatusBadge({ status }: { status: ConsumptionStatus }) {
  const s = STATUS[status];
  return (
    <span className={cx("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold whitespace-nowrap", s.cls)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {s.label()}
    </span>
  );
}

function statusMessage(i: Insights | null, view: TrancheView | null): string | null {
  if (!i) return null;
  const r = new Set(i.status_reasons);
  if (r.has("no_data")) return L("En attente de la première mesure.", "Waiting for the first reading.", "نستنّاو في أول قياس.");
  if (r.has("offline")) return L("Le boîtier ne répond plus : les valeurs affichées sont anciennes.", "The box is not answering: values shown are old.", "البواطة ما تجاوبش: الأرقام قديمة.");
  if (r.has("unreliable")) return L("Dernière mesure peu fiable : aucune valeur inventée.", "Last reading unreliable: no made-up value.", "آخر قياس موش مضمون: ما نخترعو حتى رقم.");
  if (r.has("leak")) return L("Fuite d'eau probable : vérifie tes robinets.", "Probable water leak: check your taps.", "تسريب ماء محتمل: ثبّت في الروبينيات.");
  if (r.has("crossed")) return L("Un seuil de tranche est franchi ce mois-ci.", "A tranche threshold was crossed this month.", "تعدّيت شريحة هالشهر.");
  if (r.has("near_threshold") && view?.left != null)
    return L(`Plus que ${kwh(view.left)} avant la tranche suivante.`, `Only ${kwh(view.left)} before the next tranche.`, `باقي كان ${kwh(view.left)} قبل الشريحة الجاية.`);
  if (r.has("forecast_crosses")) return L("À ce rythme, la prévision dépasse le prochain seuil.", "At this pace, the forecast goes over the next threshold.", "بالريتم هذا، التوقع يفوت الشريحة الجاية.");
  if (r.has("increase") && i.trend_pct != null)
    return L(`Consommation en hausse de ${i.trend_pct} % sur 7 jours.`, `Consumption up ${i.trend_pct} % over 7 days.`, `الاستهلاك زاد ${i.trend_pct} % في 7 أيام.`);
  return L("Tout est sous contrôle.", "Everything is under control.", "كل شي تحت السيطرة.");
}

/** "Encore 32 kWh avant la tranche suivante" with the bar and its forecast hatching. */
function TrancheCard({ view, d, insights }: { view: TrancheView; d: Dashboard; insights: Insights | null }) {
  const pct = (v: number) => Math.max(0, Math.min(100, (v / view.scaleMax) * 100));
  const usedPct = pct(view.used);
  const forecastPct = view.forecast != null ? pct(view.forecast) : usedPct;
  const near = view.state === "near" || view.state === "crossed";
  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] leading-[22px] font-bold text-ink">
          {view.state === "top" ? (
            L("Dernière tranche STEG ce mois-ci", "Last STEG tranche this month", "آخر شريحة STEG هالشهر")
          ) : view.state === "none" ? (
            L("Grille tarifaire non configurée", "Tariff grid not configured", "جدول الأسوام موش معمول")
          ) : (
            <>
              {L("Encore", "", "باقي")}{" "}
              <bdi dir="ltr" className={near ? "text-harissa" : "text-elec-ink"}>{kwh(view.left ?? 0)}</bdi>{" "}
              {L("avant la tranche suivante", "left before the next tranche", "قبل الشريحة الجاية")}
            </>
          )}
        </p>
        {insights && <StatusBadge status={insights.status} />}
      </div>
      <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-bar-track" dir="ltr" aria-hidden>
        <div className={cx("absolute inset-y-0 left-0 rounded-full", near ? "bg-chams" : "bg-bar")} style={{ width: `${usedPct}%` }} />
        {forecastPct > usedPct && (
          <div className="hatch-harissa absolute inset-y-0" style={{ left: `${usedPct}%`, width: `${forecastPct - usedPct}%` }} />
        )}
        {view.marks.map((m) => (
          <div key={m} className="absolute inset-y-0 w-0.5 bg-canvas/80" style={{ left: `${pct(m)}%` }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap justify-between gap-x-3 text-[12px] text-mute">
        <span>
          {kwhValue(view.used)}
          {view.next != null ? ` / ${num(view.next)}` : ""} kWh
        </span>
        <span>
          {view.forecast != null
            ? `${L("Prévision fin du mois", "End-of-month forecast", "التوقع آخر الشهر")} : ${kwh(view.forecast)}`
            : L("Prévision : pas encore assez de mesures", "Forecast: not enough readings yet", "التوقع: مازال ما فماش قياسات كافية")}
        </span>
      </div>
      {d.electricity.next_kwh_price_dt != null && (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline pt-3 text-[13px]">
          <span className="text-mute">{L("Prix du prochain kWh", "Price of the next kWh", "سوم الـ kWh الجاي")}</span>
          <span className="font-bold text-ink">{dtUnit(d.electricity.next_kwh_price_dt)}</span>
          {d.electricity.crossing_extra_cost_dt != null && view.next != null && (
            <span className="w-full text-[12px] text-mute">
              {L(
                `Franchir ${num(view.next)} kWh ajouterait ≈ ${dt(d.electricity.crossing_extra_cost_dt)} (estimation).`,
                `Crossing ${num(view.next)} kWh would add ≈ ${dt(d.electricity.crossing_extra_cost_dt)} (estimate).`,
                `كان تتعدّى ${num(view.next)} kWh تزيد ≈ ${dt(d.electricity.crossing_extra_cost_dt)} (تقدير).`,
              )}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function sumOf(values: (number | null)[]): number {
  return values.reduce<number>((s, v) => s + (v ?? 0), 0);
}

export function HomePage() {
  const { dashboard, tranche, snoozed, snooze, insights } = useData();
  const { user } = useAuth();
  const { current } = useHouseholds();
  const nowMs = useNow(1000);
  const navigate = useNavigate();
  const d = dashboard.data;
  const power = useTodaySeries("electricity");
  const water = useTodaySeries("water");
  const alertKey = (d?.active_alerts ?? []).map((a) => a.id).join(",");
  const tips = usePoll((s) => api.tips(s), 20_000, [alertKey]);
  const [acking, setAcking] = useState<string | null>(null);
  const [focus, setFocus] = useState<"all" | "electricity" | "water">("all");

  const todayKwh = useMemo(() => sumOf((power.data?.points ?? []).map((p) => p.energy_kwh)), [power.data]);
  const todayL = useMemo(() => sumOf((water.data?.points ?? []).map((p) => p.volume_l)), [water.data]);
  const powerSpark = useMemo(() => downsample((power.data?.points ?? []).map((p) => p.power_w ?? 0)), [power.data]);
  const waterSpark = useMemo(() => downsample((water.data?.points ?? []).map((p) => p.flow_l_min ?? 0)), [water.data]);

  const now = new Date(nowMs);
  const greeting = (
    <div className="mb-4 hidden lg:block">
      <p className="text-[12px] font-semibold text-mute">{dateLabel(now)}</p>
      <h1 className="t-display text-ink">
        {L("Bonjour", "Hello", "عسلامة")}, {firstName(user)}
      </h1>
    </div>
  );

  if (!d) {
    return (
      <>
        {greeting}
        {dashboard.error ? (
          <Banner tone="broken" title={L("Impossible de charger le tableau de bord", "Could not load the dashboard", "ما نجّمناش نحمّلو الداشبورد")} role="alert">
            {dashboard.error}
          </Banner>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <Skeleton className="h-[88px] lg:col-span-12" />
            <Skeleton className="h-[290px] lg:col-span-7" />
            <Skeleton className="h-[290px] lg:col-span-5" />
          </div>
        )}
      </>
    );
  }

  const onboardingBanner =
    current && !current.onboarding_done ? (
      <Banner
        tone="info"
        title={L("Termine la configuration de ton foyer", "Finish setting up your home", "كمّل إعداد الدار متاعك")}
        actions={<ButtonLink to="/bienvenue?etape=appareils">{L("Ajouter mes appareils", "Add my appliances", "زيد الآلات متاعي")}</ButtonLink>}
      >
        {L(
          "Déclare tes appareils pour des conseils et des prévisions adaptés.",
          "Declare your appliances for tailored tips and forecasts.",
          "صرّح بالآلات متاعك باش تاخذ نصائح وتوقعات على قياسك.",
        )}
      </Banner>
    ) : null;

  if (d.state === "empty") {
    return (
      <>
        {greeting}
        <div className="space-y-3">
          {onboardingBanner}
          <Card className="flex flex-col items-center px-6 py-12 text-center">
            <LogoMark size={64} state="loading" title="" />
            <h2 className="t-h2 mt-5 text-ink">{L("En attente de la première mesure", "Waiting for the first reading", "نستنّاو في أول قياس")}</h2>
            <p className="t-body mt-2 max-w-md text-body">
              {L(
                "Branche ton boîtier Tranche Guard ou lance le simulateur. Le tableau de bord se remplit dès que la première mesure arrive.",
                "Plug in your Tranche Guard box or start the simulator. The dashboard fills in as soon as the first reading arrives.",
                "ركّب البواطة متاع Tranche Guard ولا شعّل السيمولاتور. الداشبورد يتعبّى كيف يوصل أول قياس.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink to="/esp">{L("Contrôle démo", "Demo control", "التحكم في الديمو")}</ButtonLink>
              <ButtonLink to="/foyers" variant="secondary">
                {L("Ajouter un appareil", "Add a device", "زيد بواطة")}
              </ButtonLink>
            </div>
          </Card>
        </div>
      </>
    );
  }

  const e = d.electricity;
  const bill = e.forecast.available && e.forecast.bill ? e.forecast.bill.total_dt : e.bill_to_date?.total_dt ?? null;
  const banners = sortAlerts(d.active_alerts.filter((a) => !snoozed.has(a.id))).slice(0, 2);
  const topTip = tips.data?.find((t) => t.code !== "offpeak") ?? tips.data?.[0];
  const live = d.live;
  const unreliable = !!live && (!live.electricity.reliable || !live.water.reliable);
  const msg = statusMessage(insights.data, tranche);

  const ack = async (a: Alert) => {
    setAcking(a.id);
    try {
      await api.ackAlert(a.id);
      await dashboard.refresh();
    } finally {
      setAcking(null);
    }
  };

  const stats = (
    <div className="grid h-[88px] grid-cols-3 items-center rounded-card bg-surface px-2">
      <div className="text-center">
        <div dir="ltr" className="text-[22px] leading-7 font-extrabold tabular-nums text-ink">{kwhValue(e.month_kwh)}</div>
        <div className="text-[12px] text-mute">{L("kWh ce mois", "kWh this month", "kWh هالشهر")}</div>
      </div>
      <div className="border-x border-hairline text-center">
        <div dir="ltr" className="text-[22px] leading-7 font-extrabold tabular-nums text-elec-ink">{bill != null ? dtRound(bill) : "—"}</div>
        <div className="text-[12px] text-mute">{L("facture estimée", "estimated bill", "الفاتورة المقدّرة")}</div>
      </div>
      <div className="text-center">
        <div dir="ltr" className="text-[22px] leading-7 font-extrabold tabular-nums text-water-ink">{m3(d.water.month_l / 1000)}</div>
        <div className="text-[12px] text-mute">{L("eau ce mois", "water this month", "الماء هالشهر")}</div>
      </div>
    </div>
  );

  const chips = (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <Chip active={focus === "all"} onClick={() => setFocus("all")}>
        {L("Vue d'ensemble", "Overview", "نظرة عامة")}
      </Chip>
      <Chip active={focus === "electricity"} onClick={() => setFocus("electricity")}>
        {L("Électricité", "Electricity", "الضو")}
      </Chip>
      <Chip active={focus === "water"} onClick={() => setFocus("water")}>
        {L("Eau", "Water", "الماء")}
      </Chip>
    </div>
  );

  const sparkCards = (
    <div className="grid grid-cols-2 gap-3">
      <Link to="/electricite" className="flex h-[100px] flex-col justify-between rounded-card bg-surface px-3.5 py-3 no-underline">
        <div className="flex justify-between text-[13px] text-mute">
          <span className="inline-flex items-center gap-1">
            <Zap size={14} strokeWidth={2} className="text-elec-ink" aria-hidden />
            {L("Électricité", "Electricity", "الضو")}
          </span>
          <span className="font-bold text-ink">{kwh(todayKwh)}</span>
        </div>
        <Sparkline values={powerSpark} tone="elec" />
      </Link>
      <Link to="/eau" className="flex h-[100px] flex-col justify-between rounded-card bg-surface px-3.5 py-3 no-underline">
        <div className="flex justify-between text-[13px] text-mute">
          <span className="inline-flex items-center gap-1">
            <Droplet size={14} strokeWidth={2} className="text-water-ink" aria-hidden />
            {L("Eau", "Water", "الماء")}
          </span>
          <span className="font-bold text-ink">{litres(todayL)}</span>
        </div>
        <Sparkline values={waterSpark} tone="water" />
      </Link>
    </div>
  );

  const billCard = (
    <Card className="!p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="t-h3 text-ink">{L("Facture STEG estimée", "Estimated STEG bill", "فاتورة STEG المقدّرة")}</h2>
        <Estimation />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <dt className="text-mute">{L("À ce jour", "So far", "لتوّا")}</dt>
          <dd className="text-[18px] font-extrabold text-ink">{e.bill_to_date ? dt(e.bill_to_date.total_dt) : "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">{L("Fin du mois", "End of month", "آخر الشهر")}</dt>
          <dd className="text-[18px] font-extrabold text-elec-ink">{e.forecast.bill ? dtRound(e.forecast.bill.total_dt) : "—"}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[12px] text-mute">
        {e.forecast.available ? e.forecast.assumption : L("Pas encore assez de mesures (1 h minimum).", "Not enough readings yet (1 h minimum).", "مازال ما فماش قياسات كافية (ساعة على الأقل).")}
      </p>
    </Card>
  );

  const waterCard = (
    <Card className="!p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="t-h3 text-ink">{L("Eau ce mois", "Water this month", "الماء هالشهر")}</h2>
        <span className={cx("text-[12px] font-bold", d.water.leak_suspected ? "text-grenade" : "text-success")}>
          {d.water.leak_suspected ? L("Fuite probable", "Probable leak", "تسريب محتمل") : L("Aucune fuite détectée", "No leak detected", "ما فماش تسريب")}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <dt className="text-mute">{L("Mesuré", "Measured", "مقاس")}</dt>
          <dd className="text-[18px] font-extrabold text-ink">{m3(d.water.month_l / 1000)}</dd>
        </div>
        <div>
          <dt className="text-mute">{L("Prévision", "Forecast", "التوقع")}</dt>
          <dd className="text-[18px] font-extrabold text-water-ink">{d.water.forecast.qty != null ? m3(d.water.forecast.qty / 1000) : "—"}</dd>
        </div>
      </dl>
      {!d.water.tariff_configured && (
        <p className="mt-2 text-[12px] text-mute">
          {L(
            "Tarifs SONEDE pas encore vérifiés : pas de montant ni d'alerte de tranche pour l'eau.",
            "SONEDE prices not verified yet: no amount or tranche alert for water.",
            "أسوام SONEDE مازالت ما تثبّتتش: ما فماش مبلغ ولا تنبيه شريحة للماء.",
          )}
        </p>
      )}
    </Card>
  );

  const tipCard = topTip ? (
    <Card className="!p-4">
      <div className="flex gap-3">
        <IconTile tone="tile">
          <Lightbulb size={20} strokeWidth={1.8} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-[21px] font-bold text-ink">{tipText(topTip)}</p>
          {topTip.saving_dt != null && topTip.saving_dt > 0 && (
            <p className="mt-1 text-[13px] font-bold text-success">
              ≈ {dt(topTip.saving_dt)} {topTip.code === "keep_pace" ? L("de surcoût évité", "extra cost avoided", "زيادة تتفادى") : L("gagnés ce mois", "saved this month", "توفير هالشهر")}{" "}
              <span className="font-medium text-mute">· {L("estimation", "estimate", "تقدير")}</span>
            </p>
          )}
          <Link to="/alertes?vue=conseils" className="mt-2 inline-flex min-h-11 items-center gap-1 text-[14px] font-bold no-underline">
            {L("Tous les conseils", "All tips", "النصائح الكل")} <ArrowRight size={16} className="rtl:rotate-180" aria-hidden />
          </Link>
        </div>
      </div>
    </Card>
  ) : null;

  const assistantCard = (
    <Link to="/assistant" className="flex items-center gap-3 rounded-card bg-surface p-4 no-underline hover:bg-sunken">
      <IconTile tone="elec">
        <Sparkles size={20} strokeWidth={1.8} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-ink">{L("Demande à l'assistant", "Ask the assistant", "اسأل المساعد")}</p>
        <p className="truncate text-[13px] text-mute">
          {L("« Combien vais-je payer ce mois-ci ? »", "\"How much will I pay this month?\"", "« قداش باش نخلص الشهر هذا؟ »")}
        </p>
      </div>
      <ArrowRight size={18} className="shrink-0 text-mute rtl:rotate-180" aria-hidden />
    </Link>
  );

  const challengeCard = (
    <Link to="/defis" className="flex items-center gap-3 rounded-card bg-surface p-4 no-underline hover:bg-sunken">
      <IconTile tone="success">
        <Trophy size={20} strokeWidth={1.8} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-ink">{L("Petit défi, bel impact", "Small challenge, big impact", "تحدّي صغير، أثر كبير")}</p>
        <p className="text-[13px] text-mute">{L("Ta semaine éco commence ici", "Your eco week starts here", "الجمعة الإيكو متاعك تبدا هوني")}</p>
      </div>
      <ArrowRight size={18} className="shrink-0 text-mute rtl:rotate-180" aria-hidden />
    </Link>
  );

  const alertBanners = banners.map((a) => {
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
              <Button onClick={() => navigate("/alertes?vue=conseils")}>{L("Voir le conseil", "See the tip", "شوف النصيحة")}</Button>
              <Button variant="secondary" onClick={() => snooze(a.id)}>
                {L("Plus tard", "Later", "من بعد")}
              </Button>
            </>
          ) : a.type === "leak" ? (
            <>
              <Button onClick={() => navigate("/eau")}>{L("Voir l'eau", "See water", "شوف الماء")}</Button>
              <Button variant="secondary" disabled={acking === a.id} onClick={() => ack(a)}>
                {L("J'ai vérifié", "I checked", "ثبّتت")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => navigate("/reglages#appareil")}>
                {L("Voir l'appareil", "See the device", "شوف البواطة")}
              </Button>
              <Button variant="ghost" onClick={() => snooze(a.id)}>
                {L("Plus tard", "Later", "من بعد")}
              </Button>
            </>
          )
        }
      >
        {alertText(a)}
      </Banner>
    );
  });

  return (
    <>
      {greeting}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12 lg:gap-5">
        <div className="space-y-3 lg:col-span-7">
          {onboardingBanner}
          {stats}
          {chips}
          <HouseScene
            powerW={live?.electricity.power_w ?? null}
            flowLMin={live?.water.flow_l_min ?? null}
            appliances={insights.data?.breakdown ?? []}
            focus={focus}
            unreliable={unreliable}
            stale={!live || live.stale || !d.device?.online}
          />
          {focus !== "water" && tranche && <TrancheCard view={tranche} d={d} insights={insights.data} />}
          {focus === "electricity" && billCard}
          {focus === "water" && waterCard}
          {sparkCards}
          {msg && (
            <p className="px-1 text-[12px] text-mute" aria-live="polite">
              {msg} · {L("Mesures du boîtier", "Box readings", "قياسات البواطة")} {d.device?.kind === "simulator" ? L("(simulées)", "(simulated)", "(محاكاة)") : ""}
            </p>
          )}
        </div>
        <div className="space-y-3 lg:col-span-5">
          {alertBanners}
          {focus === "all" && <div className="hidden lg:block">{billCard}</div>}
          {tipCard}
          {assistantCard}
          {challengeCard}
        </div>
      </div>
    </>
  );
}
