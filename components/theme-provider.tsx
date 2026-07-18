"use client"

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react"

type Theme = "light" | "dark" | "system"
type ResolvedTheme = "light" | "dark"

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = "theme"
const THEME_EVENT = "hrm-theme-change"

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function readTheme(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system"
  } catch {
    return "system"
  }
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme
}

// Client-only subscription used by useSyncExternalStore. getServerSnapshot
// below always wins on the server + first client render, so this never runs
// during SSR/hydration — only after, when it's safe to read the real value.
function subscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  media.addEventListener("change", callback)
  window.addEventListener("storage", callback)
  window.addEventListener(THEME_EVENT, callback)
  return () => {
    media.removeEventListener("change", callback)
    window.removeEventListener("storage", callback)
    window.removeEventListener(THEME_EVENT, callback)
  }
}

function getThemeSnapshot(): Theme {
  return readTheme()
}

function getThemeServerSnapshot(): Theme {
  return "system"
}

function getResolvedSnapshot(): ResolvedTheme {
  return resolveTheme(readTheme())
}

function getResolvedServerSnapshot(): ResolvedTheme {
  return "light"
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolved === "dark")
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getThemeServerSnapshot
  )
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    getResolvedSnapshot,
    getResolvedServerSnapshot
  )

  useEffect(() => {
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme])

  function setTheme(next: Theme) {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore write errors (e.g. private browsing)
    }
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
