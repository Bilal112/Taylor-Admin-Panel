"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Three-way theme: "light" | "dark" | "system". "system" follows the OS
// preference and stays in sync if the user changes it while the app is
// open; picking "light" or "dark" pins it regardless of OS setting.
export type ThemeChoice = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeChoice) => void;
}

// Must match the theme-init inline script in app/layout.tsx.
const STORAGE_KEY = "taylor-app-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
});

const getSystemPref = (): ResolvedTheme =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const applyThemeClass = (resolved: ResolvedTheme) => {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default to "light" on first render (matches the server-rendered markup,
  // avoiding a hydration mismatch) — the real stored preference is read in
  // the effect below, right after mount.
  const [theme, setThemeState] = useState<ThemeChoice>("light");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
    const initial: ThemeChoice = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setThemeState(initial);
    const resolved = initial === "system" ? getSystemPref() : initial;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = getSystemPref();
      setResolvedTheme(resolved);
      applyThemeClass(resolved);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (next: ThemeChoice) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    const resolved = next === "system" ? getSystemPref() : next;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
