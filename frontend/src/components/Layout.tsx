import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell,
  Cpu,
  Droplet,
  History,
  House,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  UserRound,
  Warehouse,
  Zap,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useData } from "../lib/data";
import { initial, useAuth } from "../lib/auth";
import { useVirtualEsp } from "../lib/virtualEsp";
import { L } from "../lib/i18n";
import { registerServiceWorker, useAlertNotifications } from "../lib/notify";
import { Logo, type LogoState } from "./Logo";
import { DevicePill, Pill } from "./status";
import { HouseholdSwitcher } from "./HouseholdSwitcher";
import { LanguageSwitch } from "./LanguageSwitch";
import { cx } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const icon = (C: typeof House) => <C size={22} strokeWidth={1.8} aria-hidden />;

function sideNav(isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [
    { to: "/", label: L("Tableau de bord", "Dashboard", "لوحة القيادة"), icon: icon(House), end: true },
    { to: "/electricite", label: L("Électricité", "Electricity", "الضو"), icon: icon(Zap) },
    { to: "/eau", label: L("Eau", "Water", "الماء"), icon: icon(Droplet) },
    { to: "/assistant", label: L("Assistant IA", "AI assistant", "المساعد الذكي"), icon: icon(Sparkles) },
    { to: "/alertes", label: L("Alertes", "Alerts", "التنبيهات"), icon: icon(Bell) },
    { to: "/historique", label: L("Historique", "History", "التاريخ"), icon: icon(History) },
    { to: "/defis", label: L("Défis", "Challenges", "التحديات"), icon: icon(Trophy) },
    { to: "/foyers", label: L("Mes foyers", "My homes", "دياري"), icon: icon(Warehouse) },
    { to: "/reglages", label: L("Paramètres", "Settings", "الإعدادات"), icon: icon(SlidersHorizontal) },
    { to: "/aide", label: L("Aide et support", "Help & support", "المساعدة"), icon: icon(LifeBuoy) },
  ];
  if (isAdmin) items.push({ to: "/admin", label: L("Administration", "Admin", "الإدارة"), icon: icon(ShieldCheck) });
  return items;
}

function bottomNav(): NavItem[] {
  return [
    { to: "/", label: L("Accueil", "Home", "الرئيسية"), icon: icon(House), end: true },
    { to: "/electricite", label: L("Électricité", "Electricity", "الضو"), icon: icon(Zap) },
    { to: "/eau", label: L("Eau", "Water", "الماء"), icon: icon(Droplet) },
    { to: "/defis", label: L("Défis", "Challenges", "التحديات"), icon: icon(Trophy) },
    { to: "/profil", label: L("Profil", "Profile", "حسابي"), icon: icon(UserRound) },
  ];
}

function useLogoState(): LogoState {
  const { dashboard, tranche } = useData();
  if (!dashboard.data && dashboard.loading) return "loading";
  if (tranche?.state === "near") return "near";
  if (tranche?.state === "crossed") return "crossed";
  return "default";
}

/** Round bell (dot when an alert is open) and avatar of the design's header. */
export function HeaderActions() {
  const { dashboard } = useData();
  const { user } = useAuth();
  const count = dashboard.data?.active_alerts.length ?? 0;
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <Link
        to="/alertes"
        aria-label={count ? L(`Alertes, ${count} non lues`, `Alerts, ${count} unread`, `التنبيهات، ${count} جديدة`) : L("Alertes", "Alerts", "التنبيهات")}
        className="relative inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink hover:bg-sunken"
      >
        <Bell size={20} strokeWidth={1.8} aria-hidden />
        {count > 0 && <span aria-hidden className="absolute end-[11px] top-[10px] size-2 rounded-full bg-chams" />}
      </Link>
      <Link
        to="/profil"
        aria-label={L("Profil", "Profile", "حسابي")}
        className="inline-flex size-11 items-center justify-center rounded-full bg-bahr text-[15px] font-bold text-white no-underline"
      >
        {initial(user)}
      </Link>
    </div>
  );
}

