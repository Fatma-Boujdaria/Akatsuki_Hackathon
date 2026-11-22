import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, setHouseholdId, setToken, setUnauthorizedHandler } from "./api";
import { useI18n, type Lang } from "./i18n";
import type { TokenOut, User } from "./types";

interface AuthCtx {
  user: User | null;
  /** True while the saved token is being checked at start-up. */
  checking: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  /** Log in with a token from verify-email / change-password. */
  acceptToken: (res: TokenOut, remember?: boolean) => void;
  logout: () => void;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [checking, setChecking] = useState(() => getToken() !== null);
  const { lang, setLang } = useI18n();

  // The account's language wins over the browser's last choice.
  const adoptLanguage = useCallback(
    (u: User | null) => {
      const l = u?.language;
      if ((l === "fr" || l === "en" || l === "ar") && l !== lang) setLang(l as Lang);
    },
    [lang, setLang],
  );

  const setUser = useCallback((u: User) => setUserState(u), []);

  const logout = useCallback(() => {
    setToken(null);
    setHouseholdId(null);
    setUserState(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUserState(null));
    if (getToken()) {
      api
        .me()
        .then((u) => {
          setUserState(u);
          adoptLanguage(u);
        })
        .catch(() => setUserState(null))
        .finally(() => setChecking(false));
    }
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptToken = useCallback(
    (res: TokenOut, remember = true) => {
      setToken(res.access_token, remember);
      setUserState(res.user);
      adoptLanguage(res.user);
    },
    [adoptLanguage],
  );

  const login = useCallback(
    async (email: string, password: string, remember = false) => {
      const res = await api.login(email, password, remember);
      setHouseholdId(null); // a different account may log in on this browser
      acceptToken(res, remember);
    },
    [acceptToken],
  );

  const value = useMemo(
    () => ({ user, checking, login, acceptToken, logout, setUser }),
    [user, checking, login, acceptToken, logout, setUser],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

/** First name for the greeting ("Bonjour, Amine"). */
export function firstName(user: User | null): string {
  const n = user?.full_name?.trim();
  if (n) return n.split(/\s+/)[0];
  return user?.email.split("@")[0] ?? "";
}

export function initial(user: User | null): string {
  return (firstName(user)[0] ?? "?").toUpperCase();
}
