import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/auth";
import { DataProvider, useData } from "./lib/data";
import { ThemeProvider } from "./lib/theme";
import { Layout } from "./components/Layout";
import { Logo, LogoMark } from "./components/Logo";
import { Button, Card } from "./components/ui";
import { LoginPage } from "./pages/Login";
import { HomePage } from "./pages/Home";
import { ElectricityPage } from "./pages/Electricity";
import { WaterPage } from "./pages/Water";
import { AlertsPage } from "./pages/Alerts";
import { ChallengesPage } from "./pages/Challenges";
import { SettingsPage } from "./pages/Settings";
import { EspPanelPage } from "./pages/EspPanel";
import { VirtualEspProvider } from "./lib/virtualEsp";
import type { ReactNode } from "react";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas" role="status" aria-label="Chargement">
      <LogoMark size={56} state="loading" />
    </div>
  );
}

/** An account without a household (e.g. the admin created by the seed script). */
function NoHousehold({ message }: { message: string }) {
  const { user, logout } = useAuth();
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4">
      <Card className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <Logo size={32} />
        </div>
        <h1 className="t-h2 mt-6 text-ink">{message}</h1>
        <p className="t-body mt-2 text-body">
          {user?.role === "admin"
            ? "Ce compte administrateur n'a pas de foyer. Connecte-toi avec le compte d'un foyer pour voir le tableau de bord."
            : "Ton compte n'est lié à aucun foyer. Demande à l'administrateur de t'en créer un."}
        </p>
        <p className="mt-3 font-mono text-[12px] text-mute">{user?.email}</p>
        <Button variant="secondary" className="mt-6" onClick={logout}>
          <LogOut size={18} strokeWidth={1.5} aria-hidden /> Se déconnecter
        </Button>
      </Card>
    </div>
  );
}

function HouseholdGate({ children }: { children: ReactNode }) {
  const { dashboard } = useData();
  if (!dashboard.data && dashboard.errorStatus === 404) return <NoHousehold message={dashboard.error ?? "Aucun foyer"} />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Splash />;
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname + location.hash }} />;
  return (
    <DataProvider>
      <VirtualEspProvider>
        <HouseholdGate>{children}</HouseholdGate>
      </VirtualEspProvider>
    </DataProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/connexion" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="electricite" element={<ElectricityPage />} />
              <Route path="eau" element={<WaterPage />} />
              <Route path="alertes" element={<AlertsPage />} />
              <Route path="defis" element={<ChallengesPage />} />
              <Route path="reglages" element={<SettingsPage />} />
              <Route path="esp" element={<EspPanelPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
