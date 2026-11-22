import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { Link, useNavigate, type LinkProps } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { L } from "../lib/i18n";

// "App Screens" design: borderless cards on a navy (or pale blue) ground, 20 px
// corners, pill chips, 44 px touch targets, Plus Jakarta Sans 700-800 for numbers.

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover font-extrabold",
  secondary: "bg-sunken text-ink hover:bg-hairline font-bold",
  ghost: "bg-transparent text-link hover:bg-sunken font-bold",
  danger: "bg-grenade-soft text-grenade hover:brightness-95 font-bold",
};

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl px-5 text-[15px] leading-5 " +
  "transition-colors select-none disabled:pointer-events-none disabled:opacity-40 cursor-pointer";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean; size?: "md" | "lg" }
>(function Button({ variant = "primary", block, size = "md", className, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(base, variants[variant], block && "w-full", size === "lg" && "min-h-14 rounded-[16px] text-[16px]", className)}
      {...rest}
    />
  );
});

export function ButtonLink({ variant = "primary", className, ...rest }: LinkProps & { variant?: Variant }) {
  return <Link className={cx(base, variants[variant], "no-underline", className)} {...rest} />;
}

export function Card({
  className,
  children,
  as: As = "section",
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return (
    <As className={cx("rounded-card bg-surface p-4 sm:p-5", className)} {...rest}>
      {children}
    </As>
  );
}

/** Small muted label: "kWh ce mois", "Puissance en direct". */
export function Label({ children, className, as: As = "p" }: { children: ReactNode; className?: string; as?: "p" | "span" | "h2" | "h3" | "dt" }) {
  return <As className={cx("text-[13px] leading-[18px] font-medium text-mute", className)}>{children}</As>;
}

export function CardHeader({ title, aside, className }: { title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-3 flex items-baseline justify-between gap-3", className)}>
      <h2 className="t-h3 text-ink">{title}</h2>
      {aside != null && <div className="shrink-0 text-[12px] text-mute">{aside}</div>}
    </div>
  );
}

/** "estimation": every DT amount carries it. */
export function Estimation({ className }: { className?: string }) {
  return <span className={cx("text-[12px] font-medium text-mute", className)}>{L("estimation", "estimate", "تقدير")}</span>;
}

export function IconTile({
  tone,
  children,
  size = 44,
}: {
  tone: "elec" | "water" | "neutral" | "primary" | "tile" | "success" | "warning" | "danger";
  children: ReactNode;
  size?: number;
}) {
  const tones = {
    elec: "bg-elec-soft text-elec-ink",
    water: "bg-water-soft text-water-ink",
    neutral: "bg-sunken text-ink",
    primary: "bg-primary-soft text-primary",
    tile: "bg-tile text-water-ink",
    success: "bg-success-soft text-success",
    warning: "bg-harissa-soft text-harissa",
    danger: "bg-grenade-soft text-grenade",
  };
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-ctl", tones[tone])}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-hairline", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-card bg-surface motion-reduce:animate-none", className)} />;
}

/** Round 44 px back button of the design (Alerts, Demo). */
export function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label={L("Retour", "Back", "رجوع")}
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-ink hover:bg-sunken"
    >
      <ArrowLeft size={20} strokeWidth={1.8} className="rtl:rotate-180" />
    </button>
  );
}

/** Page title: 22 px / 800, optional back button, small context line, right-side control. */
export function PageHeader({
  label,
  title,
  aside,
  back,
}: {
  label?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  back?: string | boolean;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
      <div className="flex min-w-0 items-center gap-2">
        {back && <BackButton to={typeof back === "string" ? back : undefined} />}
        <div className="min-w-0">
          {label && <p className="text-[12px] font-semibold text-mute">{label}</p>}
          <h1 className="t-display text-ink">{title}</h1>
        </div>
      </div>
      {aside}
    </header>
  );
}

/** Pill chip (design: "Vue d'ensemble · Électricité · Eau", "Tout · Alertes · Conseils"). */
export function Chip({
  active,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[14px] whitespace-nowrap transition-colors",
        active ? "bg-chip-active font-bold text-on-chip-active" : "bg-surface font-semibold text-chip hover:bg-sunken",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Two-to-four option switch in a pill track ("Jour | Mois"). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors",
              active ? "bg-chip-active font-bold text-on-chip-active" : "font-semibold text-chip hover:text-ink",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Section title above a group of rows (Settings design). */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("px-1 pt-4 pb-1.5 text-[13px] font-bold text-mute", className)}>{children}</h2>;
}

/** A rounded group of 48 px rows separated by hairlines. */
export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("divide-y divide-hairline overflow-hidden rounded-card bg-surface", className)}>{children}</div>;
}

export function ListRow({
  label,
  value,
  to,
  onClick,
  icon,
  danger,
  chevron = true,
}: {
  label: ReactNode;
  value?: ReactNode;
  to?: string;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  chevron?: boolean;
}) {
  const inner = (
    <>
      {icon && <span className={cx("shrink-0", danger ? "text-grenade" : "text-mute")}>{icon}</span>}
      <span className={cx("min-w-0 flex-1 truncate text-[14px] font-semibold", danger ? "text-grenade" : "text-ink")}>
        {label}
      </span>
      {value != null && <span className="shrink-0 text-[13px] text-mute">{value}</span>}
      {(to || onClick) && chevron && !danger && (
        <ChevronRight size={18} strokeWidth={1.8} className="shrink-0 text-mute rtl:rotate-180" aria-hidden />
      )}
    </>
  );
  const cls = "flex min-h-12 w-full items-center gap-3 px-4 py-2 text-start no-underline";
  if (to) {
    return (
      <Link to={to} className={cx(cls, "hover:bg-sunken")}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cx(cls, "cursor-pointer hover:bg-sunken")}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** Thin progress bar (tranche rows, consumers, challenges). */
export function ProgressBar({
  pct,
  tone = "bar",
  className,
  label,
}: {
  pct: number;
  tone?: "bar" | "elec" | "water" | "sable" | "success";
  className?: string;
  label?: string;
}) {
  const fills = { bar: "bg-bar", elec: "bg-elec", water: "bg-water", sable: "bg-sable", success: "bg-success" };
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={cx("relative h-2 overflow-hidden rounded-full bg-bar-track", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div className={cx("absolute inset-y-0 start-0 rounded-full", fills[tone])} style={{ width: `${v}%` }} />
    </div>
  );
}
