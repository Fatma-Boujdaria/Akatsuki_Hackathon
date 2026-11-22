import { useState, type FormEvent } from "react";
import { BellRing, KeyRound, LogOut, Trash2, UserRound } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { L } from "../lib/i18n";
import { notificationPermission, registerServiceWorker, requestNotificationPermission } from "../lib/notify";
import type { NotifyPrefs } from "../lib/types";
import { passwordProblem } from "../pages/Register";
import { CheckboxField, Field, PasswordField } from "./Field";
import { LanguageSwitch } from "./LanguageSwitch";
import { Banner } from "./status";
import { Button, Card, CardHeader } from "./ui";

const DEFAULT_PREFS: NotifyPrefs = { threshold: true, leak: true, device: true, tips: true, push: false };

function Saved({ ok, error }: { ok: boolean; error: string | null }) {
  if (error)
    return (
      <span className="text-[13px] text-grenade" role="alert">
        {error}
      </span>
    );
  if (ok)
    return (
      <span className="text-[13px] font-bold text-success" role="status">
        {L("Enregistré", "Saved", "تسجّل")}
      </span>
    );
  return null;
}

function ProfileCard() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.full_name ?? "");
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setOk(false);
    setError(null);
    try {
      setUser(await api.updateMe({ full_name: name.trim() }));
      setOk(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><UserRound size={18} aria-hidden /> {L("Mon compte", "My account", "حسابي")}</span>} />
      <form onSubmit={save} className="space-y-3">
        <Field label={L("Nom complet", "Full name", "الاسم الكامل")} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <Field label={L("E-mail", "Email", "الإيميل")} value={user?.email ?? ""} readOnly disabled dir="ltr" help={L("L'adresse sert à te connecter.", "The address is used to log in.", "الإيميل يستعمل للدخول.")} />
        <div>
          <p className="mb-2 text-[14px] font-semibold text-body">{L("Langue", "Language", "اللغة")}</p>
          <LanguageSwitch />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={name.trim().length < 2}>
            {L("Enregistrer", "Save", "سجّل")}
          </Button>
          <Saved ok={ok} error={error} />
        </div>
      </form>
    </Card>
  );
}

