import { getIdleMs } from '../tauri-bridge'
import { DEFAULTS } from '../config'

export type IdleDetectorState = {
  isIdle: boolean
  idleStartedAt: number | null
}

export function createIdleDetectorState(): IdleDetectorState {
  return { isIdle: false, idleStartedAt: null }
}

export async function checkIdle(
  state: IdleDetectorState,
  thresholdMin: number = DEFAULTS.idleThresholdMin,
): Promise<{ state: IdleDetectorState; transition: 'idle_started' | 'idle_ended' | null }> {
  const idleMs = await getIdleMs()
  const thresholdMs = thresholdMin * 60 * 1000
  const nowIdle = idleMs >= thresholdMs

  if (nowIdle && !state.isIdle) {
    return {
      state: { isIdle: true, idleStartedAt: Date.now() - idleMs },
      transition: 'idle_started',
    }
  }
  if (!nowIdle && state.isIdle) {
    return {
      state: { isIdle: false, idleStartedAt: null },
      transition: 'idle_ended',
    }
  }
  return { state, transition: null }
}
