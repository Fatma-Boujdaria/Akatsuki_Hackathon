import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "tg-theme";

interface ThemeCtx {
  choice: ThemeChoice;
  resolved: "light" | "dark";
  setChoice: (c: ThemeChoice) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [systemDark, setSystemDark] = useState(() => media().matches);

  useEffect(() => {
    const m = media();
    const onChange = () => setSystemDark(m.matches);
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", resolved === "dark" ? "#0D171F" : "#F5F7FA"));
  }, [resolved]);

  const value = useMemo<ThemeCtx>(
    () => ({
      choice,
      resolved,
      setChoice: (c) => {
        setChoiceState(c);
        try {
          localStorage.setItem(KEY, c);
        } catch {
          /* not persisted in private mode */
        }
      },
    }),
    [choice, resolved],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme outside ThemeProvider");
  return v;
}

/** Chart colours as plain hex (SVG attributes can't read CSS variables). */
export const CHART = {
  light: {
    grid: "#DDE3EA",
    axis: "#5A6576",
    ink: "#0D171F",
    body: "#354150",
    surface: "#FFFFFF",
    elecStroke: "#A87000",
    elecFill: "#FEF3B3",
    elecDot: "#FEBD19",
    waterStroke: "#2B6FC2",
    waterFill: "#E3F0FF",
    harissa: "#C2401B",
    cursor: "#7C8796",
  },
  dark: {
    grid: "#263848",
    axis: "#95A3B3",
    ink: "#EAF0F6",
    body: "#C4CFDB",
    surface: "#13212C",
    elecStroke: "#FEBD19",
    elecFill: "#34372A",
    elecDot: "#FEBD19",
    waterStroke: "#76B9FF",
    waterFill: "#22384C",
    harissa: "#FF8A63",
    cursor: "#6F7E8F",
  },
} as const;

export function useChartColors() {
  return CHART[useTheme().resolved];
}
