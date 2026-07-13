import type { Mode } from '../types'

export type ModeInfo = {
  icon: string
  label: string
  status: string
  colorVar: string
  lightVar: string
}

const modeInfo: Record<Mode, ModeInfo> = {
  idle: {
    icon: 'material-symbols:local-florist-rounded',
    label: '空闲',
    status: '在等你呀～',
    colorVar: '--color-idle',
    lightVar: '--color-idle-light',
  },
  companion: {
    icon: 'material-symbols:favorite-rounded',
    label: '陪伴',
    status: '陪你聊天中',
    colorVar: '--color-companion',
    lightVar: '--color-companion-light',
  },
  study: {
    icon: 'material-symbols:menu-book-rounded',
    label: '学习',
    status: '正在监督你学习～',
    colorVar: '--color-study',
    lightVar: '--color-study-light',
  },
  work: {
    icon: 'tabler:briefcase',
    label: '工作',
    status: '一起加油工作！',
    colorVar: '--color-work',
    lightVar: '--color-work-light',
  },
  rest: {
    icon: 'material-symbols:coffee-rounded',
    label: '休息',
    status: '好好休息一下吧',
    colorVar: '--color-rest',
    lightVar: '--color-rest-light',
  },
}

export function useModeIcons() {
  return modeInfo
}
