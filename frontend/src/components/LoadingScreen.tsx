import { L } from "../lib/i18n";
import { LogoMark, Wordmark } from "./Logo";

// Start-up screen: the shield's tranche bars rise in turn, a current runs along a
// thin line under the wordmark, and a short welcome. Respects reduced motion.

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div
      className="grid min-h-dvh place-items-center bg-canvas px-6"
      role="status"
      aria-live="polite"
      aria-label={L("Chargement", "Loading", "قاعد يتحمّل")}
    >
      <div className="flex flex-col items-center text-center tg-fade-up">
        <div className="relative">
          <LogoMark size={88} state="loading" title="" />
          {/* Energy spark orbiting the shield */}
          <svg width="120" height="120" viewBox="0 0 120 120" className="pointer-events-none absolute -inset-4" aria-hidden>
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--chams)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="2 9"
              className="tg-flow"
            />
          </svg>
        </div>
        <Wordmark className="mt-6 text-[30px]" />
        <p className="mt-1 text-[15px] text-mute">{L("Ta facture, sans surprise", "Your bill, no surprises", "فاتورتك، بلا مفاجآت")}</p>
        <div className="mt-8 h-1.5 w-44 overflow-hidden rounded-full bg-hairline" aria-hidden>
          <div className="tg-loading-bar h-full w-1/3 rounded-full bg-chams" />
        </div>
        <p className="mt-4 text-[13px] font-semibold text-body">
          {message ?? L("On prépare ton tableau de bord…", "Getting your dashboard ready…", "قاعدين نحضّرولك الداشبورد…")}
        </p>
      </div>
    </div>
  );
}
