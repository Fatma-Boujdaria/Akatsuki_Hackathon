import type { ReactNode } from "react";
import { CircleAlert, Clock, TriangleAlert, WifiOff } from "lucide-react";
import { cx, IconTile, Label } from "./ui";
import { shortAge, time } from "../lib/format";
import { L } from "../lib/i18n";
import type { DeviceStatus, Live } from "../lib/types";

// ---- Device status pills (board 05) -------------------------------------------------

type PillTone = "live" | "neutral" | "headsup" | "broken";

const pillTones: Record<PillTone, string> = {
  live: "bg-success-soft text-success",
  neutral: "bg-sunken text-body",
  headsup: "bg-harissa-soft text-harissa",
  broken: "bg-grenade-soft text-grenade",
};

export function Pill({ tone, icon, children, className }: { tone: PillTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-medium leading-4",
        pillTones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function LiveDot() {
  return <span aria-hidden className="tg-live-dot inline-block size-2 rounded-full bg-current" />;
}

/** "● En direct · il y a 4 s" / "Ancien · 3 min" / "Appareil hors ligne · vu à 14:02". */
export function DevicePill({
  live,
  device,
  compact,
  ageOverride,
}: {
  live: Live | null;
  device: DeviceStatus | null;
  compact?: boolean;
  ageOverride?: number;
}) {
  if (!device || !live) return <Pill tone="neutral" icon={<Clock size={14} strokeWidth={1.75} />}>{L("En attente", "Waiting", "في الانتظار")}</Pill>;
  const age = ageOverride ?? live.age_s;
  if (!device.online) {
    const seen = device.last_seen_at ? ` · ${L("vu à", "seen at", "آخر مرة")} ${time(device.last_seen_at)}` : "";
    return (
      <Pill tone="neutral" icon={<WifiOff size={14} strokeWidth={1.75} />}>
        {compact ? L("Hors ligne", "Offline", "مقطوع") : `${L("Appareil hors ligne", "Device offline", "البواطة مقطوعة")}${seen}`}
      </Pill>
    );
  }
  if (live.stale) {
    return (
      <Pill tone="neutral" icon={<Clock size={14} strokeWidth={1.75} />}>
        {L("Ancien", "Old", "قديم")} · {shortAge(age)}
      </Pill>
    );
  }
  return (
    <Pill tone="live" icon={<LiveDot />}>
      <span className="text-[12px] font-bold tabular-nums">
        {compact ? shortAge(age) : `${L("En direct", "Live", "مباشر")} · ${shortAge(age)}`}
      </span>
    </Pill>
  );
}

// ---- Live cards: normal, stale, fault (board 05) ------------------------------------

export type LiveCardStatus = "ok" | "stale" | "unreliable" | "fault";

export function LiveCard({
  tone,
  icon,
  label,
  value,
  status,
  footer,
}: {
  tone: "elec" | "water";
  icon: ReactNode;
  label: string;
  value: string | null;
  status: LiveCardStatus;
  footer: ReactNode;
}) {
  const problem = status === "unreliable" || status === "fault";
  return (
    <div
      className={cx(
        "flex min-h-[132px] flex-col rounded-card p-4 sm:p-5",
        status === "stale" && "bg-sunken",
        status === "ok" && "bg-surface",
        problem && "border border-dashed border-control bg-surface",
      )}
    >
      <div className="flex items-center gap-3">
        <IconTile tone={status === "stale" ? "neutral" : tone} size={32}>
          {icon}
        </IconTile>
        <Label as="span">{label}</Label>
      </div>
      <div className="mt-3 flex-1">
        {problem ? (
          <p
            className={cx(
              "font-display text-[20px] leading-7 font-extrabold",
              status === "fault" ? "text-grenade" : "text-harissa",
            )}
          >
            {status === "fault" ? L("Capteur en panne", "Sensor fault", "الكابتور معطّل") : L("Mesure peu fiable", "Unreliable reading", "قياس موش مضمون")}
          </p>
        ) : (
          <p className={cx("t-metric", status === "stale" ? "text-mute" : "text-ink")}>{value ?? "—"}</p>
        )}
      </div>
      <div className="mt-2 text-[12px] leading-4 text-mute">{footer}</div>
    </div>
  );
}

export function liveStatus(live: Live | null, part: "electricity" | "water"): LiveCardStatus {
  if (!live) return "stale";
  const p = live[part];
  if (p.fault) return "fault";
  if (!p.reliable) return "unreliable";
  if (live.stale) return "stale";
  return "ok";
}

export function LiveFooter({ status, live }: { status: LiveCardStatus; live: Live | null }) {
  if (!live) return <span>{L("en attente de mesure", "waiting for a reading", "نستنّاو في القياس")}</span>;
  if (status === "unreliable" || status === "fault")
    return <span>{L("jamais de valeur inventée", "never a made-up value", "عمرنا ما نخترعو رقم")}</span>;
  if (status === "stale") return <span>{L("ancien", "old", "قديم")} · {time(live.ts)}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-mute">
      <span aria-hidden className="size-1.5 rounded-full bg-success" />
      {L("il y a", "", "قبل")} {shortAge(live.age_s)} {L("", "ago", "")}
    </span>
  );
}

// ---- Alert banners: info, heads-up, broken (board 05) -------------------------------

export type BannerTone = "info" | "headsup" | "broken";

const bannerTones: Record<BannerTone, { box: string; title: string; icon: ReactNode }> = {
  info: {
    box: "bg-surface border-hairline",
    title: "text-ink",
    icon: <CircleAlert size={20} strokeWidth={1.75} className="text-ink" />,
  },
  headsup: {
    box: "bg-harissa-soft border-harissa-line border-[1.5px]",
    title: "text-harissa",
    icon: <TriangleAlert size={20} strokeWidth={1.75} className="text-harissa" />,
  },
  broken: {
    box: "bg-grenade-soft border-grenade-line",
    title: "text-grenade",
    icon: <CircleAlert size={20} strokeWidth={1.75} className="text-grenade" />,
  },
};

export function Banner({
  tone,
  title,
  children,
  icon,
  actions,
  className,
  role,
}: {
  tone: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const t = bannerTones[tone];
  return (
    <div role={role} className={cx("rounded-card border p-4 sm:p-5", t.box, className)}>
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0" aria-hidden>
          {icon ?? t.icon}
        </span>
        <div className="min-w-0 flex-1">
          {title && <p className={cx("text-[15px] leading-[22px] font-extrabold", t.title)}>{title}</p>}
          {children && (
            <div className={cx("text-[14px] leading-[21px]", tone === "headsup" ? "text-harissa-body" : "text-body", !!title && "mt-0.5")}>
              {children}
            </div>
          )}
          {actions && <div className="mt-4 flex flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
