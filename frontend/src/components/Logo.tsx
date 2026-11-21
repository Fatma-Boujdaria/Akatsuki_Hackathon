// Foyer, "toit-garde" (charter boards 02 and 11): a Bahr house holding three white
// bars (the STEG tranches) under a detached Chams roof rail. Roof pitch 40°, only
// the base of the house is rounded, the tallest bar stays one bar-width under the roof.

export type LogoState = "default" | "near" | "crossed" | "loading";
export type LogoTone = "brand" | "reversed" | "mono";

interface LogoProps {
  size?: number;
  /** Living logo, app header only: near -> tallest bar Harissa and grows, crossed -> it breaks the roof. */
  state?: LogoState;
  tone?: LogoTone;
  className?: string;
  title?: string;
}

const HARISSA = "#C2401B";

export function LogoMark({ size = 32, state = "default", tone = "brand", className, title }: LogoProps) {
  const roof = tone === "mono" ? "currentColor" : "var(--chams)";
  const house = tone === "reversed" ? "#FFFFFF" : tone === "mono" ? "currentColor" : "var(--bahr)";
  const bars = tone === "reversed" ? "var(--bahr)" : tone === "mono" ? "var(--surface)" : "#FFFFFF";
  const tall = state === "near" || state === "crossed" ? HARISSA : bars;
  const loading = state === "loading";
  const tallY = state === "near" ? 29 : state === "crossed" ? 8 : 32;
  const label = title ?? "Tranche Guard";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={label}
      style={{ flexShrink: 0 }}
    >
      <title>{label}</title>
      {/* Roof rail: the guard, held one gap away from the house */}
      <path
        d="M8 30 L32 10 L56 30"
        fill="none"
        stroke={roof}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* House: pointed top, rounded base corners only */}
      <path d="M14 33 L32 18 L50 33 V50 a4 4 0 0 1 -4 4 H18 a4 4 0 0 1 -4 -4 Z" fill={house} />
      {/* Three tranches */}
      <rect
        x={20.5}
        y={42}
        width={5.5}
        height={8}
        rx={1.2}
        fill={bars}
        className={loading ? "tg-bar-loading" : undefined}
      />
      <rect
        x={29.25}
        y={37}
        width={5.5}
        height={13}
        rx={1.2}
        fill={bars}
        className={loading ? "tg-bar-loading" : undefined}
        style={loading ? { animationDelay: "0.18s" } : undefined}
      />
      <rect
        x={38}
        y={tallY}
        width={5.5}
        height={50 - tallY}
        rx={1.2}
        fill={tall}
        className={loading ? "tg-bar-loading" : undefined}
        style={{
          transition: "y 300ms ease, height 300ms ease, fill 300ms ease",
          ...(loading ? { animationDelay: "0.36s" } : {}),
        }}
      />
    </svg>
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
      <span className={`font-display font-semibold tracking-[-0.3px] text-ink ${wordmarkClass}`}>Tranche Guard</span>
    </span>
  );
}
