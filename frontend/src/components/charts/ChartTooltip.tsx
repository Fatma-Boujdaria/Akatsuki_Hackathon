import type { ReactNode } from "react";

export const AXIS_FONT = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';
export const SANS_FONT = '"Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif';

export function TooltipBox({ title, rows }: { title: ReactNode; rows: { label?: string; value: ReactNode; swatch?: ReactNode }[] }) {
  return (
    <div className="pointer-events-none rounded-ctl border border-hairline bg-surface px-3 py-2 font-mono text-[12px] leading-5 text-body">
      <div className="text-mute">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-ink tabular-nums">
          {r.swatch}
          {r.label && <span className="text-mute">{r.label}</span>}
          <span className="font-semibold">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Chart shell: title (Inter 600), unit label (Mono caps) on the right, then the plot. */
export function ChartCard({
  title,
  unit,
  children,
  footer,
  className = "",
}: {
  title: ReactNode;
  unit?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card border border-hairline bg-surface p-5 sm:p-6 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="t-h3 text-[17px] text-ink">{title}</h2>
        {unit && <span className="t-label text-mute">{unit}</span>}
      </div>
      {children}
      {footer && <div className="mt-3 text-[13px] leading-5 text-mute">{footer}</div>}
    </section>
  );
}
