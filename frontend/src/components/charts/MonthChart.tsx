import { useMemo } from "react";
import { L } from "../../lib/i18n";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ElectricitySummary, Series } from "../../lib/types";
import type { TrancheView } from "../../lib/tranche";
import { useChartColors } from "../../lib/theme";
import { dayMonth, kwhValue, monthName, num } from "../../lib/format";
import { daysInMonth, fractionalDay, localParts } from "../../lib/time";
import { AXIS_FONT, ChartCard, TooltipBox } from "./ChartTooltip";
import { Skeleton } from "../ui";

interface Pt {
  x: number;
  actual?: number;
  forecast?: number;
}

/**
 * "Cumul du mois": kWh used since the 1st (Chams stroke on Sable), the end-of-month
 * forecast dotted, the next threshold dashed Harissa and labelled.
 */
export function MonthChart({
  series,
  elec,
  view,
  now,
}: {
  series: Series | null;
  elec: ElectricitySummary | null;
  view: TrancheView | null;
  now: Date;
}) {
  const c = useChartColors();
  const p = localParts(now);
  const days = daysInMonth(p.y, p.mo);
  const nowX = fractionalDay(now);
  const end = days + 1;

  const { data, yMax, ticks } = useMemo(() => {
    const perDay = new Map<number, number>();
    for (const pt of series?.points ?? []) {
      const lp = localParts(new Date(pt.ts));
      if (lp.mo !== p.mo) continue;
      perDay.set(lp.d, (perDay.get(lp.d) ?? 0) + (pt.energy_kwh ?? 0));
    }
    const pts: Pt[] = [];
    let cum = 0;
    for (let d = 1; d <= p.d; d++) {
      pts.push({ x: d, actual: +cum.toFixed(2) });
      cum += perDay.get(d) ?? 0;
    }
    const used = elec?.month_kwh ?? cum;
    const fc = elec?.forecast.available ? elec.forecast.qty : null;
    pts.push({ x: +nowX.toFixed(3), actual: used, forecast: fc != null ? used : undefined });
    if (fc != null) pts.push({ x: end, forecast: +fc.toFixed(1) });

    const top = Math.max(used, fc ?? 0, view?.next ?? 0) * 1.08;
    const step = top <= 160 ? 25 : top <= 320 ? 50 : 100;
    const yMax = Math.max(step * 2, Math.ceil(top / step) * step);
    const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);
    return { data: pts, yMax, ticks };
  }, [series, elec, view?.next, p.d, p.mo, nowX, end]);

  if (!series || !elec || !view) {
    return (
      <ChartCard title={`${L("Cumul de", "Running total for", "المجموع متاع")} ${monthName(now)}`} unit={`kWh · ${L("estimation", "estimate", "تقدير")}`}>
        <Skeleton className="h-[260px]" />
      </ChartCard>
    );
  }

  const xTicks = [1, 15, p.d, days].filter(
    (t, i, arr) => arr.indexOf(t) === i && (t === p.d || Math.abs(t - p.d) >= 3),
  );
  const fc = elec.forecast.available ? elec.forecast.qty : null;
  const crossX =
    view.crossingDate && view.next != null ? fractionalDay(view.crossingDate) : null;
  const showCross = crossX != null && crossX <= end && localParts(view.crossingDate!).mo === p.mo;
  // Keep "182 kWh aujourd'hui" clear of the dashed threshold line.
  const nearLine = view.next != null && view.next >= elec.month_kwh && view.next - elec.month_kwh < yMax * 0.1;

  return (
    <ChartCard
      title={`Cumul de ${monthName(now)}`}
      unit={`kWh · ${L("estimation", "estimate", "تقدير")}`}
      footer={elec.forecast.available ? elec.forecast.assumption : L("Prévision disponible après une heure de mesures.", "Forecast available after one hour of readings.", "التوقّع يجي بعد ساعة قياسات.")}
    >
      <div className="h-[260px] sm:h-[280px]" role="img" aria-label={`Consommation cumulée : ${kwhValue(elec.month_kwh)} kWh aujourd'hui${fc != null ? `, prévision ${num(Math.round(fc))} kWh en fin de mois` : ""}${view.next != null ? `, tranche suivante à ${num(view.next)} kWh` : ""}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={c.grid} strokeWidth={1} />
            <XAxis
              type="number"
              dataKey="x"
              domain={[1, end]}
              ticks={xTicks}
              tickFormatter={(d: number) => (d === 1 ? `1 ${dayMonth(now).split(" ")[1]}` : String(d))}
              tick={{ fontFamily: AXIS_FONT, fontSize: 11, fill: c.axis }}
              axisLine={{ stroke: c.grid }}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={[0, yMax]}
              ticks={ticks}
              tick={{ fontFamily: AXIS_FONT, fontSize: 11, fill: c.axis }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: c.cursor, strokeWidth: 1, strokeDasharray: "2 3" }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as Pt;
                const isForecast = pt.actual == null;
                const date = new Date(Date.UTC(p.y, p.mo - 1, Math.floor(pt.x), 12));
                return (
                  <TooltipBox
                    title={pt.x >= end ? L("fin du mois", "end of month", "آخر الشهر") : Math.abs(pt.x - nowX) < 0.01 ? L("maintenant", "now", "توّا") : `${L("début du", "start of", "بداية")} ${dayMonth(date)}`}
                    rows={[
                      {
                        label: isForecast ? L("prévision ≈", "forecast ≈", "توقّع ≈") : undefined,
                        value: `${kwhValue(isForecast ? (pt.forecast ?? 0) : (pt.actual ?? 0))} kWh`,
                      },
                    ]}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke={c.elecStroke}
              strokeWidth={2}
              fill={c.elecFill}
              fillOpacity={1}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, fill: c.elecDot, stroke: c.elecStroke, strokeWidth: 1.5 }}
            />
            <Line
              type="linear"
              dataKey="forecast"
              stroke={c.elecStroke}
              strokeWidth={2.5}
              strokeDasharray="0.5 5"
              strokeLinecap="round"
              connectNulls
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            {/* Today, a hairline down to the axis */}
            <ReferenceLine x={nowX} stroke={c.grid} strokeWidth={1} />
            {view.next != null && (
              <ReferenceLine
                y={view.next}
                stroke={c.harissa}
                strokeWidth={1.5}
                strokeDasharray="6 5"
                label={{
                  value: `${num(view.next)} kWh · tranche suivante`,
                  position: "insideTopRight",
                  fill: c.harissa,
                  fontSize: 12,
                  fontWeight: 500,
                  dy: -16,
                }}
              />
            )}
            {showCross && crossX != null && view.next != null && (
              <ReferenceDot
                x={crossX}
                y={view.next}
                r={5}
                fill={c.surface}
                stroke={c.harissa}
                strokeWidth={1.75}
                label={{
                  value: `≈ ${dayMonth(view.crossingDate!)}`,
                  position: "right",
                  fill: c.harissa,
                  fontSize: 11,
                  fontFamily: AXIS_FONT,
                  dx: 2,
                  dy: 14,
                }}
              />
            )}
            {fc != null && (
              <ReferenceDot
                x={end}
                y={fc}
                r={0}
                label={{
                  value: `prévision ≈ ${num(Math.round(fc))}`,
                  position: "insideBottomRight",
                  fill: c.elecStroke,
                  fontSize: 12,
                  dx: -2,
                  dy: fc > (view.next ?? Infinity) ? -10 : -12,
                }}
              />
            )}
            <ReferenceDot
              x={nowX}
              y={elec.month_kwh}
              r={5.5}
              fill={c.elecDot}
              stroke={c.elecStroke}
              strokeWidth={1.75}
              label={{
                value: `${kwhValue(elec.month_kwh)} kWh aujourd'hui`,
                position: "left",
                fill: c.ink,
                fontSize: 12,
                fontWeight: 600,
                dx: -6,
                dy: nearLine ? 16 : -12,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