function NotificationsCard() {
  const { user, setUser } = useAuth();
  const [prefs, setPrefs] = useState<NotifyPrefs>({ ...DEFAULT_PREFS, ...(user?.notify_prefs ?? {}) });
  const [perm, setPerm] = useState(notificationPermission());
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (next: NotifyPrefs) => {
    setPrefs(next);
    setOk(false);
    setError(null);
    try {
      setUser(await api.updateMe({ notify_prefs: next }));
      setOk(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const enablePush = async (on: boolean) => {
    if (on) {
      const p = await requestNotificationPermission();
      setPerm(p);
      if (p !== "granted") return;
      await registerServiceWorker();
    }
    void save({ ...prefs, push: on });
  };

  const set = (k: keyof NotifyPrefs) => (v: boolean) => void save({ ...prefs, [k]: v });

  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><BellRing size={18} aria-hidden /> {L("Notifications", "Notifications", "الإشعارات")}</span>} />
      <div className="space-y-1">
        <CheckboxField label={L("Avant une tranche STEG", "Before a STEG tranche", "قبل شريحة STEG")} checked={prefs.threshold} onChange={set("threshold")} />
        <CheckboxField label={L("Fuites et débit d'eau anormal", "Leaks and unusual water flow", "التسريبات والدبي الغريب")} checked={prefs.leak} onChange={set("leak")} />
        <CheckboxField label={L("Boîtier hors ligne, capteur en panne", "Box offline, sensor fault", "البواطة مقطوعة، كابتور معطّل")} checked={prefs.device} onChange={set("device")} />
        <CheckboxField label={L("Conseils pour économiser", "Saving tips", "نصائح للتوفير")} checked={prefs.tips} onChange={set("tips")} />
      </div>
      <div className="mt-3 border-t border-hairline pt-3">
        <CheckboxField
          label={L("Notifications sur ce téléphone / navigateur", "Notifications on this phone / browser", "إشعارات على التليفون / المتصفح هذا")}
          checked={prefs.push && perm === "granted"}
          onChange={(v) => void enablePush(v)}
          help={
            perm === "unsupported"
              ? L("Ce navigateur ne gère pas les notifications.", "This browser does not support notifications.", "المتصفح هذا ما يدعمش الإشعارات.")
              : perm === "denied"
                ? L("Bloquées dans le navigateur : autorise-les dans ses réglages.", "Blocked in the browser: allow them in its settings.", "مسكّرة في المتصفح: حلّها من الإعدادات متاعو.")
                : L(
                    "Reçues tant que Tranche Guard est ouvert, même en arrière-plan. Installe l'app sur l'écran d'accueil pour plus de confort.",
                    "Received while Tranche Guard is open, even in the background. Add the app to your home screen for comfort.",
                    "توصلك ما دام Tranche Guard محلول، حتى في الخلفية.",
                  )
          }
        />
      </div>
      <div className="mt-2">
        <Saved ok={ok} error={error} />
      </div>
    </Card>
  );
}

function PasswordCard() {
  const { acceptToken } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (passwordProblem(next, confirm)) return;
    setOk(false);
    setError(null);
    try {
      acceptToken(await api.changePassword(current, next), true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setTouched(false);
      setOk(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><KeyRound size={18} aria-hidden /> {L("Mot de passe", "Password", "كلمة السر")}</span>} />
      <form onSubmit={save} className="space-y-3">
        <PasswordField label={L("Mot de passe actuel", "Current password", "كلمة السر الحالية")} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <PasswordField label={L("Nouveau mot de passe", "New password", "كلمة السر الجديدة")} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <PasswordField
          label={L("Confirme", "Confirm", "عاود")}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={touched ? passwordProblem(next, confirm) : null}
        />
        <p className="text-[12px] text-mute">{L("Tes autres appareils seront déconnectés.", "Your other devices will be logged out.", "الأجهزة الأخرى باش تخرج.")}</p>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!current || !next}>
            {L("Changer le mot de passe", "Change password", "بدّل كلمة السر")}
          </Button>
          <Saved ok={ok} error={error} />
        </div>
      </form>
    </Card>
  );
}

function SessionsAndDeletion() {
  const { logout, user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const word = L("SUPPRIMER", "DELETE", "حذف");

  const logoutAll = async () => {
    try {
      await api.logoutAll();
    } finally {
      logout();
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await api.deleteAccount(password, confirm.trim());
      logout();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader title={L("Sessions et données", "Sessions and data", "الجلسات والمعطيات")} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={logout}>
          <LogOut size={16} aria-hidden className="rtl:rotate-180" /> {L("Se déconnecter", "Log out", "اخرج")}
        </Button>
        <Button variant="secondary" onClick={logoutAll}>
          {L("Déconnecter tous mes appareils", "Log out all my devices", "اخرج من الأجهزة الكل")}
        </Button>
      </div>
      <div className="mt-4 border-t border-hairline pt-4">
        {!deleting ? (
          <Button variant="danger" onClick={() => setDeleting(true)}>
            <Trash2 size={16} aria-hidden /> {L("Supprimer mon compte", "Delete my account", "فسخ الحساب متاعي")}
          </Button>
        ) : (
          <div className="space-y-3 rounded-ctl bg-grenade-soft p-3">
            <p className="text-[14px] text-grenade">
              {L(
                "Ton compte et tous tes foyers seront supprimés : boîtiers, mesures, alertes, conseils, scores et appareils déclarés. Tes messages au support sont gardés sans lien avec ton compte. C'est définitif.",
                "Your account and all your homes will be deleted: boxes, readings, alerts, tips, scores and declared appliances. Your support messages are kept without a link to your account. This cannot be undone.",
                "الحساب والديار الكل باش يتفسخو: البواطات، القياسات، التنبيهات، النصائح والآلات. رسائل الدعم تتخلّى بلا اسمك. ما يرجعش.",
              )}
            </p>
            {user?.role === "admin" && (
              <p className="text-[13px] text-grenade">{L("Le dernier administrateur ne peut pas être supprimé.", "The last administrator cannot be deleted.", "آخر أدمين ما ينجمش يتفسخ.")}</p>
            )}
            <PasswordField label={L("Ton mot de passe", "Your password", "كلمة السر")} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Field label={L(`Tape ${word} pour confirmer`, `Type ${word} to confirm`, `اكتب ${word} باش تأكّد`)} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {error && (
              <Banner tone="broken" role="alert">
                {error}
              </Banner>
            )}
            <div className="flex gap-2">
              <Button variant="danger" disabled={!password || confirm.trim() !== word} onClick={remove}>
                {L("Supprimer définitivement", "Delete for good", "فسخ نهائيا")}
              </Button>
              <Button variant="secondary" onClick={() => setDeleting(false)}>
                {L("Annuler", "Cancel", "إلغاء")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function AccountSettings() {
  return (
    <>
      <ProfileCard />
      <NotificationsCard />
      <PasswordCard />
      <SessionsAndDeletion />
    </>
  );
}
