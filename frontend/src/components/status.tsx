import type { ReactNode } from "react";
import { CircleAlert, Clock, TriangleAlert, WifiOff } from "lucide-react";
import { cx, IconTile, Label } from "./ui";
import { shortAge, time } from "../lib/format";
import type { DeviceStatus, Live } from "../lib/types";

// ---- Device status pills (board 05) -------------------------------------------------

type PillTone = "live" | "neutral" | "headsup" | "broken";

const pillTones: Record<PillTone, string> = {
  live: "bg-primary-soft text-primary",
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
  if (!device || !live) return <Pill tone="neutral" icon={<Clock size={14} strokeWidth={1.75} />}>En attente</Pill>;
  const age = ageOverride ?? live.age_s;
  if (!device.online) {
    const seen = device.last_seen_at ? ` · vu à ${time(device.last_seen_at)}` : "";
    return (
      <Pill tone="neutral" icon={<WifiOff size={14} strokeWidth={1.75} />}>
        {compact ? "Hors ligne" : `Appareil hors ligne${seen}`}
      </Pill>
    );
  }
  if (live.stale) {
    return (
      <Pill tone="neutral" icon={<Clock size={14} strokeWidth={1.75} />}>
        Ancien · {shortAge(age)}
      </Pill>
    );
  }
  return (
    <Pill tone="live" icon={<LiveDot />}>
      <span className="font-mono text-[12px] tracking-[0.02em] tabular-nums">
        {compact ? shortAge(age) : `En direct · il y a ${shortAge(age)}`}
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
        status === "stale" && "border border-hairline bg-sunken",
        status === "ok" && "border border-hairline bg-surface",
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
              "font-display text-[22px] leading-7 font-semibold tracking-[-0.5px]",
              status === "fault" ? "text-grenade" : "text-harissa",
            )}
          >
            {status === "fault" ? "Capteur en panne" : "Mesure peu fiable"}
          </p>
        ) : (
          <p className={cx("t-metric", status === "stale" ? "text-mute" : "text-ink")}>{value ?? "—"}</p>
        )}
      </div>
      <div className="mt-2 font-mono text-[12px] leading-4 text-mute">{footer}</div>
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
  if (!live) return <span>en attente de mesure</span>;
  if (status === "unreliable" || status === "fault") return <span>jamais de valeur inventée</span>;
  if (status === "stale") return <span>ancien · {time(live.ts)}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-mute">
      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
      il y a {shortAge(live.age_s)}
    </span>
  );
}

// ---- Alert banners: info, heads-up, broken (board 05) -------------------------------

export type BannerTone = "info" | "headsup" | "broken";

const bannerTones: Record<BannerTone, { box: string; title: string; icon: ReactNode }> = {
  info: {
    box: "bg-sunken border-hairline",
    title: "text-ink",
    icon: <CircleAlert size={20} strokeWidth={1.75} className="text-ink" />,
  },
  headsup: {
    box: "bg-harissa-soft border-harissa-line",
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
          {title && <p className={cx("t-h3 text-[17px]", t.title)}>{title}</p>}
          {children && <div className={cx("t-body text-body", !!title && "mt-1")}>{children}</div>}
          {actions && <div className="mt-4 flex flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
