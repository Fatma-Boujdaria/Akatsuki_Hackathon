import { useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Activity, Cpu, Database, House, LifeBuoy, LogOut, Mail, Receipt, Search, Users } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useHouseholds } from "../../lib/households";
import { usePoll } from "../../lib/usePoll";
import { L } from "../../lib/i18n";
import { dateTime, num, shortAge } from "../../lib/format";
import { Logo } from "../../components/Logo";
import { LanguageSwitch } from "../../components/LanguageSwitch";
import { Banner, Pill } from "../../components/status";
import { Button, Card, CardHeader, Skeleton, cx } from "../../components/ui";
import { TariffCard } from "../Settings";

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "ok" | "bad" | "warn" }) {
  return (
    <div className="rounded-card bg-surface p-4">
      <p className="text-[12px] text-mute">{label}</p>
      <p className={cx("mt-1 text-[22px] font-extrabold tabular-nums", tone === "bad" ? "text-grenade" : tone === "warn" ? "text-harissa" : tone === "ok" ? "text-success" : "text-ink")}>
        {value}
      </p>
    </div>
  );
}

function TableCard({ children, empty, loading }: { children: ReactNode; empty: boolean; loading: boolean }) {
  if (loading) return <Skeleton className="h-60" />;
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      {empty ? <p className="p-6 text-center text-[14px] text-mute">{L("Rien à afficher.", "Nothing to show.", "ما فماش شي.")}</p> : children}
    </div>
  );
}

const th = "px-4 py-3 text-start text-[12px] font-semibold text-mute whitespace-nowrap";
const td = "px-4 py-3 text-[13px] text-ink whitespace-nowrap";

