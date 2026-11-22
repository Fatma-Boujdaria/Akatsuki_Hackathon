import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { L } from "../lib/i18n";
import { LogoMark, Wordmark } from "./Logo";
import { LanguageSwitch } from "./LanguageSwitch";

/** Login artboard: shield logo, wordmark, tagline, the form, privacy note at the bottom. */
export function AuthShell({ children, footer, title }: { children: ReactNode; footer?: ReactNode; title?: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-7 pt-10 pb-8 sm:pt-16">
      <div className="mx-auto flex w-full max-w-sm justify-end">
        <LanguageSwitch className="w-auto" />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="mt-6 flex flex-col items-center gap-3.5 text-center">
          <LogoMark size={88} title={L("Logo Tranche Guard", "Tranche Guard logo", "لوغو Tranche Guard")} />
          <Wordmark className="text-[32px] tracking-[-1px]" />
          <p className="text-[15px] text-mute">{L("Ta facture, sans surprise", "Your bill, no surprises", "فاتورتك، بلا مفاجآت")}</p>
        </div>
        {title && <h1 className="mt-10 text-center text-[20px] font-extrabold text-ink">{title}</h1>}
        <div className={title ? "mt-6" : "mt-12"}>{children}</div>
        <div className="mt-auto flex flex-col items-center gap-4 pt-10 text-center">
          <p className="flex items-center gap-2.5 text-[13px] text-mute">
            <Lock size={16} strokeWidth={1.8} aria-hidden />
            {L("Tes données restent privées et chiffrées", "Your data stays private and encrypted", "المعطيات متاعك تبقى خاصة ومشفّرة")}
          </p>
          {footer}
        </div>
      </div>
    </div>
  );
}
