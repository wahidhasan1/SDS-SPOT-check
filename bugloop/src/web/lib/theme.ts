// Theme preference. "System" leaves the root element alone so a host (such as the claude.ai
// artifact viewer) can stamp its own data-theme; an explicit choice overrides it.

import { useCallback, useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";
const KEY = "bugloop.theme";
const initialAttr = typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null;

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === "system") {
    if (initialAttr) root.setAttribute("data-theme", initialAttr);
    else root.removeAttribute("data-theme");
  } else root.setAttribute("data-theme", pref);
}

export function useTheme() {
  const [theme, setState] = useState<ThemePref>(read);
  useEffect(() => applyTheme(theme), [theme]);
  const setTheme = useCallback((t: ThemePref) => {
    setState(t);
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      // Preference lasts for this page load only.
    }
  }, []);
  return { theme, setTheme };
}

/** Apply the saved preference before first paint. */
export function initTheme(): void {
  if (typeof document !== "undefined") applyTheme(read());
}
