"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Replaces next-themes: its internal <script> (rendered from inside this
// client tree) trips React 19's "script tag while rendering" dev warning.
// The anti-flash script instead lives directly in the root layout's <head>
// (a Server Component, see src/app/layout.jsx) — the pattern Next's own docs
// recommend (see node_modules/next/dist/docs/.../preventing-flash-before-hydration.md).
export const THEMES = ["light", "dark", "reading"];
const STORAGE_KEY = "theme";
const DEFAULT_THEME = "light";

const ThemeContext = createContext(null);

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove(...THEMES);
  root.classList.add(theme);
}

function readStoredTheme() {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  // The inline <head> script already applied the right class before paint;
  // this just keeps it in sync (a no-op in the common case).
  useEffect(() => {
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — localStorage unavailable (private mode, etc.)
    }
  }, []);

  // Stay in sync if the theme is changed in another tab.
  useEffect(() => {
    function onStorage(e) {
      if (e.key === STORAGE_KEY && THEMES.includes(e.newValue)) {
        setThemeState(e.newValue);
        applyTheme(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme: theme, setTheme, themes: THEMES }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
