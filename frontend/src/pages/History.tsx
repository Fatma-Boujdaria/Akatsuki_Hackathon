import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { usePoll } from "../lib/usePoll";
import { useData } from "../lib/data";
import { L } from "../lib/i18n";
import { dt, kwhValue, m3, num } from "../lib/format";
import type { HistoryMonth } from "../lib/types";
import { Banner } from "../components/status";
import { Card, CardHeader, Chip, Estimation, PageHeader, Skeleton, cx } from "../components/ui";

function monthLabel(key: string, style: "short" | "long" = "short"): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 15));
  return new Intl.DateTimeFormat(document.documentElement.lang || "fr", { month: style, year: style === "long" ? "numeric" : undefined }).format(d);
}

function Bars({
  months,
  value,
  tone,
  thresholds = [],
  unit,
}: {
  months: HistoryMonth[];
  value: (m: HistoryMonth) => number;
  tone: "elec" | "water";
  thresholds?: number[];
  unit: string;
}) {
  const max = Math.max(1, ...months.map(value), ...thresholds.filter((t) => t < Math.max(...months.map(value)) * 1.4));
  const lines = thresholds.filter((t) => t <= max);
  return (
    <div className="relative" dir="ltr">
      <div className="relative flex h-44 items-end gap-1.5">
        {lines.map((t) => (
          <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-harissa/70" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -top-4 right-0 text-[10px] font-bold text-harissa">{num(t)} {unit}</span>
          </div>
        ))}
        {months.map((m) => {
          const v = value(m);
          return (
            <div key={m.month} className="flex h-full flex-1 flex-col justify-end" title={`${monthLabel(m.month, "long")} : ${num(v, 1, false)} ${unit}`}>
              <div
                className={cx(
                  "w-full rounded-t-[6px]",
                  v === 0 ? "bg-hairline" : tone === "elec" ? "bg-elec" : "bg-water",
                  m.partial && "opacity-60",
                )}
                style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10px] text-mute">
        {months.map((m) => (
          <span key={m.month} className="flex-1 truncate text-center">
            {monthLabel(m.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HistoryPage() {
  const [months, setMonths] = useState(6);
  const history = usePoll((s) => api.history(months, s), 120_000, [months]);
  const { dashboard } = useData();
  const thresholds = dashboard.data?.electricity.thresholds_kwh ?? [];
  const rows = history.data?.months ?? [];

  const totals = useMemo(() => {
    const done = rows.filter((r) => !r.partial && r.kwh > 0);
    const avg = done.length ? done.reduce((s, r) => s + r.kwh, 0) / done.length : null;
    const avgBill = done.filter((r) => r.bill_dt != null).length
      ? done.reduce((s, r) => s + (r.bill_dt ?? 0), 0) / done.filter((r) => r.bill_dt != null).length
      : null;
    return { avg, avgBill };
  }, [rows]);

  return (
    <>
      <PageHeader
        title={L("Historique", "History", "التاريخ")}
        aside={
          <div className="flex gap-2">
            {[6, 12].map((n) => (
              <Chip key={n} active={months === n} onClick={() => setMonths(n)}>
                {L(`${n} mois`, `${n} months`, `${n} شهر`)}
              </Chip>
            ))}
          </div>
        }
      />
      {history.error && !history.data && (
        <Banner tone="broken" role="alert">
          {history.error}
        </Banner>
      )}
      {!history.data && !history.error ? (
        <div className="space-y-3">
          <Skeleton className="h-60" />
          <Skeleton className="h-60" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
          <Card>
            <CardHeader title={L("Électricité par mois", "Electricity per month", "الضو في الشهر")} aside="kWh" />
            <Bars months={rows} value={(m) => m.kwh} tone="elec" thresholds={thresholds} unit="kWh" />
            {totals.avg != null && (
              <p className="mt-3 text-[13px] text-mute">
                {L("Moyenne des mois complets", "Average of full months", "معدّل الأشهر الكاملة")} : <strong className="text-ink">{kwhValue(totals.avg)} kWh</strong>
                {totals.avgBill != null && (
                  <>
                    {" "}
                    · ≈ {dt(totals.avgBill)} <Estimation />
                  </>
                )}
              </p>
            )}
          </Card>
          <Card>
            <CardHeader title={L("Eau par mois", "Water per month", "الماء في الشهر")} aside="m³" />
            <Bars months={rows} value={(m) => m.litres / 1000} tone="water" unit="m³" />
          </Card>

          <Card className="lg:col-span-2 !p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13px]">
                <caption className="sr-only">{L("Consommation et facture estimée par mois", "Consumption and estimated bill per month", "الاستهلاك والفاتورة المقدّرة في كل شهر")}</caption>
                <thead>
                  <tr className="text-mute">
                    <th className="px-4 py-3 text-start font-semibold">{L("Mois", "Month", "الشهر")}</th>
                    <th className="px-4 py-3 text-end font-semibold">kWh</th>
                    <th className="px-4 py-3 text-end font-semibold">{L("Tranche", "Tranche", "الشريحة")}</th>
                    <th className="px-4 py-3 text-end font-semibold">{L("Facture STEG", "STEG bill", "فاتورة STEG")}</th>
                    <th className="px-4 py-3 text-end font-semibold">{L("Eau", "Water", "الماء")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {[...rows].reverse().map((r) => (
                    <tr key={r.month} className="text-ink">
                      <td className="px-4 py-3 font-semibold">
                        {monthLabel(r.month, "long")}
                        {r.partial && <span className="ms-2 text-[11px] font-bold text-elec-ink">{L("en cours", "in progress", "جاري")}</span>}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">{r.kwh > 0 ? kwhValue(r.kwh) : "—"}</td>
                      <td className="px-4 py-3 text-end">{r.tranche_index ?? "—"}</td>
                      <td className="px-4 py-3 text-end font-bold tabular-nums">{r.bill_dt != null ? `≈ ${dt(r.bill_dt)}` : "—"}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{r.litres > 0 ? m3(r.litres / 1000) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-hairline px-4 py-3 text-[12px] text-mute">
              {L(
                "Montants estimés avec la grille STEG en vigueur ce mois-là. Pas une facture officielle. L'eau n'a pas de montant tant que la grille SONEDE n'est pas vérifiée.",
                "Amounts estimated with the STEG grid in force that month. Not an official bill. Water has no amount until the SONEDE grid is verified.",
                "المبالغ مقدّرة بجدول STEG متاع الشهر هذاكا. موش فاتورة رسمية. الماء ما عندوش مبلغ قبل ما يتثبّت جدول SONEDE.",
              )}
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
