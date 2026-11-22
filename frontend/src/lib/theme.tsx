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
      .forEach((m) => m.setAttribute("content", resolved === "dark" ? "#0D1820" : "#EEF4FB"));
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
    grid: "#DCE6F0",
    axis: "#4A5B6C",
    ink: "#0D1820",
    body: "#24384C",
    surface: "#FFFFFF",
    elecStroke: "#A87000",
    elecFill: "#FEF3B3",
    elecDot: "#FEBD19",
    waterStroke: "#1D59BB",
    waterFill: "#DCEBFF",
    harissa: "#A15C00",
    cursor: "#8496A8",
  },
  dark: {
    grid: "#24384C",
    axis: "#9FB1C2",
    ink: "#FFFFFF",
    body: "#D5E1EC",
    surface: "#16273A",
    elecStroke: "#FEBD19",
    elecFill: "#2A2410",
    elecDot: "#FEBD19",
    waterStroke: "#76B9FF",
    waterFill: "#1D3B5E",
    harissa: "#FEBD19",
    cursor: "#6F8397",
  },
} as const;

export function useChartColors() {
  return CHART[useTheme().resolved];
}
