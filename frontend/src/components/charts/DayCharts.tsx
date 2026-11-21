import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Series } from "../../lib/types";
import { useChartColors } from "../../lib/theme";
import { flow, num, watts } from "../../lib/format";
import { fractionalHour } from "../../lib/time";
import { AXIS_FONT, ChartCard, TooltipBox } from "./ChartTooltip";
import { Skeleton } from "../ui";

interface Pt {
  x: number;
  v: number | null;
}

function toPoints(series: Series | null, key: "power_w" | "flow_l_min"): Pt[] {
  if (!series) return [];
  return series.points.map((p) => ({ x: +fractionalHour(new Date(p.ts)).toFixed(4), v: p.reliable ? p[key] : null }));
}

function hhmm(x: number): string {
  const h = Math.floor(x);
  const m = Math.round((x - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m === 60 ? 59 : m).padStart(2, "0")}`;
}

function niceMax(values: (number | null)[], live: number | null, floor: number): number {
  const max = Math.max(floor, live ?? 0, ...values.map((v) => v ?? 0));
  const mag = 10 ** Math.floor(Math.log10(max));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find((s) => s * mag >= max) ?? 10;
  return step * mag;
}

const HOUR_TICKS = [0, 6, 12, 18, 24];

function Strip({
  kind,
  data,
  liveX,
  liveValue,
  showAxis,
  height,
}: {
  kind: "power" | "flow";
  data: Pt[];
  liveX: number;
  liveValue: number | null;
  showAxis: boolean;
  height: number;
}) {
  const c = useChartColors();
  const isPower = kind === "power";
  const stroke = isPower ? c.elecStroke : c.waterStroke;
  const fill = isPower ? c.elecFill : c.waterFill;
  const fmt = isPower ? watts : flow;
  const yMax = niceMax(
    data.map((d) => d.v),
    liveValue,
    isPower ? 500 : 2,
  );
  const plotted = liveValue != null ? [...data, { x: liveX, v: liveValue }] : data;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={plotted}
          syncId="today"
          syncMethod="value"
          margin={{ top: 8, right: 84, bottom: 0, left: -8 }}
        >
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 24]}
            ticks={HOUR_TICKS}
            tickFormatter={(h: number) => `${h} h`}
            tick={showAxis ? { fontFamily: AXIS_FONT, fontSize: 11, fill: c.axis } : false}
            axisLine={{ stroke: c.grid }}
            tickLine={false}
            tickMargin={8}
            height={showAxis ? 26 : 1}
          />
          <YAxis
            domain={[0, yMax]}
            ticks={[0, yMax / 2, yMax]}
            tickFormatter={(v: number) => (isPower ? num(v) : num(v, 2, false))}
            tick={{ fontFamily: AXIS_FONT, fontSize: 11, fill: c.axis }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: c.cursor, strokeWidth: 1, strokeDasharray: "2 3" }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const pt = payload[0].payload as Pt;
              return (
                <TooltipBox
                  title={hhmm(pt.x)}
                  rows={[
                    {
                      label: isPower ? "puissance" : "débit",
                      value: pt.v == null ? "mesure peu fiable" : fmt(pt.v),
                    },
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={2}
            fill={fill}
            fillOpacity={1}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4, fill: stroke, stroke: c.surface, strokeWidth: 2 }}
          />
          {liveValue != null &&
            (isPower ? (
              <ReferenceDot
                x={liveX}
                y={liveValue}
                r={5.5}
                fill={c.elecDot}
                stroke={c.elecStroke}
                strokeWidth={1.75}
                ifOverflow="visible"
                label={{ value: watts(liveValue), position: "right", fill: c.ink, fontSize: 12, fontFamily: AXIS_FONT, dx: 4 }}
              />
            ) : (
              <ReferenceDot
                x={liveX}
                y={liveValue}
                r={5}
                ifOverflow="visible"
                shape={(props: { cx?: number; cy?: number }) => (
                  // Square marker for water: shape, not only colour, tells the series apart
                  <rect x={(props.cx ?? 0) - 4.5} y={(props.cy ?? 0) - 4.5} width={9} height={9} rx={1.5} fill={c.waterStroke} />
                )}
                label={{ value: flow(liveValue), position: "right", fill: c.ink, fontSize: 12, fontFamily: AXIS_FONT, dx: 6 }}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * "Aujourd'hui": power and water flow in two stacked charts sharing one time axis.
 * Never a dual axis (charter board 06).
 */
export function DayCharts({
  power,
  water,
  livePower,
  liveFlow,
  now,
  show = "both",
  title = "Aujourd'hui",
}: {
  power: Series | null;
  water: Series | null;
  livePower: number | null;
  liveFlow: number | null;
  now: Date;
  show?: "both" | "power" | "flow";
  title?: string;
}) {
  const powerPts = useMemo(() => toPoints(power, "power_w"), [power]);
  const flowPts = useMemo(() => toPoints(water, "flow_l_min"), [water]);
  const liveX = fractionalHour(now);
  const loading = (show !== "flow" && !power) || (show !== "power" && !water);

  return (
    <ChartCard title={title} unit={show === "both" ? "même axe du temps" : show === "power" ? "puissance · W" : "débit · L/min"}>
      {loading ? (
        <Skeleton className={show === "both" ? "h-[260px]" : "h-[200px]"} />
      ) : (
        <div className="space-y-1">
          {show !== "flow" && (
            <div>
              {show === "both" && <p className="t-label mb-1 text-elec-ink">Puissance · W</p>}
              <Strip kind="power" data={powerPts} liveX={liveX} liveValue={livePower} showAxis={show === "power"} height={show === "both" ? 112 : 200} />
            </div>
          )}
          {show !== "power" && (
            <div className={show === "both" ? "pt-2" : ""}>
              {show === "both" && <p className="t-label mb-1 text-water-ink">Débit · L/min</p>}
              <Strip kind="flow" data={flowPts} liveX={liveX} liveValue={liveFlow} showAxis height={show === "both" ? 138 : 200} />
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
