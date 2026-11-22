import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { L } from "../lib/i18n";
import { AuthShell } from "../components/AuthShell";
import { CheckboxField, Field, PasswordField } from "../components/Field";
import { Banner } from "../components/status";
import { Button } from "../components/ui";

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={user.role === "admin" && from === "/" ? "/admin" : from} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setBusy(true);
    try {
      await login(email.trim(), password, remember);
    } catch (err) {
      setError((err as Error).message);
      setUnverified(err instanceof ApiError && err.code === "email_not_verified");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      footer={
        <p className="text-[14px] text-mute">
          {L("Pas encore de compte ?", "No account yet?", "ما عندكش حساب؟")}{" "}
          <Link to="/inscription" className="font-bold no-underline">
            {L("Créer un compte", "Create an account", "اعمل حساب")}
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-[18px]" noValidate>
        <h1 className="sr-only">{L("Connexion", "Log in", "الدخول")}</h1>
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="-mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <CheckboxField label={L("Se souvenir de moi", "Remember me", "تفكّرني")} checked={remember} onChange={setRemember} />
          <Link to="/mot-de-passe-oublie" className="flex min-h-11 items-center text-[14px] font-semibold no-underline">
            {L("Mot de passe oublié ?", "Forgot password?", "نسيت كلمة السر؟")}
          </Link>
        </div>
        {error && (
          <Banner
            tone="broken"
            role="alert"
            actions={
              unverified ? (
                <Button variant="secondary" onClick={() => navigate(`/inscription?verifier=${encodeURIComponent(email.trim())}`)}>
                  {L("Saisir mon code", "Enter my code", "دخّل الكود")}
                </Button>
              ) : undefined
            }
          >
            {error}
          </Banner>
        )}
        <Button type="submit" size="lg" block disabled={busy || !email || !password}>
          {busy ? L("Connexion…", "Logging in…", "قاعد يدخل…") : L("Se connecter", "Log in", "ادخل")}
        </Button>
      </form>
    </AuthShell>
  );
}
