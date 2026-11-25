// Light / dark theme. The dark theme is a filter on the root element (see app.css),
// so every hand-tuned light colour, including the SVG diagrams, keeps its hue.

export type Theme = 'light' | 'dark'

const KEY = 'hpc4:theme'
const THEME_COLOR: Record<Theme, string> = { light: '#f5f6f7', dark: '#1f2123' }

function storedTheme(): Theme | undefined {
  try {
    const value = window.localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : undefined
  } catch {
    return undefined
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

function syncButton(button: HTMLButtonElement, theme: Theme) {
  const dark = theme === 'dark'
  button.setAttribute('aria-pressed', String(dark))
  button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode')
  button.title = dark ? 'Light mode' : 'Dark mode'
}

export function initThemeToggle(button: HTMLButtonElement) {
  applyTheme(storedTheme() ?? systemTheme())
  syncButton(button, currentTheme())

  button.addEventListener('click', () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    syncButton(button, next)
    try { window.localStorage.setItem(KEY, next) } catch { /* storage unavailable: theme lasts this visit */ }
  })

  // Follow the OS setting until the reader picks a theme explicitly.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (storedTheme()) return
    const next: Theme = event.matches ? 'dark' : 'light'
    applyTheme(next)
    syncButton(button, next)
  })
}
