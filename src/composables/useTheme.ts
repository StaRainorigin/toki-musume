import { ref } from 'vue'

export type ThemeName = 'pink' | 'blue' | 'green' | 'purple' | 'dark'

export type Theme = {
  name: ThemeName
  label: string
  icon: string
  colors: Record<string, string>
}

const themes: Theme[] = [
  {
    name: 'pink',
    label: '樱花粉',
    icon: 'tabler:palette',
    colors: {
      '--color-accent': '#ff8fa3',
      '--color-accent-hover': '#f4798f',
      '--color-accent-light': '#ffe0e6',
      '--color-bg': '#fff9f5',
      '--color-bg-card': '#ffffff',
      '--color-bg-secondary': '#fff4ee',
      '--color-bg-hover': '#fef0eb',
      '--color-border': '#f0ddd5',
      '--color-border-light': '#fce8e0',
      '--color-text': '#5a4a44',
      '--color-text-secondary': '#9b8580',
      '--color-text-muted': '#c4b0aa',
      '--shadow-sm': '0 2px 8px rgba(255, 143, 163, 0.08)',
      '--shadow-md': '0 4px 16px rgba(255, 143, 163, 0.12)',
      '--shadow-lg': '0 8px 24px rgba(255, 143, 163, 0.16)',
    },
  },
  {
    name: 'blue',
    label: '天际蓝',
    icon: 'tabler:palette',
    colors: {
      '--color-accent': '#5b9bd5',
      '--color-accent-hover': '#4a8ac4',
      '--color-accent-light': '#e1f0fb',
      '--color-bg': '#f8fbff',
      '--color-bg-card': '#ffffff',
      '--color-bg-secondary': '#eef5fc',
      '--color-bg-hover': '#e1f0fb',
      '--color-border': '#d0e0f0',
      '--color-border-light': '#e0ecf6',
      '--color-text': '#3a4a54',
      '--color-text-secondary': '#7090a0',
      '--color-text-muted': '#a0b8c8',
      '--shadow-sm': '0 2px 8px rgba(91, 155, 213, 0.08)',
      '--shadow-md': '0 4px 16px rgba(91, 155, 213, 0.12)',
      '--shadow-lg': '0 8px 24px rgba(91, 155, 213, 0.16)',
    },
  },
  {
    name: 'green',
    label: '森林绿',
    icon: 'tabler:palette',
    colors: {
      '--color-accent': '#6bbf8a',
      '--color-accent-hover': '#5aaf79',
      '--color-accent-light': '#e1f7ed',
      '--color-bg': '#f8fff9',
      '--color-bg-card': '#ffffff',
      '--color-bg-secondary': '#eef9f3',
      '--color-bg-hover': '#e1f7ed',
      '--color-border': '#d0e8d8',
      '--color-border-light': '#e0f0e6',
      '--color-text': '#3a5a44',
      '--color-text-secondary': '#709b80',
      '--color-text-muted': '#a0c8b0',
      '--shadow-sm': '0 2px 8px rgba(107, 191, 138, 0.08)',
      '--shadow-md': '0 4px 16px rgba(107, 191, 138, 0.12)',
      '--shadow-lg': '0 8px 24px rgba(107, 191, 138, 0.16)',
    },
  },
  {
    name: 'purple',
    label: '薰衣紫',
    icon: 'tabler:palette',
    colors: {
      '--color-accent': '#b48bcf',
      '--color-accent-hover': '#a47bbf',
      '--color-accent-light': '#f0e8fa',
      '--color-bg': '#fbf8ff',
      '--color-bg-card': '#ffffff',
      '--color-bg-secondary': '#f5eefa',
      '--color-bg-hover': '#f0e8fa',
      '--color-border': '#e0d5ea',
      '--color-border-light': '#ece4f2',
      '--color-text': '#4a3a54',
      '--color-text-secondary': '#807090',
      '--color-text-muted': '#b0a0c0',
      '--shadow-sm': '0 2px 8px rgba(180, 139, 207, 0.08)',
      '--shadow-md': '0 4px 16px rgba(180, 139, 207, 0.12)',
      '--shadow-lg': '0 8px 24px rgba(180, 139, 207, 0.16)',
    },
  },
  {
    name: 'dark',
    label: '深夜黑',
    icon: 'tabler:moon',
    colors: {
      '--color-accent': '#c88aa0',
      '--color-accent-hover': '#b87a90',
      '--color-accent-light': '#3a2a30',
      '--color-bg': '#1a1a2e',
      '--color-bg-card': '#252535',
      '--color-bg-secondary': '#2a2a3a',
      '--color-bg-hover': '#333345',
      '--color-border': '#3a3a4a',
      '--color-border-light': '#2e2e3e',
      '--color-text': '#e0e0e8',
      '--color-text-secondary': '#a0a0b0',
      '--color-text-muted': '#606078',
      '--shadow-sm': '0 2px 8px rgba(0, 0, 0, 0.2)',
      '--shadow-md': '0 4px 16px rgba(0, 0, 0, 0.3)',
      '--shadow-lg': '0 8px 24px rgba(0, 0, 0, 0.4)',
    },
  },
]

const STORAGE_KEY = 'toki-musume-theme'
const currentTheme = ref<ThemeName>('pink')

function applyTheme(theme: Theme) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(key, value)
  }
}

function setTheme(name: ThemeName) {
  const theme = themes.find((t) => t.name === name)
  if (!theme) return
  currentTheme.value = name
  applyTheme(theme)
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch { /* ignore */ }
}

function initTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null
    if (saved) {
      setTheme(saved)
    } else {
      setTheme('pink')
    }
  } catch {
    setTheme('pink')
  }
}

export function useTheme() {
  return {
    themes,
    currentTheme,
    setTheme,
    initTheme,
  }
}