export function Layout() {
  const { dashboard } = useData();
  const { user, logout } = useAuth();
  const esp = useVirtualEsp();
  const logoState = useLogoState();
  const alertCount = dashboard.data?.active_alerts.length ?? 0;
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // Phone / browser notifications for new alerts (when the user enabled them).
  useAlertNotifications(dashboard.data?.active_alerts, user?.notify_prefs);
  useEffect(() => {
    if (user?.notify_prefs?.push) void registerServiceWorker();
  }, [user?.notify_prefs?.push]);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-ctl focus:bg-surface focus:px-4 focus:py-2"
      >
        {L("Aller au contenu", "Skip to content", "روح للمحتوى")}
      </a>

      {/* Desktop: sidebar with every section */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col bg-surface lg:flex">
        <div className="flex h-[76px] items-center px-5">
          <NavLink to="/" aria-label={L("Tranche Guard, accueil", "Tranche Guard, home", "Tranche Guard، الرئيسية")}>
            <Logo size={34} state={logoState} />
          </NavLink>
        </div>
        <nav aria-label={L("Navigation principale", "Main navigation", "القائمة الرئيسية")} className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-0.5">
            {sideNav(user?.role === "admin").map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      "flex min-h-11 items-center gap-3 rounded-ctl px-3 text-[14px] no-underline transition-colors",
                      isActive ? "bg-sunken font-bold text-ink [&_svg]:text-nav-active" : "font-semibold text-body hover:bg-sunken",
                    )
                  }
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/alertes" && alertCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-chams px-1.5 text-[11px] font-bold text-[#0D1820]">
                      {alertCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
            <li className="pt-2">
              <NavLink
                to="/esp"
                className={({ isActive }) =>
                  cx(
                    "flex min-h-11 items-center gap-3 rounded-ctl px-3 text-[13px] font-semibold no-underline",
                    isActive ? "bg-sunken text-ink" : "text-mute hover:bg-sunken",
                  )
                }
              >
                <Cpu size={20} strokeWidth={1.8} aria-hidden />
                <span className="flex-1">{L("Contrôle démo", "Demo control", "التحكم في الديمو")}</span>
                {esp.running && <span aria-label={L("en marche", "running", "يخدم")} className="tg-live-dot size-2 rounded-full bg-success" />}
              </NavLink>
            </li>
          </ul>
        </nav>
        <div className="space-y-3 border-t border-hairline p-4">
          <LanguageSwitch />
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-bahr text-[14px] font-bold text-white">
              {initial(user)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink">{user?.full_name || user?.email}</p>
              <p className="truncate text-[12px] text-mute">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label={L("Se déconnecter", "Log out", "اخرج")}
              title={L("Se déconnecter", "Log out", "اخرج")}
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-mute hover:bg-sunken hover:text-ink"
            >
              <LogOut size={18} strokeWidth={1.8} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:ps-64">
        {/* Desktop top bar: home switcher, device status, bell, avatar */}
        <header className="sticky top-0 z-20 hidden bg-canvas/90 backdrop-blur lg:block">
          <div className="mx-auto flex h-[76px] max-w-[1180px] items-center justify-between gap-4 px-8">
            <HouseholdSwitcher />
            <div className="flex items-center gap-3">
              {dashboard.data && <DevicePill live={dashboard.data.live} device={dashboard.data.device} />}
              {dashboard.error && dashboard.data && (
                <Pill tone="broken">{L("Connexion au serveur perdue", "Server connection lost", "الاتصال بالسرفور مقطوع")}</Pill>
              )}
              {esp.running && (
                <NavLink to="/esp" aria-label={L("Boîtier virtuel en marche", "Virtual box running", "البواطة الافتراضية تخدم")}>
                  <Pill tone="live" icon={<Cpu size={14} strokeWidth={1.75} />}>
                    {L("Boîtier virtuel", "Virtual box", "بواطة افتراضية")}
                  </Pill>
                </NavLink>
              )}
              <HeaderActions />
            </div>
          </div>
        </header>

        {/* Phone: the design's header on the home screen only */}
        {isHome && (
          <header className="flex h-16 items-center justify-between gap-3 px-4 pt-2 lg:hidden">
            <HouseholdSwitcher />
            <HeaderActions />
          </header>
        )}

        {dashboard.error && dashboard.data && (
          <div className="px-4 pt-2 lg:hidden">
            <Pill tone="broken">{L("Connexion au serveur perdue", "Server connection lost", "الاتصال بالسرفور مقطوع")}</Pill>
          </div>
        )}

        <main id="main" className={cx("mx-auto max-w-[1180px] px-4 pb-32 sm:px-6 lg:px-8 lg:pb-12", isHome ? "pt-3" : "pt-4 lg:pt-2")}>
          <Outlet />
        </main>
      </div>

      {/* Phone: floating pill navigation */}
      <nav
        aria-label={L("Navigation principale", "Main navigation", "القائمة الرئيسية")}
        className="fixed inset-x-3 bottom-[calc(14px+env(safe-area-inset-bottom))] z-30 rounded-[34px] bg-surface shadow-[0_10px_30px_rgba(13,24,32,0.25)] lg:hidden"
      >
        <ul className="grid h-[68px] grid-cols-5 items-center">
          {bottomNav().map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    "relative flex min-h-11 flex-col items-center justify-center gap-[3px] text-[11px] no-underline",
                    isActive ? "font-bold text-nav-active" : "font-semibold text-mute",
                  )
                }
              >
                {item.icon}
                {item.label}
                {item.to === "/profil" && alertCount > 0 && (
                  <span aria-hidden className="absolute end-[calc(50%-16px)] top-0 size-2 rounded-full bg-chams" />
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
