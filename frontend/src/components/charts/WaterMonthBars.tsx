import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Series } from "../../lib/types";
import { useChartColors } from "../../lib/theme";
import { dayMonth, litres, num } from "../../lib/format";
import { localParts } from "../../lib/time";
import { AXIS_FONT, ChartCard, TooltipBox } from "./ChartTooltip";
import { Skeleton } from "../ui";

/** Litres per day this month: Ciel fills, the water ink only for text. */
export function WaterMonthBars({ series, now }: { series: Series | null; now: Date }) {
  const c = useChartColors();
  const today = localParts(now);
  const data = useMemo(
    () =>
      (series?.points ?? [])
        .map((p) => {
          const lp = localParts(new Date(p.ts));
          return { day: lp.d, mo: lp.mo, litres: Math.round(p.volume_l ?? 0), ts: p.ts };
        })
        .filter((p) => p.mo === today.mo),
    [series, today.mo],
  );

  if (!series) {
    return (
      <ChartCard title="Litres par jour" unit="L · ce mois-ci">
        <Skeleton className="h-[220px]" />
      </ChartCard>
    );
  }
  const avg = data.length ? data.reduce((s, d) => s + d.litres, 0) / data.length : 0;

  return (
    <ChartCard title="Litres par jour" unit="L · ce mois-ci" footer={data.length ? `Moyenne : ${litres(avg)} par jour.` : undefined}>
      <div className="h-[220px]" role="img" aria-label={`Litres par jour ce mois-ci, moyenne ${num(Math.round(avg))} litres.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis
              dataKey="day"
              tick={{ fontFamily: AXIS_FONT, fontSize: 11, fill: c.axis }}
              axisLine={{ stroke: c.grid }}
              tickLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={14}
            />
            <YAxis
              tick={{ fontFamily: AXIS_FONT, fontSize: 11, fill: c.axis }}
              tickFormatter={(v: number) => num(v)}
              axisLine={false}
              tickLine={false}
              width={52}
              tickCount={4}
            />
            <Tooltip
              cursor={{ fill: c.grid, fillOpacity: 0.35 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as (typeof data)[number];
                return (
                  <TooltipBox
                    title={`${dayMonth(pt.ts)}${pt.day === today.d ? " · en cours" : ""}`}
                    rows={[{ value: litres(pt.litres) }]}
                  />
                );
              }}
            />
            <Bar dataKey="litres" fill="#76B9FF" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
