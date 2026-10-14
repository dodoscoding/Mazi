import { useCallback, useSyncExternalStore } from "react";

export type Theme = "night" | "day";

export const THEME_KEY = "mazi.theme";
const themeColor: Record<Theme, string> = { night: "#05070c", day: "#f4f2ec" };
const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.dataset.theme === "day" ? "day" : "night";
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", themeColor[theme]);
  listeners.forEach((listener) => listener());
}

export function setTheme(theme: Theme) {
  apply(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the theme still applies for this visit.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const sync = (event: StorageEvent) => {
    if (event.key === THEME_KEY)
      apply(event.newValue === "day" ? "day" : "night");
  };
  addEventListener("storage", sync);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", sync);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, current, () => "night");
  const toggle = useCallback(
    () => setTheme(current() === "night" ? "day" : "night"),
    [],
  );
  return { theme, toggle, setTheme };
}
