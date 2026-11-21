import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/Logo";
import { Field } from "../components/Field";
import { Banner } from "../components/status";
import { Button } from "../components/ui";
import { TrancheBar } from "../components/TrancheBar";
import type { TrancheView } from "../lib/tranche";

// A static sample of the signature bar, the same one as on the charter's identity board.
const SAMPLE: TrancheView = {
  state: "safe",
  used: 182,
  next: 200,
  crossedAt: null,
  left: 18,
  nextBandLabel: "201–300 kWh",
  currentBandLabel: "1–200 kWh",
  forecast: 260,
  scaleMax: 300,
  marks: [200, 300],
  crossingDate: null,
  forecastCrosses: true,
};

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 min-h-dvh bg-canvas lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-hairline p-12 lg:flex">
        <Logo size={32} />
        <div className="max-w-lg">
          <p className="t-label mb-3 text-primary">Électricité · eau · STEG · SONEDE</p>
          <h1 className="font-display text-[44px] leading-[50px] font-semibold tracking-[-1.5px] text-ink">
            Vois ta facture avant qu'elle arrive.
          </h1>
          <p className="t-body mt-5 text-body">
            Une box et un tableau de bord qui mesurent l'électricité et l'eau de ton foyer en temps réel, estiment la
            facture STEG et SONEDE, et te préviennent avant un changement de tranche.
          </p>
          <div className="mt-10 rounded-card border border-hairline bg-surface p-6">
            <p className="text-[17px] text-body">Encore</p>
            <p className="t-hero text-ink">18 kWh</p>
            <p className="t-body mb-5 text-body">avant la tranche 201–300 kWh</p>
            <TrancheBar view={SAMPLE} />
          </div>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Personnalité">
          {["Clair", "Calme", "Fiable", "Un peu joueur"].map((w) => (
            <li key={w} className="rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-[14px] text-ink">
              {w}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo size={36} wordmarkClass="text-[22px]" />
            <p className="t-body mt-4 text-body">Vois ta facture avant qu'elle arrive.</p>
          </div>
          <h2 className="t-h1 text-ink">Connexion</h2>
          <p className="t-small mt-1 text-mute">Avec le compte de ton foyer.</p>
          <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.tn"
            />
            <Field
              label="Mot de passe"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <Banner tone="broken" role="alert">
                {error}
              </Banner>
            )}
            <Button type="submit" block disabled={busy || !email || !password}>
              {busy ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
