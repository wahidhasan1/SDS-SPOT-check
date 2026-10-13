export type ThemePref = 'system' | 'light' | 'dark';

export function applyTheme(pref: ThemePref) {
  try {
    localStorage.setItem('fp-theme', pref);
  } catch {
    /* storage may be unavailable */
  }
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
