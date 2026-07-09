import type { Mode, ForegroundWindow } from '../types'
import { DEFAULTS } from '../config'
import { AppProfileStore } from '../slack/app-profiles'

export type CompanionEvent =
  | { type: 'window_switch_interesting'; window: ForegroundWindow }
  | { type: 'idle_started'; idleMinutes: number }
  | { type: 'idle_ended' }
  | { type: 'long_same_activity'; processName: string; minutes: number }
  | { type: 'fallback_timer' }

export class CompanionTriggerEngine {
  private fallbackIntervalId: number | null = null
  private activityStartAt: Map<string, number> = new Map()

  constructor(
    private profiles: AppProfileStore,
    private onEvent: (event: CompanionEvent) => void,
  ) {}

  handleWindowSwitch(win: ForegroundWindow, mode: Mode): void {
    if (mode !== 'companion' && mode !== 'idle') return

    const now = Date.now()
    for (const [proc, start] of this.activityStartAt) {
      const minutes = (now - start) / 60000
      if (minutes >= DEFAULTS.longActivityThresholdMin) {
        this.onEvent({ type: 'long_same_activity', processName: proc, minutes })
      }
    }
    this.activityStartAt.set(win.processName, now)

    const list = this.profiles.lookup(win.processName)
    if (list === 'blacklist') {
      this.onEvent({ type: 'window_switch_interesting', window: win })
    }
  }

  handleIdleTransition(transition: 'idle_started' | 'idle_ended', idleMinutes?: number): void {
    if (transition === 'idle_started') {
      this.onEvent({ type: 'idle_started', idleMinutes: idleMinutes ?? 0 })
    } else {
      this.onEvent({ type: 'idle_ended' })
    }
  }

  startFallbackTimer(intervalMin: number = DEFAULTS.pollIntervalSec * 12): void {
    this.stopFallbackTimer()
    this.fallbackIntervalId = window.setInterval(() => {
      this.onEvent({ type: 'fallback_timer' })
    }, intervalMin * 60 * 1000)
  }

  stopFallbackTimer(): void {
    if (this.fallbackIntervalId !== null) {
      clearInterval(this.fallbackIntervalId)
      this.fallbackIntervalId = null
    }
  }
}
