import { useTheme } from "../lib/theme";
import { L } from "../lib/i18n";
import { num } from "../lib/format";
import type { ApplianceShare } from "../lib/types";
import { cx } from "./ui";

// The design's home illustration: an isometric house fed by STEG (left, Chams) and
// SONEDE (right, Ciel), with dotted lines to the main appliances. The lines flow while
// power or water is measured. Appliance chips show the declared PROFILE (share of the
// month, estimate), never a per-appliance measurement: the box measures the whole house.

const PALETTE = {
  dark: {
    elec: "#FEBD19",
    water: "#76B9FF",
    shadow: "#0A1219",
    front: "#E8EEF5",
    side: "#AFC1D4",
    eave: "#2A3F55",
    window: "#FEF3B3",
    door: "#24384C",
    box: "#0D1820",
  },
  light: {
    elec: "#E0A000",
    water: "#1D59BB",
    shadow: "#D5E1EC",
    front: "#FFFFFF",
    side: "#C9D6E4",
    eave: "#0D1820",
    window: "#FEBD19",
    door: "#24384C",
    box: "#0D1820",
  },
} as const;

function Chip({ label, value, tone, className, stale }: { label: string; value: string; tone?: "elec" | "water"; className?: string; stale?: boolean }) {
  return (
    <div className={cx("rounded-[14px] bg-surface px-3 py-2", className)}>
      <div className="text-[11px] leading-4 text-mute">{label}</div>
      <div
        className={cx(
          "text-[17px] leading-6 font-extrabold tabular-nums",
          stale ? "text-mute" : tone === "elec" ? "text-elec-ink" : tone === "water" ? "text-water-ink" : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function HouseScene({
  powerW,
  flowLMin,
  appliances,
  focus = "all",
  unreliable,
  stale,
}: {
  powerW: number | null;
  flowLMin: number | null;
  appliances: ApplianceShare[];
  focus?: "all" | "electricity" | "water";
  unreliable?: boolean;
  /** Device offline / last reading old: values shown grey as "last received". */
  stale?: boolean;
}) {
  const c = PALETTE[useTheme().resolved];
  const elecOn = !stale && (powerW ?? 0) > 0;
  const waterOn = !stale && (flowLMin ?? 0) > 0;
  const dimElec = focus === "water";
  const dimWater = focus === "electricity";
  const top = appliances.slice(0, 3);
  const none = L("— ", "— ", "— ");

  return (
    <div className="relative mx-auto h-[290px] w-full max-w-[420px]" dir="ltr">
      <svg
        viewBox="0 0 390 290"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={L(
          "Maison avec flux d'électricité et d'eau vers les appareils",
          "House with electricity and water flowing to the appliances",
          "دار فيها الضو والماء ماشيين للآلات",
        )}
      >
        <path
          d="M76 60 C76 100 118 104 140 140"
          fill="none"
          stroke={c.elec}
          strokeWidth="2.5"
          strokeDasharray="2 7"
          strokeLinecap="round"
          opacity={dimElec ? 0.25 : 1}
          className={elecOn ? "tg-flow" : undefined}
        />
        <path
          d="M314 60 C314 110 292 124 274 166"
          fill="none"
          stroke={c.water}
          strokeWidth="2.5"
          strokeDasharray="2 7"
          strokeLinecap="round"
          opacity={dimWater ? 0.25 : 1}
          className={waterOn ? "tg-flow" : undefined}
        />
        {top.length > 0 &&
          ["M150 228 C150 240 80 236 70 246", "M195 230 V246", "M240 228 C240 240 310 236 320 246"].slice(0, top.length).map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={c.elec}
              strokeWidth="2"
              strokeDasharray="2 6"
              strokeLinecap="round"
              opacity={dimElec ? 0.25 : 1}
              className={elecOn ? "tg-flow" : undefined}
            />
          ))}
        <ellipse cx="195" cy="232" rx="118" ry="12" fill={c.shadow} />
        <g transform="translate(40 55)">
          <polygon points="60,110 110,72 160,110 160,170 60,170" fill={c.front} />
          <polygon points="160,110 250,92 250,152 160,170" fill={c.side} />
          <polygon points="110,72 200,54 250,92 160,110" fill="#1D59BB" />
          <polygon points="110,72 200,54 204,58 114,76" fill="#76B9FF" />
          <polygon points="56,112 110,70 114,74 60,115" fill={c.eave} />
          <rect x="98" y="134" width="24" height="36" rx="2" fill={c.door} />
          <rect x="129" y="120" width="22" height="18" rx="2" fill={c.window} opacity={elecOn ? 1 : 0.45} />
          <polygon points="178,120 204,115 204,133 178,138" fill="#FEF3B3" opacity={elecOn ? 1 : 0.45} />
          <polygon points="216,112 238,108 238,126 216,130" fill="#FEF3B3" opacity={elecOn ? 1 : 0.45} />
          <rect x="226" y="134" width="14" height="18" rx="2" fill={c.box} />
          <path d="M234 137 L230 144 H233 L231 150 L236 142 H233 Z" fill="#FEBD19" />
        </g>
      </svg>

      <Chip
        className={cx("absolute start-4 top-1.5", dimElec && "opacity-50")}
        label={L("STEG · réseau", "STEG · grid", "STEG · الشبكة")}
        value={unreliable ? L("peu fiable", "unreliable", "موش مضمون") : powerW != null ? `${num(powerW / 1000, 2)} kW` : none}
        tone="elec"
        stale={stale}
      />
      <Chip
        className={cx("absolute end-4 top-1.5 text-end", dimWater && "opacity-50")}
        label={L("SONEDE · eau", "SONEDE · water", "SONEDE · الماء")}
        value={unreliable ? L("peu fiable", "unreliable", "موش مضمون") : flowLMin != null ? `${num(flowLMin, 1)} L/min` : none}
        tone="water"
        stale={stale}
      />

      {top.length > 0 ? (
        <div className={cx("absolute inset-x-4 top-[246px] grid gap-2", top.length === 1 ? "grid-cols-1" : top.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
          {top.map((a) => (
            <div key={a.id ?? a.name} className={cx("rounded-[12px] bg-surface px-2.5 py-1.5", dimElec && "opacity-50")}>
              <div className="truncate text-[11px] leading-4 text-mute">{a.name}</div>
              <div className="text-[14px] leading-5 font-bold tabular-nums text-ink" title={L("Part estimée d'après ton profil", "Estimated share from your profile", "نسبة مقدّرة حسب البروفيل")}>
                ≈ {a.share_pct} %
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="absolute inset-x-4 top-[252px] text-center text-[12px] text-mute">
          {L("Déclare tes appareils pour voir leur part estimée.", "Declare your appliances to see their estimated share.", "صرّح بالآلات متاعك باش تشوف نسبتهم.")}
        </p>
      )}
    </div>
  );
}

/** Tiny line chart of the design's two bottom cards. */
export function Sparkline({ values, tone }: { values: number[]; tone: "elec" | "water" }) {
  const c = PALETTE[useTheme().resolved];
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return <div className="h-11" aria-hidden />;
  const max = Math.max(...pts, 0.0001);
  const step = 140 / (pts.length - 1);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(40 - (v / max) * 34).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height="44" viewBox="0 0 140 44" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={tone === "elec" ? c.elec : c.water} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Group a per-minute series into ~24 points for a sparkline. */
export function downsample(values: number[], target = 24): number[] {
  if (values.length <= target) return values;
  const size = values.length / target;
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    const chunk = values.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    out.push(chunk.reduce((s, v) => s + v, 0) / Math.max(1, chunk.length));
  }
  return out;
}
