import { useState } from "react";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { CATALOG_ORDER, applianceIcon, applianceLabel } from "../lib/appliances";
import { L } from "../lib/i18n";
import { kwh, num } from "../lib/format";
import type { ApplianceCatalogItem, ApplianceIn } from "../lib/types";
import { Field } from "./Field";
import { Button, cx } from "./ui";

// The household's appliance profile: what is in the home, how many, how long it runs.
// It gives an ESTIMATED baseline, never a measurement of one appliance.

const DAYS = 30;

export function estimateKwh(a: ApplianceIn, catalog: ApplianceCatalogItem[]): number {
  const typical = catalog.find((c) => c.category === a.category);
  const power = a.power_w ?? typical?.typical_power_w ?? 100;
  const hours = a.hours_per_day ?? typical?.typical_hours_per_day ?? 1;
  return (a.quantity * power * hours * DAYS) / 1000;
}

function numOrNull(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={L("Moins", "Less", "أقل")}
        onClick={() => onChange(Math.max(1, value - 1))}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-sunken text-ink hover:bg-hairline"
      >
        <Minus size={16} strokeWidth={2} />
      </button>
      <span className="w-8 text-center text-[16px] font-extrabold tabular-nums text-ink" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={L("Plus", "More", "أكثر")}
        onClick={() => onChange(Math.min(100, value + 1))}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-sunken text-ink hover:bg-hairline"
      >
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

function ItemDetails({
  item,
  typical,
  onChange,
  onRemove,
  catalog,
}: {
  item: ApplianceIn;
  typical?: ApplianceCatalogItem;
  onChange: (a: ApplianceIn) => void;
  onRemove?: () => void;
  catalog: ApplianceCatalogItem[];
}) {
  return (
    <div className="mt-3 space-y-3 border-t border-hairline pt-3">
      {item.category === "custom" && (
        <Field label={L("Nom de l'appareil", "Appliance name", "اسم الآلة")} value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} />
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold text-body">{L("Quantité", "Quantity", "العدد")}</span>
        <Stepper value={item.quantity} onChange={(quantity) => onChange({ ...item, quantity })} label={L("Quantité", "Quantity", "العدد")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={L("Puissance", "Power", "القوة")}
          inputMode="decimal"
          suffix="W"
          value={item.power_w ?? ""}
          placeholder={typical ? String(typical.typical_power_w) : "100"}
          onChange={(e) => onChange({ ...item, power_w: numOrNull(e.target.value) })}
          help={L("si tu la connais", "if you know it", "كان تعرفها")}
        />
        <Field
          label={L("Usage par jour", "Use per day", "الاستعمال في النهار")}
          inputMode="decimal"
          suffix="h"
          value={item.hours_per_day ?? ""}
          placeholder={typical ? String(typical.typical_hours_per_day) : "1"}
          onChange={(e) => onChange({ ...item, hours_per_day: numOrNull(e.target.value) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={L("Souvent de", "Usually from", "عادة من")}
          inputMode="numeric"
          suffix="h"
          value={item.start_hour ?? ""}
          placeholder="—"
          onChange={(e) => onChange({ ...item, start_hour: numOrNull(e.target.value) })}
        />
        <Field
          label={L("jusqu'à", "until", "حتى")}
          inputMode="numeric"
          suffix="h"
          value={item.end_hour ?? ""}
          placeholder="—"
          onChange={(e) => onChange({ ...item, end_hour: numOrNull(e.target.value) })}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-mute">
          ≈ {kwh(estimateKwh(item, catalog))} / {L("mois", "month", "شهر")} · {L("estimation", "estimate", "تقدير")}
        </p>
        {onRemove && (
          <Button variant="danger" onClick={onRemove} aria-label={L("Retirer", "Remove", "نحّي")}>
            <Trash2 size={16} strokeWidth={1.8} />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ApplianceEditor({
  items,
  onChange,
  catalog,
}: {
  items: ApplianceIn[];
  onChange: (items: ApplianceIn[]) => void;
  catalog: ApplianceCatalogItem[];
}) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const byCat = (c: string) => items.findIndex((i) => i.category === c);
  const total = items.reduce((s, a) => s + estimateKwh(a, catalog), 0);

  const toggle = (category: string) => {
    const idx = byCat(category);
    if (idx >= 0) {
      if (openCat === category) {
        onChange(items.filter((_, i) => i !== idx));
        setOpenCat(null);
      } else setOpenCat(category);
      return;
    }
    onChange([...items, { category, name: applianceLabel(category), quantity: category === "lighting" ? 6 : 1, power_w: null, hours_per_day: null }]);
    setOpenCat(category);
  };

  const update = (idx: number, a: ApplianceIn) => onChange(items.map((x, i) => (i === idx ? a : x)));
  const customs = items.map((a, i) => ({ a, i })).filter(({ a }) => a.category === "custom");

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-mute">
        {L(
          "Touche un appareil pour l'ajouter, touche-le encore pour le retirer. Laisse vide ce que tu ne connais pas : on prend une valeur typique.",
          "Tap an appliance to add it, tap again to remove it. Leave empty what you don't know: a typical value is used.",
          "انقر على آلة باش تزيدها، وعاود انقر باش تنحّيها. اللي ما تعرفوش خلّيه فارغ: ناخذو قيمة عادية.",
        )}
      </p>
      <ul className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
        {CATALOG_ORDER.map((cat) => {
          const idx = byCat(cat);
          const selected = idx >= 0;
          const typical = catalog.find((c) => c.category === cat);
          return (
            <li key={cat} className={cx("rounded-card bg-surface p-3", selected && "ring-2 ring-link")}>
              <button
                type="button"
                onClick={() => toggle(cat)}
                aria-pressed={selected}
                className="flex min-h-11 w-full cursor-pointer items-center gap-3 text-start"
              >
                <span
                  className={cx(
                    "inline-flex size-11 shrink-0 items-center justify-center rounded-ctl",
                    selected ? "bg-elec-soft text-elec-ink" : "bg-sunken text-mute",
                  )}
                >
                  {applianceIcon(cat)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink">{applianceLabel(cat)}</span>
                  <span className="block text-[12px] text-mute">
                    {selected
                      ? `× ${items[idx].quantity} · ≈ ${kwh(estimateKwh(items[idx], catalog))}/${L("mois", "mo", "شهر")}`
                      : typical
                        ? `≈ ${num(typical.typical_power_w)} W · ${num(typical.typical_hours_per_day, 1, false)} h/${L("j", "d", "نهار")}`
                        : ""}
                  </span>
                </span>
                {selected && <Check size={20} strokeWidth={2.2} className="shrink-0 text-link" aria-hidden />}
              </button>
              {selected && openCat === cat && (
                <ItemDetails item={items[idx]} typical={typical} catalog={catalog} onChange={(a) => update(idx, a)} />
              )}
            </li>
          );
        })}
      </ul>

      {customs.map(({ a, i }) => (
        <div key={i} className="rounded-card bg-surface p-3 ring-2 ring-link">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-ctl bg-elec-soft text-elec-ink">{applianceIcon("custom")}</span>
            <span className="text-[14px] font-bold text-ink">{a.name || L("Appareil personnalisé", "Custom appliance", "آلة خاصة")}</span>
          </div>
          <ItemDetails item={a} catalog={catalog} onChange={(x) => update(i, x)} onRemove={() => onChange(items.filter((_, k) => k !== i))} />
        </div>
      ))}

      <Button
        variant="secondary"
        block
        onClick={() =>
          onChange([...items, { category: "custom", name: "", quantity: 1, power_w: null, hours_per_day: null }])
        }
      >
        <Plus size={18} strokeWidth={2} aria-hidden /> {L("Ajouter un appareil personnalisé", "Add a custom appliance", "زيد آلة خاصة")}
      </Button>

      <div className="rounded-card bg-sunken p-4">
        <p className="text-[15px] font-bold text-ink">
          {L("Profil estimé", "Estimated profile", "البروفيل المقدّر")} : ≈ {kwh(total)} / {L("mois", "month", "شهر")}
        </p>
        <p className="mt-1 text-[12px] text-mute">
          {L(
            "Une estimation d'après ce que tu déclares, pas une mesure appareil par appareil : ton boîtier mesure la maison entière.",
            "An estimate from what you declare, not a per-appliance measurement: your box measures the whole house.",
            "تقدير على حساب اللي صرّحت بيه، موش قياس لكل آلة: البواطة تقيس الدار الكل.",
          )}
        </p>
      </div>
    </div>
  );
}
