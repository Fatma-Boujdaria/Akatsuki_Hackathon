import type { ReactNode } from "react";
import { Droplet, TriangleAlert, WifiOff, CircleAlert } from "lucide-react";
import type { Alert, Tip } from "../lib/types";
import type { TrancheView } from "../lib/tranche";
import { dateTime, dayMonth, dt, num } from "../lib/format";
import { L, lang } from "../lib/i18n";
import type { BannerTone } from "./status";

// Red means broken (leaks, sensor faults); a tranche that is near or crossed is a
// Chams heads-up; an offline box is neutral info. Texts come in three languages,
// rebuilt from the numbers the backend stored with each alert (params).

export interface AlertLook {
  tone: BannerTone;
  title: string;
  icon: ReactNode;
  /** Order on screen: broken first. */
  rank: number;
}

type P = Record<string, unknown>;
const n = (v: unknown, d = 0) => num(Number(v ?? 0), d, false);
const unitOf = (p: P) => (p.unit === "m3" ? "m³" : "kWh");

export function alertTitle(alert: Alert): string {
  switch (alert.type) {
    case "leak":
      return L("Fuite probable", "Probable leak", "تسريب ماء محتمل");
    case "sensor_fault":
      return alert.resource === "water"
        ? L("Capteur d'eau en panne", "Water sensor fault", "الكابتور متاع الماء معطّل")
        : L("Capteur d'électricité en panne", "Electricity sensor fault", "الكابتور متاع الضو معطّل");
    case "threshold": {
      const p = (alert.params ?? {}) as P;
      if (p.threshold != null && p.left != null && p.variant === "near")
        return L(
          `Tranche ${n(p.threshold)} ${unitOf(p)} dans ${n(p.left, Number(p.left) < 10 ? 1 : 0)} ${unitOf(p)}`,
          `${n(p.threshold)} ${unitOf(p)} tranche in ${n(p.left, Number(p.left) < 10 ? 1 : 0)} ${unitOf(p)}`,
          `شريحة ${n(p.threshold)} ${unitOf(p)} بعد ${n(p.left, Number(p.left) < 10 ? 1 : 0)} ${unitOf(p)}`,
        );
      return alert.resource === "water"
        ? L("Tranche d'eau suivante en vue", "Next water tranche ahead", "الشريحة الجاية متاع الماء قريبة")
        : L("Tranche suivante en vue", "Next tranche ahead", "الشريحة الجاية قريبة");
    }
    case "device_offline":
      return L("Appareil hors ligne", "Device offline", "البواطة مقطوعة");
    default:
      return L("Information", "Information", "معلومة");
  }
}

/** Alert body in the current language (French keeps the backend's text). */
export function alertText(alert: Alert): string {
  if (lang() === "fr" || !alert.params) return alert.message;
  const p = alert.params as P;
  switch (alert.type) {
    case "threshold": {
      const u = unitOf(p);
      const extra = dt(Number(p.extra_dt ?? alert.extra_cost_dt ?? 0));
      if (p.variant === "near")
        return L(
          "",
          `${n(p.left, 1)} ${u} left before the next tranche (${n(p.threshold)} ${u}). Crossing it would add about ${extra} to this month's bill (estimate).`,
          `باقي ${n(p.left, 1)} ${u} قبل الشريحة الجاية (${n(p.threshold)} ${u}). كان تتعدّاها، الفاتورة تزيد قريب ${extra} (تقدير).`,
        );
      return L(
        "",
        `At the current pace you will go over ${n(p.threshold)} ${u} this month (forecast ${n(p.forecast)} ${u}). That tranche would cost about ${extra} more (estimate).`,
        `بالريتم هذا باش تتعدّى ${n(p.threshold)} ${u} هالشهر (التوقع ${n(p.forecast)} ${u}). هذا يزيد قريب ${extra} (تقدير).`,
      );
    }
    case "leak":
      return L(
        "",
        `Water has been flowing non-stop since ${p.since} (${n(p.minutes)} min), about ${n(p.litres)} L. Check the toilet flush and taps.`,
        `الماء يجري بلا وقفة من ${p.since} (${n(p.minutes)} دقيقة)، قريب ${n(p.litres)} لتر. ثبّت في السيفون والروبينيات.`,
      );
    case "sensor_fault":
      return L(
        "",
        `The ${p.sensor === "water" ? "water (YF-S201)" : "electricity (PZEM-004T)"} sensor of device ${p.device} does not answer. Check its wiring.`,
        `الكابتور متاع ${p.sensor === "water" ? "الماء" : "الضو"} في ${p.device} ما يجاوبش. ثبّت في الخيوط.`,
      );
    case "device_offline": {
      const since = p.since ? dateTime(String(p.since)) : "";
      return L(
        "",
        `Device ${p.device} offline since ${since}. Check its Wi-Fi and power supply.`,
        `البواطة ${p.device} مقطوعة من ${since}. ثبّت في الويفي والكورون.`,
      );
    }
    default:
      return alert.message;
  }
}

