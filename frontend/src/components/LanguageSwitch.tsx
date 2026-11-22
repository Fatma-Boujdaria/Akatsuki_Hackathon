import { Languages } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LANGS, L, useI18n, type Lang } from "../lib/i18n";
import { cx } from "./ui";

/** FR · EN · تونسي. Saved in the browser and, when logged in, in the account. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const { user, setUser } = useAuth();

  const choose = (l: Lang) => {
    if (l === lang) return;
    setLang(l);
    if (user) {
      api
        .updateMe({ language: l })
        .then(setUser)
        .catch(() => {
          /* the browser keeps the choice even if the account could not be updated */
        });
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={L("Langue", "Language", "اللغة")}
      className={cx("flex items-center gap-1 rounded-full bg-sunken p-1", className)}
    >
      <Languages size={16} strokeWidth={1.8} className="ms-2 shrink-0 text-mute" aria-hidden />
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={lang === l.code}
          lang={l.code === "ar" ? "ar-TN" : l.code}
          onClick={() => choose(l.code)}
          className={cx(
            "h-8 flex-1 cursor-pointer rounded-full px-2.5 text-[12px] transition-colors",
            lang === l.code ? "bg-chip-active font-bold text-on-chip-active" : "font-semibold text-chip hover:text-ink",
          )}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