function SystemTab() {
  const sys = usePoll((s) => api.admin.system(s), 10_000);
  const d = sys.data;
  if (!d) return sys.error ? <Banner tone="broken">{sys.error}</Banner> : <Skeleton className="h-80" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={L("Base de données", "Database", "قاعدة البيانات")} value={d.database_ok ? `${d.database} · ${d.database_latency_ms} ms` : L("injoignable", "unreachable", "مقطوعة")} tone={d.database_ok ? "ok" : "bad"} />
        <Stat label={L("En ligne depuis", "Up for", "خدّام من")} value={shortAge(d.uptime_s)} />
        <Stat label={L("Requêtes API", "API requests", "طلبات API")} value={num(d.requests_total)} />
        <Stat label={L("Erreurs serveur (5xx)", "Server errors (5xx)", "أخطاء السرفور")} value={num(d.errors_5xx)} tone={d.errors_5xx ? "bad" : "ok"} />
        <Stat label={L("Boîtiers en ligne", "Boxes online", "البواطات المتصلة")} value={`${d.devices_online} / ${d.devices_total}`} tone={d.devices_online < d.devices_total ? "warn" : "ok"} />
        <Stat label={L("Mesures (1 h)", "Readings (1 h)", "القياسات (ساعة)")} value={num(d.readings_last_hour)} />
        <Stat label={L("Mesures rejetées", "Rejected readings", "قياسات مرفوضة")} value={num(d.readings_rejected)} tone={d.readings_rejected ? "warn" : undefined} />
        <Stat label={L("Alertes (24 h)", "Alerts (24 h)", "التنبيهات (24 س)")} value={num(d.alerts_24h)} />
        <Stat label={L("Comptes", "Accounts", "الحسابات")} value={num(d.users_total)} />
        <Stat label={L("Foyers", "Homes", "الديار")} value={num(d.households_total)} />
        <Stat label={L("Messages support ouverts", "Open support messages", "رسائل دعم مفتوحة")} value={num(d.open_tickets)} tone={d.open_tickets ? "warn" : undefined} />
        <Stat label="LLM" value={d.llm_configured ? L("configuré", "configured", "مفعّل") : L("modèles seuls", "templates only", "قوالب برك")} />
      </div>
      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><Mail size={18} aria-hidden /> {L("Envoi des e-mails et notifications", "Email and notification delivery", "إرسال الإيميلات والإشعارات")}</span>} />
        <p className="text-[14px] text-body">
          {d.email_mode === "smtp"
            ? L(`SMTP actif : ${d.emails_sent} envoyé(s), ${d.emails_failed} en échec.`, `SMTP on: ${d.emails_sent} sent, ${d.emails_failed} failed.`, `SMTP مفعّل: ${d.emails_sent} تبعثو، ${d.emails_failed} فشلو.`)
            : L(
                `Pas de serveur SMTP : ${d.emails_logged} code(s) écrit(s) dans le journal de l'API (mode démo).`,
                `No SMTP server: ${d.emails_logged} code(s) written to the API log (demo mode).`,
                `ما فماش SMTP: ${d.emails_logged} كود تكتبو في اللوغ (ديمو).`,
              )}
        </p>
        <p className="mt-1 text-[13px] text-mute">
          {L(
            "Les notifications téléphone sont affichées par le navigateur de chaque utilisateur (pas de service push serveur pour l'instant).",
            "Phone notifications are shown by each user's browser (no server push service yet).",
            "إشعارات التليفون يورّيهم المتصفح متاع كل مستعمل (ما فماش push من السرفور لتوّا).",
          )}
        </p>
      </Card>
      <Card>
        <CardHeader title={<span className="inline-flex items-center gap-2"><Activity size={18} aria-hidden /> {L("Erreurs récentes", "Recent errors", "أخطاء جديدة")}</span>} />
        {d.recent_errors.length === 0 ? (
          <p className="text-[14px] text-success">{L("Aucune erreur depuis le démarrage.", "No error since start-up.", "ما فماش أخطاء.")}</p>
        ) : (
          <ul className="space-y-1 font-mono text-[12px] text-body" dir="ltr">
            {d.recent_errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const users = usePoll((s) => api.admin.users(query, s), 0, [query]);
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (id: string, status: string) => {
    setBusy(id);
    try {
      await api.admin.setUserStatus(id, status === "active" ? "suspended" : "active");
      await users.refresh();
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
        className="flex gap-2"
        role="search"
      >
        <label htmlFor="q" className="sr-only">{L("Rechercher par e-mail", "Search by email", "لوّج بالإيميل")}</label>
        <input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={L("Rechercher par e-mail", "Search by email", "لوّج بالإيميل")}
          className="min-h-11 flex-1 rounded-ctl border border-hairline bg-surface px-4 text-[15px] text-ink focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25"
          dir="ltr"
        />
        <Button type="submit" aria-label={L("Rechercher", "Search", "لوّج")}>
          <Search size={18} />
        </Button>
      </form>
      <TableCard loading={!users.data} empty={!users.data?.length}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>E-mail</th>
              <th className={th}>{L("Nom", "Name", "الاسم")}</th>
              <th className={th}>{L("Rôle", "Role", "الدور")}</th>
              <th className={th}>{L("Statut", "Status", "الحالة")}</th>
              <th className={th}>{L("Foyers", "Homes", "الديار")}</th>
              <th className={th}>{L("Dernière connexion", "Last login", "آخر دخول")}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {users.data?.map((u) => (
              <tr key={u.id}>
                <td className={td} dir="ltr">
                  {u.email}
                  {!u.email_verified && <span className="ms-2 text-[11px] text-harissa">{L("non vérifié", "unverified", "موش مثبّت")}</span>}
                </td>
                <td className={td}>{u.full_name ?? "—"}</td>
                <td className={td}>{u.role === "admin" ? L("admin", "admin", "أدمين") : L("foyer", "household", "دار")}</td>
                <td className={td}>
                  <Pill tone={u.status === "active" ? "live" : "broken"}>{u.status === "active" ? L("actif", "active", "مفعّل") : L("suspendu", "suspended", "موقوف")}</Pill>
                </td>
                <td className={td}>{u.households}</td>
                <td className={td}>{u.last_login_at ? dateTime(u.last_login_at) : "—"}</td>
                <td className={td}>
                  {u.id !== me?.id && (
                    <Button variant={u.status === "active" ? "danger" : "secondary"} disabled={busy === u.id} onClick={() => toggle(u.id, u.status)}>
                      {u.status === "active" ? L("Suspendre", "Suspend", "وقّف") : L("Réactiver", "Reactivate", "عاود فعّل")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      <p className="px-1 text-[12px] text-mute">
        {L("Les mots de passe sont hachés (bcrypt) : personne, administrateur compris, ne peut les lire.", "Passwords are hashed (bcrypt): nobody, admins included, can read them.", "كلمات السر مشفّرة (bcrypt): حتى حد، حتى الأدمين، ما ينجم يقراها.")}
      </p>
    </div>
  );
}

function HouseholdsTab() {
  const rows = usePoll((s) => api.admin.households(s), 30_000);
  return (
    <TableCard loading={!rows.data} empty={!rows.data?.length}>
      <table className="w-full">
        <thead>
          <tr>
            <th className={th}>{L("Foyer", "Home", "الدار")}</th>
            <th className={th}>{L("Propriétaire", "Owner", "المولى")}</th>
            <th className={th}>kVA</th>
            <th className={th}>{L("Boîtiers en ligne", "Boxes online", "البواطات المتصلة")}</th>
            <th className={th}>{L("Appareils déclarés", "Declared appliances", "الآلات")}</th>
            <th className={th}>{L("Alertes non lues", "Unread alerts", "تنبيهات")}</th>
            <th className={th}>{L("Créé le", "Created", "تعمل في")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.data?.map((h) => (
            <tr key={h.id}>
              <td className={cx(td, "font-bold")}>{h.name}</td>
              <td className={td} dir="ltr">{h.owner_email}</td>
              <td className={td}>{h.subscribed_kva}</td>
              <td className={td}>
                <span className={h.devices && h.devices_online < h.devices ? "text-harissa" : "text-success"}>
                  {h.devices_online} / {h.devices}
                </span>
              </td>
              <td className={td}>{h.appliances}</td>
              <td className={td}>{h.unread_alerts}</td>
              <td className={td}>{dateTime(h.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}

function DevicesTab() {
  const rows = usePoll((s) => api.admin.devices(s), 15_000);
  return (
    <TableCard loading={!rows.data} empty={!rows.data?.length}>
      <table className="w-full">
        <thead>
          <tr>
            <th className={th}>{L("Boîtier", "Box", "البواطة")}</th>
            <th className={th}>{L("Foyer", "Home", "الدار")}</th>
            <th className={th}>{L("Connexion", "Connection", "الاتصال")}</th>
            <th className={th}>{L("Dernière mesure", "Last reading", "آخر قياس")}</th>
            <th className={th}>{L("Signal", "Signal", "السينيال")}</th>
            <th className={th}>{L("Pannes capteur (7 j)", "Sensor faults (7 d)", "أعطال (7 أيام)")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.data?.map((d) => (
            <tr key={d.id}>
              <td className={cx(td, "font-bold")} dir="ltr">
                {d.id} <span className="font-normal text-mute">· {d.kind}</span>
              </td>
              <td className={td}>
                {d.household_name} <span className="text-mute" dir="ltr">· {d.owner_email}</span>
              </td>
              <td className={td}>
                <Pill tone={d.online ? "live" : "neutral"}>{d.online ? L("en ligne", "online", "متصل") : L("hors ligne", "offline", "مقطوع")}</Pill>
              </td>
              <td className={td}>{d.last_reading_at ? dateTime(d.last_reading_at) : "—"}</td>
              <td className={td}>
                {d.last_signal_ok == null ? "—" : d.last_signal_ok ? <span className="text-success">OK</span> : <span className="text-harissa">{L("peu fiable", "unreliable", "موش مضمون")}</span>}
              </td>
              <td className={cx(td, d.sensor_faults_7d ? "font-bold text-grenade" : "")}>{d.sensor_faults_7d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}

function TariffsTab() {
  const audit = usePoll((s) => api.admin.tariffAudit(s), 0);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <TariffCard isAdmin />
      <Card>
        <CardHeader title={L("Journal des modifications", "Change log", "سجل التبديلات")} />
        {!audit.data ? (
          <Skeleton className="h-32" />
        ) : audit.data.length === 0 ? (
          <p className="text-[14px] text-mute">{L("Aucune modification de tarif.", "No tariff change yet.", "ما فماش تبديل في الأسوام.")}</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {audit.data.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-[13px] font-bold text-ink">
                  {dateTime(a.created_at)} · <span dir="ltr">{a.admin_email}</span>
                </p>
                <p className="mt-0.5 text-[13px] break-words text-body" dir="ltr">
                  {a.summary}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12px] text-mute">
          {L(
            "Chaque enregistrement de la grille est tracé avec la grille avant et après.",
            "Every grid save is recorded with the grid before and after.",
            "كل تسجيل للجدول يتسجّل بالجدول قبل وبعد.",
          )}
        </p>
      </Card>
    </div>
  );
}

function SupportTab() {
  const tickets = usePoll((s) => api.admin.tickets(s), 30_000);
  const [busy, setBusy] = useState<string | null>(null);
  const set = async (id: string, status: "open" | "answered" | "closed") => {
    setBusy(id);
    try {
      await api.admin.setTicketStatus(id, status);
      await tickets.refresh();
    } finally {
      setBusy(null);
    }
  };
  if (!tickets.data) return <Skeleton className="h-60" />;
  if (!tickets.data.length) return <Card><p className="text-[14px] text-mute">{L("Aucun message.", "No messages.", "ما فماش رسائل.")}</p></Card>;
  return (
    <div className="space-y-3">
      {tickets.data.map((t) => (
        <Card key={t.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-ink">{t.subject}</p>
              <p className="text-[12px] text-mute">
                <span dir="ltr">{t.email}</span> · {t.category} · {dateTime(t.created_at)}
              </p>
            </div>
            <Pill tone={t.status === "open" ? "headsup" : t.status === "answered" ? "live" : "neutral"}>{t.status}</Pill>
          </div>
          <p className="mt-2 text-[14px] whitespace-pre-line text-body">{t.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`mailto:${t.email}?subject=${encodeURIComponent(`Re: ${t.subject}`)}`} className="inline-flex min-h-11 items-center rounded-ctl bg-sunken px-4 text-[14px] font-bold text-ink no-underline">
              {L("Répondre par e-mail", "Reply by email", "جاوب بالإيميل")}
            </a>
            <Button variant="secondary" disabled={busy === t.id} onClick={() => set(t.id, "answered")}>
              {L("Marquer répondu", "Mark answered", "علّم تجاوب")}
            </Button>
            <Button variant="secondary" disabled={busy === t.id} onClick={() => set(t.id, "closed")}>
              {L("Fermer", "Close", "سكّر")}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function AdminPage() {
  const { user, logout } = useAuth();
  const { households } = useHouseholds();
  const tabs = [
    { to: "systeme", label: L("Système", "System", "النظام"), icon: <Database size={16} /> },
    { to: "utilisateurs", label: L("Utilisateurs", "Users", "المستعملين"), icon: <Users size={16} /> },
    { to: "foyers", label: L("Foyers", "Homes", "الديار"), icon: <House size={16} /> },
    { to: "appareils", label: L("Boîtiers", "Boxes", "البواطات"), icon: <Cpu size={16} /> },
    { to: "tarifs", label: L("Tarifs", "Tariffs", "الأسوام"), icon: <Receipt size={16} /> },
    { to: "support", label: L("Support", "Support", "الدعم"), icon: <LifeBuoy size={16} /> },
  ];
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={30} wordmarkClass="hidden sm:inline text-[18px]" />
            <Pill tone="headsup">{L("Administration", "Admin", "الإدارة")}</Pill>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch className="hidden w-auto md:flex" />
            {households.length > 0 && (
              <Link to="/" className="hidden min-h-11 items-center rounded-ctl px-3 text-[14px] font-bold no-underline sm:inline-flex">
                {L("Mon tableau de bord", "My dashboard", "الداشبورد متاعي")}
              </Link>
            )}
            <span className="hidden max-w-[200px] truncate text-[13px] text-mute lg:inline" dir="ltr">{user?.email}</span>
            <button type="button" onClick={logout} aria-label={L("Se déconnecter", "Log out", "اخرج")} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-surface text-ink hover:bg-sunken">
              <LogOut size={18} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
        <nav aria-label={L("Sections d'administration", "Admin sections", "أقسام الإدارة")} className="mx-auto max-w-[1280px] px-4 pb-3 sm:px-6">
          <ul className="no-scrollbar flex gap-2 overflow-x-auto">
            {tabs.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={`/admin/${t.to}`}
                  className={({ isActive }) =>
                    cx(
                      "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] whitespace-nowrap no-underline",
                      isActive ? "bg-chip-active font-bold text-on-chip-active" : "bg-surface font-semibold text-chip hover:bg-sunken",
                    )
                  }
                >
                  {t.icon}
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 pt-2 pb-12 sm:px-6">
        <Routes>
          <Route index element={<Navigate to="systeme" replace />} />
          <Route path="systeme" element={<SystemTab />} />
          <Route path="utilisateurs" element={<UsersTab />} />
          <Route path="foyers" element={<HouseholdsTab />} />
          <Route path="appareils" element={<DevicesTab />} />
          <Route path="tarifs" element={<TariffsTab />} />
          <Route path="support" element={<SupportTab />} />
          <Route path="*" element={<Navigate to="systeme" replace />} />
        </Routes>
      </main>
    </div>
  );
}