export function alertLook(alert: Alert, tranche?: TrancheView | null): AlertLook {
  switch (alert.type) {
    case "leak":
      return { tone: "broken", title: alertTitle(alert), icon: <Droplet size={20} strokeWidth={1.75} className="text-grenade" />, rank: 0 };
    case "sensor_fault":
      return { tone: "broken", title: alertTitle(alert), icon: <CircleAlert size={20} strokeWidth={1.75} className="text-grenade" />, rank: 1 };
    case "threshold": {
      let title = alertTitle(alert);
      if (alert.resource === "electricity" && tranche) {
        if (tranche.crossingDate && tranche.state !== "near")
          title = L(
            `Tranche suivante vers le ${dayMonth(tranche.crossingDate)}`,
            `Next tranche around ${dayMonth(tranche.crossingDate)}`,
            `الشريحة الجاية حوالي ${dayMonth(tranche.crossingDate)}`,
          );
        else if (tranche.state === "crossed") title = L("Tranche dépassée", "Tranche crossed", "تعدّيت الشريحة");
      }
      return { tone: "headsup", title, icon: <TriangleAlert size={20} strokeWidth={1.75} className="text-harissa" />, rank: 2 };
    }
    case "device_offline":
      return { tone: "info", title: alertTitle(alert), icon: <WifiOff size={20} strokeWidth={1.75} className="text-ink" />, rank: 3 };
    default:
      return { tone: "info", title: alertTitle(alert), icon: <CircleAlert size={20} strokeWidth={1.75} className="text-ink" />, rank: 4 };
  }
}

/** Short title for lists, independent of the current tranche state. */
export function alertKind(alert: Alert): string {
  switch (alert.type) {
    case "leak":
      return L("Fuite probable", "Probable leak", "تسريب");
    case "sensor_fault":
      return L("Capteur en panne", "Sensor fault", "كابتور معطّل");
    case "threshold":
      return alert.resource === "water" ? L("Tranche d'eau", "Water tranche", "شريحة الماء") : L("Tranche STEG", "STEG tranche", "شريحة STEG");
    case "device_offline":
      return L("Appareil hors ligne", "Device offline", "البواطة مقطوعة");
    default:
      return L("Alerte", "Alert", "تنبيه");
  }
}

export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => alertLook(a).rank - alertLook(b).rank || b.created_at.localeCompare(a.created_at));
}

/** Tip text in the current language. French (or an AI rewording) keeps the backend text. */
export function tipText(tip: Tip): string {
  if (lang() === "fr") return tip.text;
  if (!tip.params && tip.code !== "offpeak") return tip.text; // older tips, stored before params existed
  const p = (tip.params ?? {}) as P;
  switch (tip.code) {
    case "threshold":
      return L(
        tip.text,
        `To stay under ${n(p.threshold)} kWh this month, cut about ${n(p.cut_kwh, 1)} kWh by month end (≈ ${n(p.per_day_kwh, 1)} kWh a day).`,
        `باش تبقى تحت ${n(p.threshold)} kWh هالشهر، نقّص قريب ${n(p.cut_kwh, 1)} kWh قبل آخر الشهر (≈ ${n(p.per_day_kwh, 1)} kWh في النهار).`,
      );
    case "keep_pace":
      return L(
        tip.text,
        `Well done: at this pace you stay under ${n(p.threshold)} kWh (forecast ${n(p.forecast_kwh)} kWh). Keep it up to avoid the jump.`,
        `برافو: بالريتم هذا تبقى تحت ${n(p.threshold)} kWh (التوقع ${n(p.forecast_kwh)} kWh). كمّل هكّا.`,
      );
    case "leak":
      return L(tip.text, `Fix the detected leak: at this flow it wastes about ${n(p.litres_day)} L a day.`, `صلّح التسريب: بهالدبي يضيّع قريب ${n(p.litres_day)} لتر في النهار.`);
    case "appliance":
      return L(
        tip.text,
        `An appliance of about ${n(p.kw, 1)} kW starts often. Using it 1 h less a day saves ≈ ${n(p.save_kwh, 1)} kWh.`,
        `فما آلة قريب ${n(p.kw, 1)} kW تشعل برشا. ساعة أقل في النهار توفّر ≈ ${n(p.save_kwh, 1)} kWh.`,
      );
    case "standby":
      return L(
        tip.text,
        `Your home draws at least ${n(p.base_w)} W all the time (standby). Unplug the box, TV and chargers at night: ≈ ${n(p.save_kwh, 1)} kWh less.`,
        `الدار تاكل على الأقل ${n(p.base_w)} W ديما (veille). فصّل البوكس والتلفزة والشارجورات في الليل: ≈ ${n(p.save_kwh, 1)} kWh أقل.`,
      );
    case "ac":
      return L(
        tip.text,
        `Set your air conditioner to 26 °C instead of 22 °C: you stay cool and, from your profile, save ≈ ${n(p.save_kwh, 1)} kWh.`,
        `حط الكليماتيزور على 26 درجة عوض 22: تبقى في البرودة وحسب البروفيل توفّر ≈ ${n(p.save_kwh, 1)} kWh.`,
      );
    case "water_heater":
      return L(
        tip.text,
        `Lower the water heater to 50 °C and put it on a timer: ≈ ${n(p.save_kwh, 1)} kWh less (profile estimate).`,
        `نقّص السخّان لـ 50 درجة وحطّو على مينوتري: ≈ ${n(p.save_kwh, 1)} kWh أقل (تقدير).`,
      );
    case "lighting":
      return L(
        tip.text,
        `Replace your ${n(p.bulbs)} classic bulbs with ${n(p.led_w)} W LEDs: ≈ ${n(p.save_kwh, 1)} kWh less.`,
        `بدّل ${n(p.bulbs)} لمبة عادية بـ LED متاع ${n(p.led_w)} W: ≈ ${n(p.save_kwh, 1)} kWh أقل.`,
      );
    case "offpeak":
      return L(
        tip.text,
        "If you can, run the washing machine and water heater outside the evening peak. It relieves the STEG grid, but does not change your bill.",
        "كان تنجم، شعّل الماكينة والسخّان برّا وقت الذروة متاع العشية. هذا يعاون STEG، أما ما يبدّلش الفاتورة.",
      );
    default:
      return tip.text;
  }
}
