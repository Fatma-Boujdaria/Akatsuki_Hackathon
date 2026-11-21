import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

// Flat, hairlined, 44 px to the thumb (charter board 05): no shadows, 1 px hairlines,
// radius 10 for controls, 14 for cards.

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-surface text-ink border border-control/70 hover:bg-sunken",
  ghost: "bg-transparent text-primary hover:bg-primary-soft",
  danger: "bg-surface text-grenade border border-grenade-line hover:bg-grenade-soft",
};

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl px-5 text-[15px] font-semibold leading-5 " +
  "transition-colors select-none disabled:pointer-events-none disabled:opacity-40 cursor-pointer";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean }
>(function Button({ variant = "primary", block, className, type = "button", ...rest }, ref) {
  return <button ref={ref} type={type} className={cx(base, variants[variant], block && "w-full", className)} {...rest} />;
});

export function ButtonLink({ variant = "primary", className, ...rest }: LinkProps & { variant?: Variant }) {
  return <Link className={cx(base, variants[variant], className)} {...rest} />;
}

export function Card({
  className,
  children,
  as: As = "section",
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return (
    <As className={cx("rounded-card border border-hairline bg-surface p-5 sm:p-6", className)} {...rest}>
      {children}
    </As>
  );
}

/** Mono caps label: PUISSANCE · W */
export function Label({ children, className, as: As = "p" }: { children: ReactNode; className?: string; as?: "p" | "span" | "h2" | "h3" | "dt" }) {
  return <As className={cx("t-label text-mute", className)}>{children}</As>;
}

export function CardHeader({ title, aside, className }: { title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-4 flex items-start justify-between gap-3", className)}>
      <h2 className="t-h3 text-ink">{title}</h2>
      {aside != null && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** "estimation": every DT amount carries it (principle 03). */
export function Estimation({ className }: { className?: string }) {
  return <span className={cx("t-small text-mute", className)}>estimation</span>;
}

export function IconTile({ tone, children, size = 36 }: { tone: "elec" | "water" | "neutral" | "primary"; children: ReactNode; size?: number }) {
  const tones = {
    elec: "bg-elec-soft text-elec-ink",
    water: "bg-water-soft text-water-ink",
    neutral: "bg-sunken text-ink",
    primary: "bg-primary-soft text-primary",
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
  return <div className={cx("animate-pulse rounded-ctl bg-sunken motion-reduce:animate-none", className)} />;
}

/** Page title block: mono context label above a Grotesk display title. */
export function PageHeader({ label, title, aside }: { label: ReactNode; title: ReactNode; aside?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-7">
      <div className="min-w-0">
        <Label className="mb-1.5">{label}</Label>
        <h1 className="t-display text-ink">{title}</h1>
      </div>
      {aside}
    </header>
  );
}

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
    <div role="radiogroup" aria-label={label} className="flex w-full rounded-ctl border border-hairline bg-sunken p-1 sm:inline-flex sm:w-auto">
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
              "inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] px-2.5 text-[14px] font-medium transition-colors sm:flex-none sm:px-3.5",
              active ? "border border-hairline bg-surface text-ink" : "border border-transparent text-mute hover:text-ink",
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
