import { getForegroundWindow, listenForegroundWindowChanged } from '../tauri-bridge'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { DEFAULTS } from '../config'
import type { ForegroundWindow } from '../types'

export type PollResult = {
  current: ForegroundWindow | null
  changed: boolean
}

/**
 * 窗口感知器
 * 主：监听 Tauri 事件（SetWinEventHook 实时通知）
 * 备：30 秒低频轮询（防止 hook 失败）
 */
export class WindowPoller {
  private fallbackIntervalId: number | null = null
  private unlistenFn: UnlistenFn | null = null
  private lastWindow: ForegroundWindow | null = null
  private lastCheckAt = 0

  async start(
    onWindowChange: (win: ForegroundWindow) => void,
    _intervalSec: number = DEFAULTS.pollIntervalSec,
  ): Promise<void> {
    // 1. 主：监听事件钩子
    try {
      this.unlistenFn = await listenForegroundWindowChanged((win) => {
        this.lastCheckAt = Date.now()
        if (this.handleWindow(win)) {
          onWindowChange(win)
        }
      })
    } catch (e) {
      console.error('[poller] 事件监听失败，回退到轮询', e)
    }

    // 2. 备：低频轮询（30秒）
    this.fallbackIntervalId = window.setInterval(async () => {
      const win = await getForegroundWindow()
      this.lastCheckAt = Date.now()
      if (!win) return
      if (this.handleWindow(win)) {
        onWindowChange(win)
      }
    }, DEFAULTS.fallbackPollSec * 1000)
  }

  /** 检查窗口是否变化，返回 true 表示变了 */
  private handleWindow(win: ForegroundWindow): boolean {
    const changed =
      !this.lastWindow ||
      this.lastWindow.processName !== win.processName ||
      this.lastWindow.windowTitle !== win.windowTitle

    if (changed) {
      this.lastWindow = win
      return true
    }
    return false
  }

  stop(): void {
    if (this.fallbackIntervalId !== null) {
      clearInterval(this.fallbackIntervalId)
      this.fallbackIntervalId = null
    }
    if (this.unlistenFn) {
      this.unlistenFn()
      this.unlistenFn = null
    }
  }

  getLastWindow(): ForegroundWindow | null {
    return this.lastWindow
  }

  getLastCheckAt(): number {
    return this.lastCheckAt
  }

  async forcePoll(): Promise<ForegroundWindow | null> {
    const win = await getForegroundWindow()
    this.lastCheckAt = Date.now()
    if (win) {
      this.lastWindow = win
    }
    return win
  }
}
