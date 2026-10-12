export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'theme'

export const getThemePref = (): ThemePref => {
  try {
    return (localStorage.getItem(KEY) as ThemePref) || 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(pref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1020' : '#1E4FD8')
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* private mode */
  }
  applyTheme(pref)
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme())
