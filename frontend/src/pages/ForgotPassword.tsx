import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CircleCheck } from "lucide-react";
import { api } from "../lib/api";
import { L } from "../lib/i18n";
import type { CodeSent } from "../lib/types";
import { AuthShell } from "../components/AuthShell";
import { Field, PasswordField } from "../components/Field";
import { Banner } from "../components/status";
import { Button, ButtonLink } from "../components/ui";
import { DevCodeNotice, passwordProblem } from "./Register";

/** 1. email -> 2. code + new password -> 3. back to login. */
export function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setSent(await api.forgotPassword(email.trim()));
      setStep("reset");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (passwordProblem(password, confirm)) return;
    setError(null);
    setBusy(true);
    try {
      await api.resetPassword(email.trim(), code, password);
      setStep("done");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <Link to="/connexion" className="text-[14px] font-bold no-underline">
      {L("Retour à la connexion", "Back to log in", "ارجع للدخول")}
    </Link>
  );

  if (step === "done") {
    return (
      <AuthShell title={L("Mot de passe changé", "Password changed", "كلمة السر تبدّلت")} footer={footer}>
        <div className="flex flex-col items-center gap-4 text-center">
          <CircleCheck size={48} strokeWidth={1.6} className="text-success" aria-hidden />
          <p className="text-[15px] text-body">
            {L(
              "Ton nouveau mot de passe est enregistré. Les autres sessions ont été déconnectées.",
              "Your new password is saved. Other sessions were logged out.",
              "كلمة السر الجديدة تسجّلت. الجلسات الأخرى تسكّرت.",
            )}
          </p>
          <ButtonLink to="/connexion" className="w-full">
            {L("Se connecter", "Log in", "ادخل")}
          </ButtonLink>
        </div>
      </AuthShell>
    );
  }

  if (step === "reset") {
    return (
      <AuthShell title={L("Choisis un nouveau mot de passe", "Choose a new password", "اختار كلمة سر جديدة")} footer={footer}>
        <form onSubmit={reset} className="flex flex-col gap-4" noValidate>
          <p className="text-[14px] text-body">
            {L(
              "Si un compte existe pour cette adresse, un code à 6 chiffres vient d'y être envoyé.",
              "If an account exists for this address, a 6-digit code was just sent to it.",
              "كان فما حساب بالإيميل هذا، بعثنالو كود فيه 6 أرقام.",
            )}
          </p>
          <DevCodeNotice sent={sent} />
          <Field
            label={L("Code reçu", "Code received", "الكود اللي وصلك")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-[22px] font-extrabold tracking-[0.4em]"
            dir="ltr"
          />
          <PasswordField
            label={L("Nouveau mot de passe", "New password", "كلمة السر الجديدة")}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            help={L("8 caractères minimum.", "8 characters minimum.", "8 حروف على الأقل.")}
          />
          <PasswordField
            label={L("Confirme le mot de passe", "Confirm the password", "عاود كلمة السر")}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={touched ? passwordProblem(password, confirm) : null}
          />
          {error && (
            <Banner tone="broken" role="alert">
              {error}
            </Banner>
          )}
          <Button type="submit" size="lg" block disabled={busy || code.length !== 6 || !password}>
            {L("Enregistrer", "Save", "سجّل")}
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={L("Mot de passe oublié", "Forgot password", "نسيت كلمة السر")} footer={footer}>
      <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
        <p className="text-[14px] text-body">
          {L(
            "Indique l'adresse de ton compte : on t'envoie un code pour choisir un nouveau mot de passe.",
            "Enter your account's email: we send you a code to choose a new password.",
            "اكتب الإيميل متاع الحساب: نبعثولك كود باش تختار كلمة سر جديدة.",
          )}
        </p>
        <Field
          label={L("E-mail", "Email", "الإيميل")}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
        />
        {error && (
          <Banner tone="broken" role="alert">
            {error}
          </Banner>
        )}
        <Button type="submit" size="lg" block disabled={busy || !email}>
          {L("Recevoir un code", "Get a code", "ابعثلي كود")}
        </Button>
      </form>
    </AuthShell>
  );
}
