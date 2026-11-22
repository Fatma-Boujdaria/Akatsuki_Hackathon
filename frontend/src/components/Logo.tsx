// Shield logo of the "App Screens" design: four rising bars (Bahr, Ciel, Sable, Chams),
// the STEG tranches, clipped by a guard's shield. Wordmark "Tranche" + "Guard" in Chams.

import { useId } from "react";

export type LogoState = "default" | "near" | "crossed" | "loading";
export type LogoTone = "brand" | "reversed" | "mono";

interface LogoProps {
  size?: number;
  /** Living logo: near -> the tallest bar pulses, crossed -> it turns red, loading -> bars rise in turn. */
  state?: LogoState;
  tone?: LogoTone;
  className?: string;
  title?: string;
}

const SHIELD = "M50 4 L90 18 V48 C90 74 72 90 50 97 C28 90 10 74 10 48 V18 Z";

export function LogoMark({ size = 32, state = "default", tone = "brand", className, title }: LogoProps) {
  const clip = useId().replace(/:/g, "");
  const label = title ?? "Tranche Guard";
  const mono = tone === "mono";
  const colors = mono
    ? ["currentColor", "currentColor", "currentColor", "currentColor"]
    : ["var(--bahr)", "var(--ciel)", "var(--sable)", state === "crossed" ? "var(--grenade)" : "var(--chams)"];
  const loading = state === "loading";
  const bars = [
    { x: 10, y: 62, w: 18 },
    { x: 30, y: 46, w: 18 },
    { x: 50, y: 30, w: 18 },
    { x: 70, y: 0, w: 20 },
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      style={{ flexShrink: 0 }}
    >
      {label && <title>{label}</title>}
      <defs>
        <clipPath id={clip}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      {mono && <path d={SHIELD} fill="none" stroke="currentColor" strokeWidth={4} />}
      <g clipPath={`url(#${clip})`}>
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={102 - b.y}
            fill={colors[i]}
            opacity={mono ? 0.25 + i * 0.25 : 1}
            className={loading || (state === "near" && i === 3) ? (loading ? "tg-bar-loading" : "tg-live-dot") : undefined}
            style={loading ? { animationDelay: `${i * 0.15}s` } : undefined}
          />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ className = "text-[19px]" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-[-0.5px] text-ink ${className}`} dir="ltr">
      Tranche<span className="text-brand-accent">Guard</span>
    </span>
  );
}

export function Logo({
  size = 32,
  state,
  tone,
  wordmarkClass = "text-[19px]",
}: LogoProps & { wordmarkClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} state={state} tone={tone} title="" />
      <Wordmark className={wordmarkClass} />
    </span>
  );
}
