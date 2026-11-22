import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { DataProvider } from "./lib/data";
import { ThemeProvider } from "./lib/theme";
import { I18nProvider, LangRemount } from "./lib/i18n";
import { HouseholdsProvider, useHouseholds } from "./lib/households";
import { VirtualEspProvider } from "./lib/virtualEsp";
import { Layout } from "./components/Layout";
import { LoadingScreen } from "./components/LoadingScreen";
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";
import { ForgotPasswordPage } from "./pages/ForgotPassword";
import { OnboardingPage } from "./pages/Onboarding";
import { HomePage } from "./pages/Home";
import { ElectricityPage } from "./pages/Electricity";
import { WaterPage } from "./pages/Water";
import { AlertsPage } from "./pages/Alerts";
import { ChallengesPage } from "./pages/Challenges";
import { SettingsPage } from "./pages/Settings";
import { EspPanelPage } from "./pages/EspPanel";
import { AssistantPage } from "./pages/Assistant";
import { HistoryPage } from "./pages/History";
import { HouseholdsPage } from "./pages/Households";
import { HelpPage } from "./pages/Help";
import { ProfilePage } from "./pages/Profile";

// The admin panel is only for administrators: loaded on demand.
const AdminPage = lazy(() => import("./pages/admin/Admin").then((m) => ({ default: m.AdminPage })));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <LoadingScreen />;
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname + location.search + location.hash }} />;
  return <HouseholdsProvider>{children}</HouseholdsProvider>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Household screens: wait for the list of homes; none yet -> first-time setup
 * (an admin without a home goes to the admin panel). The data layer is keyed by
 * the chosen home, so switching homes reloads every screen.
 */
function HouseholdScreens() {
  const { user } = useAuth();
  const { households, current, loading, error } = useHouseholds();
  if (loading) return <LoadingScreen />;
  if (error && !households.length) return <LoadingScreen message={error} />;
  if (!households.length) return <Navigate to={user?.role === "admin" ? "/admin" : "/bienvenue"} replace />;
  return (
    <DataProvider key={current?.id ?? "none"}>
      <VirtualEspProvider>
        <Layout />
      </VirtualEspProvider>
    </DataProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <LangRemount>
            <BrowserRouter>
              <Routes>
                <Route path="/connexion" element={<LoginPage />} />
                <Route path="/inscription" element={<RegisterPage />} />
                <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
                <Route
                  path="/bienvenue"
                  element={
                    <RequireAuth>
                      <OnboardingPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin/*"
                  element={
                    <RequireAuth>
                      <RequireAdmin>
                        <Suspense fallback={<LoadingScreen />}>
                          <AdminPage />
                        </Suspense>
                      </RequireAdmin>
                    </RequireAuth>
                  }
                />
                <Route
                  element={
                    <RequireAuth>
                      <HouseholdScreens />
                    </RequireAuth>
                  }
                >
                  <Route index element={<HomePage />} />
                  <Route path="electricite" element={<ElectricityPage />} />
                  <Route path="eau" element={<WaterPage />} />
                  <Route path="assistant" element={<AssistantPage />} />
                  <Route path="alertes" element={<AlertsPage />} />
                  <Route path="historique" element={<HistoryPage />} />
                  <Route path="defis" element={<ChallengesPage />} />
                  <Route path="foyers" element={<HouseholdsPage />} />
                  <Route path="reglages" element={<SettingsPage />} />
                  <Route path="aide" element={<HelpPage />} />
                  <Route path="profil" element={<ProfilePage />} />
                  <Route path="esp" element={<EspPanelPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </LangRemount>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
