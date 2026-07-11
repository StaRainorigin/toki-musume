import { getForegroundWindow } from '../tauri-bridge'
import { DEFAULTS } from '../config'
import type { ForegroundWindow } from '../types'

export type PollResult = {
  current: ForegroundWindow | null
  changed: boolean
}

export class WindowPoller {
  private intervalId: number | null = null
  private lastWindow: ForegroundWindow | null = null
  private lastCheckAt = 0

  start(
    onWindowChange: (win: ForegroundWindow) => void,
    intervalSec: number = DEFAULTS.pollIntervalSec,
  ): void {
    if (this.intervalId !== null) return
    this.intervalId = window.setInterval(async () => {
      const win = await getForegroundWindow()
      this.lastCheckAt = Date.now()
      if (!win) return

      const changed =
        !this.lastWindow ||
        this.lastWindow.processName !== win.processName ||
        this.lastWindow.windowTitle !== win.windowTitle

      if (changed) {
        this.lastWindow = win
        onWindowChange(win)
      }
    }, intervalSec * 1000)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
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
