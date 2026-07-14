import type { Mode } from '../types'

export type ModeInfo = {
  icon: string
  label: string
  status: string
  colorVar: string
  lightVar: string
}

const modeInfo: Record<Mode, ModeInfo> = {
  focus: {
    icon: 'tabler:focus-2',
    label: '专注中',
    status: '正在帮你监督～',
    colorVar: '--color-accent',
    lightVar: '--color-accent-light',
  },
  rest: {
    icon: 'tabler:coffee',
    label: '休息中',
    status: '陪你聊天中～',
    colorVar: '--color-rest',
    lightVar: '--color-rest-light',
  },
}

export function useModeIcons() {
  return modeInfo
}
