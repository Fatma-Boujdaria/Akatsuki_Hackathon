import { TriangleAlert } from "lucide-react";
import { L } from "../lib/i18n";
import type { TrancheView } from "../lib/tranche";
import { dtUnit, kwh, kwhValue, num } from "../lib/format";
import { cx } from "./ui";

// The signature (board 05): track Sunken · fill Chams with its stroke · forecast
// dashed · threshold marks in Encre · the number is always written next to the bar.
// Near (within the alert margin): Harissa fill. Crossed: the extra kWh are hatched.

const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

export function TrancheBar({
  view,
  nextKwhPrice,
  showHeader = false,
  className,
}: {
  view: TrancheView;
  nextKwhPrice?: number | null;
  showHeader?: boolean;
  className?: string;
}) {
  const { used, next, crossedAt, forecast, scaleMax, marks, state } = view;
  const near = state === "near";
  const base = crossedAt != null ? Math.min(used, crossedAt) : used;
  const showForecast = forecast != null && forecast > used + 0.5;

  const left =
    state === "crossed" || state === "top"
      ? kwh(used)
      : next != null
        ? `${kwhValue(used)} / ${num(next)} kWh`
        : kwh(used);
  const right =
    state === "crossed" && nextKwhPrice != null
      ? `kWh à ${dtUnit(nextKwhPrice)}`
      : forecast != null
        ? `prévision ≈ ${num(Math.round(forecast))}`
        : `0 — ${num(Math.round(scaleMax))}`;

  const label =
    next != null
      ? `${kwhValue(used)} kWh consommés sur ${num(next)} avant la tranche suivante`
      : `${kwhValue(used)} kWh consommés ce mois-ci`;

  return (
    <div className={className}>
      {showHeader && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="t-label text-mute">
            {state === "safe" ? L("sous la tranche", "below the tranche", "تحت الشريحة") : state === "near" ? L("tranche proche", "tranche near", "الشريحة قريبة") : state === "crossed" ? L("tranche dépassée", "tranche crossed", "تعدّيت الشريحة") : L("consommation", "consumption", "الاستهلاك")}
          </span>
          <span
            className={cx(
              "inline-flex items-center gap-1 font-display text-[17px] font-semibold",
              near || state === "crossed" ? "text-harissa" : "text-ink",
            )}
          >
            {near && <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />}
            {state === "crossed" || state === "top"
              ? `Tranche ${view.currentBandLabel?.replace(" kWh", "")}`
              : view.left != null
                ? `Encore ${kwh(view.left)}`
                : ""}
          </span>
        </div>
      )}
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={next ?? Math.round(scaleMax)}
        aria-valuenow={Math.round(used)}
        className="relative h-3.5 w-full"
      >
        {/* Track */}
        <div className="absolute inset-0 rounded-full bg-sunken" />
        {/* Forecast: dashed outline from now to the end-of-month estimate */}
        {showForecast && forecast != null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full border border-dashed border-elec-stroke"
            style={{ width: pct(forecast, scaleMax) }}
          />
        )}
        {/* Fill up to the crossed threshold (or the whole use) */}
        <div
          className={cx(
            "absolute inset-y-0 left-0 rounded-full border transition-[width] duration-500 motion-reduce:transition-none",
            near ? "border-harissa bg-harissa" : "border-elec-stroke bg-elec",
          )}
          style={{ width: pct(base, scaleMax) }}
        />
        {/* Crossed: the extra above the threshold, hatched Harissa */}
        {crossedAt != null && !near && used > crossedAt && (
          <div
            className="hatch-harissa absolute inset-y-0 rounded-r-full border border-l-0 border-harissa"
            style={{ left: pct(crossedAt, scaleMax), width: `calc(${pct(used - crossedAt, scaleMax)})` }}
          />
        )}
        {/* Threshold marks, in Encre */}
        {marks
          .filter((m) => m < scaleMax - 0.01)
          .map((m) => (
            <div
              key={m}
              aria-hidden
              className="absolute -top-1.5 -bottom-1.5 w-[2px] -translate-x-1/2 rounded-full bg-ink"
              style={{ left: pct(m, scaleMax) }}
            />
          ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 font-mono text-[13px] leading-5 tabular-nums">
        <span className={cx(near || state === "crossed" ? "text-harissa" : "text-mute")}>{left}</span>
        <span className="text-mute">{right}</span>
      </div>
    </div>
  );
}
