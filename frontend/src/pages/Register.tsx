import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { L, useI18n } from "../lib/i18n";
import type { CodeSent } from "../lib/types";
import { AuthShell } from "../components/AuthShell";
import { Field, PasswordField } from "../components/Field";
import { Banner } from "../components/status";
import { Button } from "../components/ui";

export function passwordProblem(pw: string, confirm?: string): string | null {
  if (pw.length < 8) return L("Au moins 8 caractères.", "At least 8 characters.", "على الأقل 8 حروف.");
  if (new TextEncoder().encode(pw).length > 72) return L("72 octets maximum.", "72 bytes maximum.", "72 بايت على الأكثر.");
  if (confirm !== undefined && pw !== confirm)
    return L("Les deux mots de passe ne sont pas identiques.", "The two passwords do not match.", "كلمتين السر موش كيف كيف.");
  return null;
}

/** Code sent by email; in the local demo without SMTP the API returns it to show here. */
export function DevCodeNotice({ sent }: { sent: CodeSent | null }) {
  if (!sent?.dev_code) return null;
  return (
    <Banner tone="info" title={L("Mode démo : pas de serveur email", "Demo mode: no email server", "مود ديمو: ما فماش سرفور إيميل")}>
      {L("Ton code est", "Your code is", "الكود متاعك")} <strong className="font-extrabold tracking-[0.2em] text-ink">{sent.dev_code}</strong>
    </Banner>
  );
}

export function RegisterPage() {
  const { user, acceptToken } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const verifyEmail = params.get("verifier");
  const [step, setStep] = useState<"form" | "code">(verifyEmail ? "code" : "form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(verifyEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  // Coming from the login screen with an unverified account: send a fresh code.
  useEffect(() => {
    if (verifyEmail) {
      api
        .resendCode(verifyEmail)
        .then(setSent)
        .catch(() => {
          /* the user can press "Renvoyer" */
        });
    }
  }, [verifyEmail]);

  if (user && step === "form") return <Navigate to="/" replace />;

  const pwError = touched ? passwordProblem(password, confirm) : null;

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (passwordProblem(password, confirm) || name.trim().length < 2) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api.register({ full_name: name.trim(), email: email.trim(), password, language: lang });
      setSent(res);
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.verifyEmail(email.trim(), code.trim());
      acceptToken(res, true);
      navigate("/bienvenue", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      setSent(await api.resendCode(email.trim()));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const footer = (
    <p className="text-[14px] text-mute">
      {L("Déjà un compte ?", "Already have an account?", "عندك حساب؟")}{" "}
      <Link to="/connexion" className="font-bold no-underline">
        {L("Se connecter", "Log in", "ادخل")}
      </Link>
    </p>
  );

  if (step === "code") {
    return (
      <AuthShell title={L("Vérifie ton e-mail", "Check your email", "ثبّت في الإيميل متاعك")} footer={footer}>
        <form onSubmit={submitCode} className="flex flex-col gap-[18px]" noValidate>
          <p className="flex items-start gap-3 text-[14px] text-body">
            <MailCheck size={20} strokeWidth={1.8} className="mt-0.5 shrink-0 text-link" aria-hidden />
            <span>
              {L("Un code à 6 chiffres a été envoyé à", "A 6-digit code was sent to", "بعثنا كود فيه 6 أرقام لـ")} <strong dir="ltr">{email}</strong>.{" "}
              {L(
                `Il est valable ${sent?.expires_in_min ?? 30} minutes.`,
                `It is valid for ${sent?.expires_in_min ?? 30} minutes.`,
                `صالح لمدة ${sent?.expires_in_min ?? 30} دقيقة.`,
              )}
            </span>
          </p>
          <DevCodeNotice sent={sent} />
          <Field
            label={L("Code de vérification", "Verification code", "كود التثبيت")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="text-center text-[22px] font-extrabold tracking-[0.4em]"
            dir="ltr"
          />
          {error && (
            <Banner tone="broken" role="alert">
              {error}
            </Banner>
          )}
          <Button type="submit" size="lg" block disabled={busy || code.length !== 6}>
            {busy ? L("Vérification…", "Checking…", "قاعد يثبّت…") : L("Confirmer mon compte", "Confirm my account", "أكّد الحساب متاعي")}
          </Button>
          <Button variant="ghost" onClick={resend}>
            {L("Renvoyer le code", "Send the code again", "عاود ابعث الكود")}
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={L("Créer un compte", "Create an account", "اعمل حساب")} footer={footer}>
      <form onSubmit={submitForm} className="flex flex-col gap-4" noValidate>
        <Field
          label={L("Nom complet", "Full name", "الاسم الكامل")}
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={touched && name.trim().length < 2 ? L("Indique ton nom.", "Enter your name.", "اكتب اسمك.") : null}
        />
        <Field
          label={L("E-mail", "Email", "الإيميل")}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="salma@exemple.tn"
          dir="ltr"
        />
        <PasswordField
          label={L("Mot de passe", "Password", "كلمة السر")}
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          help={L("8 caractères minimum.", "8 characters minimum.", "8 حروف على الأقل.")}
        />
        <PasswordField
          label={L("Confirme le mot de passe", "Confirm the password", "عاود كلمة السر")}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={pwError}
        />
        {error && (
          <Banner tone="broken" role="alert">
            {error}
          </Banner>
        )}
        <Button type="submit" size="lg" block disabled={busy || !email || !password}>
          {busy ? L("Création…", "Creating…", "قاعد يتعمل…") : L("Créer mon compte", "Create my account", "اعمل الحساب")}
        </Button>
      </form>
    </AuthShell>
  );
}
