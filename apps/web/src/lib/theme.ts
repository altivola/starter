export type Theme = 'light' | 'dark'

const KEY = 'theme'

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Storage can be blocked; the theme still applies for this visit.
  }
}
