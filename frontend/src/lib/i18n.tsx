import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setFormatLocale } from "./format";

// Three languages: French (default), English and Tunisian Arabic (derja, Arabic
// script, right to left). Texts are written inline where they are used:
//
//     L("Tableau de bord", "Dashboard", "لوحة القيادة")
//
// so a screen and its three versions are read together. Changing the language
// re-renders the whole app (the provider keys its children by language).

export type Lang = "fr" | "en" | "ar";
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "fr", label: "Français", short: "FR" },
  { code: "en", label: "English", short: "EN" },
  { code: "ar", label: "تونسي", short: "تونسي" },
];
const KEY = "tg-lang";

let current: Lang = readLang();

function readLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "fr" || v === "en" || v === "ar") return v;
  } catch {
    /* private mode */
  }
  return "fr";
}

/** Current language, usable outside React components (formatters, alert titles). */
export function lang(): Lang {
  return current;
}

/** Pick the text of the current language. Arabic falls back to French when missing. */
export function L(fr: string, en: string, ar?: string): string {
  if (current === "en") return en;
  if (current === "ar") return ar ?? fr;
  return fr;
}

/** Same with values: L3({fr: ..., en: ..., ar: ...}). */
export function pick<T>(v: { fr: T; en: T; ar?: T }): T {
  if (current === "en") return v.en;
  if (current === "ar") return v.ar ?? v.fr;
  return v.fr;
}

function apply(l: Lang) {
  current = l;
  setFormatLocale(l);
  const html = document.documentElement;
  html.lang = l === "ar" ? "ar-TN" : l;
  html.dir = l === "ar" ? "rtl" : "ltr";
}
apply(current);

interface I18nCtx {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<Lang>(current);

  const setLang = useCallback((l: Lang) => {
    apply(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* not persisted */
    }
    setValue(l);
  }, []);

  useEffect(() => apply(value), [value]);

  const ctx = useMemo<I18nCtx>(() => ({ lang: value, dir: value === "ar" ? "rtl" : "ltr", setLang }), [value, setLang]);
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

/** Re-mounts its children when the language changes, so every L(...) text is redrawn. */
export function LangRemount({ children }: { children: ReactNode }) {
  const { lang: l } = useI18n();
  return (
    <div key={l} className="contents">
      {children}
    </div>
  );
}

export function useI18n(): I18nCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
