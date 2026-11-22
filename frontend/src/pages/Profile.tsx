import { Bell, Cpu, History, LifeBuoy, LogOut, ShieldCheck, SlidersHorizontal, Sparkles, Warehouse } from "lucide-react";
import { initial, useAuth } from "../lib/auth";
import { useData } from "../lib/data";
import { useHouseholds } from "../lib/households";
import { L } from "../lib/i18n";
import { shortAge } from "../lib/format";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { ListGroup, ListRow, PageHeader, SectionLabel } from "../components/ui";

/** "Profil et paramètres" artboard: the phone's hub to every other section. */
export function ProfilePage() {
  const { user, logout } = useAuth();
  const { current, households } = useHouseholds();
  const { dashboard } = useData();
  const d = dashboard.data;
  const alerts = d?.active_alerts.length ?? 0;
  const device = d?.device;

  return (
    <>
      <PageHeader title={L("Profil et paramètres", "Profile and settings", "الحساب والإعدادات")} />
      <div className="flex h-[72px] items-center gap-3 rounded-card bg-surface px-4">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-bahr text-[17px] font-extrabold text-white">
          {initial(user)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-ink">
            {current?.name ?? L("Ma maison", "My home", "داري")}
            {current?.address ? ` · ${current.address.split(",")[0]}` : ""}
          </p>
          <p className="truncate text-[13px] text-mute" dir="ltr">
            {user?.email}
          </p>
        </div>
      </div>

      <SectionLabel>{L("Mon espace", "My space", "فضائي")}</SectionLabel>
      <ListGroup>
        <ListRow to="/assistant" icon={<Sparkles size={18} />} label={L("Assistant IA", "AI assistant", "المساعد الذكي")} />
        <ListRow
          to="/alertes"
          icon={<Bell size={18} />}
          label={L("Alertes et notifications", "Alerts and notifications", "التنبيهات")}
          value={alerts ? `${alerts}` : undefined}
        />
        <ListRow to="/historique" icon={<History size={18} />} label={L("Historique", "History", "التاريخ")} />
        <ListRow
          to="/foyers"
          icon={<Warehouse size={18} />}
          label={L("Mes foyers et appareils", "My homes and appliances", "دياري والآلات")}
          value={`${households.length}`}
        />
      </ListGroup>

      <SectionLabel>{L("Appareil", "Device", "البواطة")}</SectionLabel>
      <ListGroup>
        <ListRow
          to="/reglages#appareil"
          icon={<Cpu size={18} />}
          label={device ? `${L("Boîtier", "Box", "بواطة")} ${device.id}` : L("Aucun boîtier", "No box", "ما فماش بواطة")}
          value={
            device ? (
              <span className={device.online ? "inline-flex items-center gap-1.5 font-bold text-success" : "text-mute"}>
                {device.online && <span aria-hidden className="size-2 rounded-full bg-success" />}
                {device.online
                  ? `${L("En ligne", "Online", "متصل")}${d?.live ? ` · ${shortAge(d.live.age_s)}` : ""}`
                  : L("Hors ligne", "Offline", "مقطوع")}
              </span>
            ) : undefined
          }
        />
        <ListRow to="/esp" icon={<Cpu size={18} />} label={L("Contrôle démo", "Demo control", "التحكم في الديمو")} />
      </ListGroup>

      <SectionLabel>{L("Réglages", "Settings", "الإعدادات")}</SectionLabel>
      <ListGroup>
        <ListRow to="/reglages" icon={<SlidersHorizontal size={18} />} label={L("Paramètres du foyer et du compte", "Home and account settings", "إعدادات الدار والحساب")} />
        <div className="px-4 py-3">
          <LanguageSwitch />
        </div>
        <ListRow to="/aide" icon={<LifeBuoy size={18} />} label={L("Aide et support", "Help and support", "المساعدة")} />
        {user?.role === "admin" && <ListRow to="/admin" icon={<ShieldCheck size={18} />} label={L("Administration", "Admin", "الإدارة")} />}
      </ListGroup>

      <SectionLabel>{L("Compte", "Account", "الحساب")}</SectionLabel>
      <ListGroup>
        <ListRow onClick={logout} danger icon={<LogOut size={18} className="rtl:rotate-180" />} label={L("Se déconnecter", "Log out", "اخرج")} />
      </ListGroup>
    </>
  );
}
