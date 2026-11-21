import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Award, Bell, Cpu, Droplet, House, LogOut, SlidersVertical, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useData } from "../lib/data";
import { useAuth } from "../lib/auth";
import { useVirtualEsp } from "../lib/virtualEsp";
import { Logo, type LogoState } from "./Logo";
import { DevicePill, Pill } from "./status";
import { cx } from "./ui";
import { useEffect } from "react";

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: "/", label: "Accueil", icon: <House size={22} strokeWidth={1.5} />, end: true },
  { to: "/electricite", label: "Électricité", icon: <Zap size={22} strokeWidth={1.5} /> },
  { to: "/eau", label: "Eau", icon: <Droplet size={22} strokeWidth={1.5} /> },
  { to: "/alertes", label: "Alertes", icon: <Bell size={22} strokeWidth={1.5} /> },
  { to: "/defis", label: "Défis", icon: <Award size={22} strokeWidth={1.5} /> },
];

function CountBadge({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      className={cx(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-harissa px-1 text-[11px] leading-none font-semibold text-white dark:text-[#0D171F]",
        className,
      )}
      aria-label={`${n} alerte${n > 1 ? "s" : ""} active${n > 1 ? "s" : ""}`}
    >
      {n}
    </span>
  );
}

function useLogoState(): LogoState {
  const { dashboard, tranche } = useData();
  if (!dashboard.data && dashboard.loading) return "loading";
  if (tranche?.state === "near") return "near";
  if (tranche?.state === "crossed") return "crossed";
  return "default";
}

function SettingsButton() {
  return (
    <NavLink
      to="/reglages"
      aria-label="Réglages"
      className={({ isActive }) =>
        cx(
          "inline-flex size-11 items-center justify-center rounded-ctl text-ink transition-colors hover:bg-sunken",
          isActive && "bg-primary-soft text-primary",
        )
      }
    >
      <SlidersVertical size={22} strokeWidth={1.5} />
    </NavLink>
  );
}

export function Layout() {
  const { dashboard } = useData();
  const { user, logout } = useAuth();
  const esp = useVirtualEsp();
  const logoState = useLogoState();
  const alertCount = dashboard.data?.active_alerts.length ?? 0;
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-ctl focus:bg-surface focus:px-4 focus:py-2"
      >
        Aller au contenu
      </a>

      {/* Desktop: 240 px left sidebar, active item on a Bahr-soft pill */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-hairline bg-surface lg:flex">
        <div className="flex h-[72px] items-center px-5">
          <NavLink to="/" aria-label="Tranche Guard, accueil">
            <Logo size={30} state={logoState} />
          </NavLink>
        </div>
        <nav aria-label="Navigation principale" className="flex-1 px-3 pt-2">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      "flex min-h-11 items-center gap-3 rounded-ctl px-3 text-[15px] font-medium transition-colors",
                      isActive ? "bg-primary-soft text-ink [&_svg]:text-primary" : "text-body hover:bg-sunken hover:text-ink",
                    )
                  }
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/alertes" && <CountBadge n={alertCount} />}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="px-3 pb-3">
          <NavLink
            to="/esp"
            className={({ isActive }) =>
              cx(
                "flex min-h-11 items-center gap-3 rounded-ctl px-3 text-[14px] font-medium transition-colors",
                isActive ? "bg-primary-soft text-ink [&_svg]:text-primary" : "text-mute hover:bg-sunken hover:text-ink",
              )
            }
          >
            <Cpu size={20} strokeWidth={1.5} />
            <span className="flex-1">Contrôle ESP</span>
            {esp.running && <span aria-label="en marche" className="tg-live-dot size-2 rounded-full bg-primary" />}
          </NavLink>
        </div>
        <div className="border-t border-hairline p-4">
          <p className="truncate text-[14px] font-semibold text-ink">{dashboard.data?.household_name ?? "Mon foyer"}</p>
          <p className="truncate font-mono text-[12px] text-mute">
            {dashboard.data?.device ? `${dashboard.data.device.id} · ${dashboard.data.subscribed_kva} kVA` : "aucun appareil"}
          </p>
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Top bar: logo on mobile, status and settings everywhere */}
        <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/85">
          <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-6 lg:h-[72px] lg:px-8">
            <NavLink to="/" className="lg:hidden" aria-label="Tranche Guard, accueil">
              <Logo size={30} state={logoState} />
            </NavLink>
            <div className="hidden items-center gap-3 lg:flex">
              {dashboard.data ? (
                <DevicePill live={dashboard.data.live} device={dashboard.data.device} />
              ) : null}
              {dashboard.error && dashboard.data && (
                <Pill tone="broken">Connexion au serveur perdue</Pill>
              )}
            </div>
            <div className="flex items-center gap-1">
              {esp.running && (
                <NavLink to="/esp" className="mr-1" aria-label="Boîtier virtuel en marche">
                  <Pill tone="live" icon={<Cpu size={14} strokeWidth={1.75} />}>
                    <span className="hidden sm:inline">Boîtier virtuel</span>
                    <span className="sm:hidden">ESP</span>
                  </Pill>
                </NavLink>
              )}
              {user && (
                <span className="mr-2 hidden max-w-[220px] truncate text-[14px] text-mute xl:inline">{user.email}</span>
              )}
              <SettingsButton />
              <button
                type="button"
                onClick={logout}
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="hidden size-11 cursor-pointer items-center justify-center rounded-ctl text-mute transition-colors hover:bg-sunken hover:text-ink lg:inline-flex"
              >
                <LogOut size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </header>

        {dashboard.error && dashboard.data && (
          <div className="mx-auto max-w-[1180px] px-4 pt-3 sm:px-6 lg:hidden">
            <Pill tone="broken">Connexion au serveur perdue · données de {new Date(dashboard.updatedAt ?? 0).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</Pill>
          </div>
        )}

        <main id="main" className="mx-auto max-w-[1180px] px-4 pt-5 pb-28 sm:px-6 sm:pt-7 lg:px-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Mobile: bottom nav, one-handed */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5 px-1 pt-2 pb-1.5">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx("group flex min-h-14 flex-col items-center gap-1 text-[12px] leading-4", isActive ? "font-semibold text-ink" : "text-mute")
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        "relative inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                        isActive ? "bg-primary-soft text-primary" : "text-body group-hover:bg-sunken",
                      )}
                    >
                      {item.icon}
                      {item.to === "/alertes" && <CountBadge n={alertCount} className="absolute -top-1 right-2" />}
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
