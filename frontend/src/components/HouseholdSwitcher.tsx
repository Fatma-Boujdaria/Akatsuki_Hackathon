import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, House, Plus } from "lucide-react";
import { useHouseholds } from "../lib/households";
import { useData } from "../lib/data";
import { L } from "../lib/i18n";
import { cx } from "./ui";

/** "Ma maison ▾ / Tunis · en direct": opens the list of the account's homes. */
export function HouseholdSwitcher({ compact }: { compact?: boolean }) {
  const { households, current, switchTo } = useHouseholds();
  const { dashboard } = useData();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const d = dashboard.data;
  const online = d?.device?.online && d.live && !d.live.stale;
  const place = current?.address?.split(",")[0]?.trim();
  const status = !d
    ? L("chargement…", "loading…", "قاعد يتحمّل…")
    : d.state === "empty"
      ? L("aucune mesure", "no reading yet", "ما فماش قياس")
      : online
        ? L("en direct", "live", "مباشر")
        : L("hors ligne", "offline", "مقطوع");

  return (
    <div ref={box} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-11 min-w-0 cursor-pointer flex-col justify-center text-start"
      >
        <span className={cx("flex items-center gap-1.5 font-bold text-ink", compact ? "text-[16px]" : "text-[18px]")}>
          <span className="truncate">{current?.name ?? d?.household_name ?? L("Ma maison", "My home", "داري")}</span>
          <ChevronDown size={14} strokeWidth={2.2} aria-hidden className={cx("shrink-0 transition-transform", open && "rotate-180")} />
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-mute">
          {online && <span aria-hidden className="tg-live-dot size-1.5 rounded-full bg-success" />}
          {place ? `${place} · ` : ""}
          {status}
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={L("Mes foyers", "My homes", "دياري")}
          className="absolute start-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-card bg-surface shadow-[0_12px_40px_rgba(13,24,32,0.35)] ring-1 ring-hairline"
        >
          {households.map((h) => (
            <button
              key={h.id}
              type="button"
              role="option"
              aria-selected={h.id === current?.id}
              onClick={() => {
                switchTo(h.id);
                setOpen(false);
              }}
              className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-2 text-start hover:bg-sunken"
            >
              <House size={18} strokeWidth={1.8} className="shrink-0 text-mute" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-ink">{h.name}</span>
                <span className="block truncate text-[12px] text-mute">
                  {h.address || `${h.subscribed_kva} kVA`}
                  {h.unread_alerts > 0 && ` · ${h.unread_alerts} ${L("alerte(s)", "alert(s)", "تنبيه")}`}
                </span>
              </span>
              {h.id === current?.id && <Check size={18} strokeWidth={2} className="shrink-0 text-link" aria-hidden />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/foyers?nouveau=1");
            }}
            className="flex min-h-12 w-full cursor-pointer items-center gap-3 border-t border-hairline px-4 text-start text-[14px] font-bold text-link hover:bg-sunken"
          >
            <Plus size={18} strokeWidth={2} aria-hidden /> {L("Ajouter un foyer", "Add a home", "زيد دار")}
          </button>
        </div>
      )}
    </div>
  );
}
