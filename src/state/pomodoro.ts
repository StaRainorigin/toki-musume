import type { PomodoroState, PomodoroPhase, PomodoroConfig } from '../types'

const DEFAULT_CONFIG: PomodoroConfig = {
  focusMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  cyclesBeforeLongBreak: 4,
}

export function createPomodoroState(config?: Partial<PomodoroConfig>): PomodoroState {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  return {
    phase: 'idle',
    phaseStartedAt: 0,
    phaseDurationMin: 0,
    cycleCount: 0,
    ...cfg,
  }
}

/** 开始专注阶段 */
export function startFocus(state: PomodoroState): PomodoroState {
  return {
    ...state,
    phase: 'focus',
    phaseStartedAt: Date.now(),
    phaseDurationMin: state.focusMin,
  }
}

/** 开始休息阶段（根据 cycleCount 决定短休还是长休） */
export function startBreak(state: PomodoroState): PomodoroState {
  const isLongBreak = state.cycleCount > 0 && state.cycleCount % state.cyclesBeforeLongBreak === 0
  return {
    ...state,
    phase: isLongBreak ? 'long_break' : 'break',
    phaseStartedAt: Date.now(),
    phaseDurationMin: isLongBreak ? state.longBreakMin : state.breakMin,
  }
}

/** 专注结束 → cycleCount+1，返回新状态 */
export function completeFocus(state: PomodoroState): PomodoroState {
  return {
    ...state,
    cycleCount: state.cycleCount + 1,
  }
}

/** 停止番茄钟 */
export function stopPomodoro(state: PomodoroState): PomodoroState {
  return {
    ...state,
    phase: 'idle',
    phaseStartedAt: 0,
    phaseDurationMin: 0,
  }
}

/** 检查当前阶段是否结束 */
export function checkPhaseEnd(state: PomodoroState, now: number): boolean {
  if (state.phase === 'idle') return false
  const elapsedMs = now - state.phaseStartedAt
  const elapsedMin = elapsedMs / 60000
  return elapsedMin >= state.phaseDurationMin
}

/** 获取当前阶段已过分钟 */
export function getElapsedMin(state: PomodoroState): number {
  if (state.phase === 'idle') return 0
  return Math.floor((Date.now() - state.phaseStartedAt) / 60000)
}

/** 获取剩余分钟 */
export function getRemainingMin(state: PomodoroState): number {
  if (state.phase === 'idle') return 0
  const remaining = state.phaseDurationMin - getElapsedMin(state)
  return Math.max(0, remaining)
}

/** 获取剩余秒数（用于精确显示） */
export function getRemainingSec(state: PomodoroState): number {
  if (state.phase === 'idle') return 0
  const elapsedSec = Math.floor((Date.now() - state.phaseStartedAt) / 1000)
  const totalSec = state.phaseDurationMin * 60
  return Math.max(0, totalSec - elapsedSec)
}

/** 获取进度百分比 0-1 */
export function getProgress(state: PomodoroState): number {
  if (state.phase === 'idle') return 0
  const elapsedSec = (Date.now() - state.phaseStartedAt) / 1000
  const totalSec = state.phaseDurationMin * 60
  return Math.min(1, elapsedSec / totalSec)
}

/** 获取阶段显示文本 */
export function getPhaseLabel(phase: PomodoroPhase): string {
  switch (phase) {
    case 'focus': return '专注中'
    case 'break': return '短休息'
    case 'long_break': return '长休息'
    case 'idle': return '待开始'
  }
}
