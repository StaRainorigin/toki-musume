import type { Mode, Goal, GoalMode } from '../types'

export type ModeMachineState = {
  mode: Mode
  activeGoal: Goal | null
  restReturnMode: Mode | null
  restUntil: number | null
}

export function createInitialState(): ModeMachineState {
  return {
    mode: 'idle',
    activeGoal: null,
    restReturnMode: null,
    restUntil: null,
  }
}

export type TransitionResult =
  | { ok: true; state: ModeMachineState; event: { type: string; [k: string]: unknown } }
  | { ok: false; reason: string }

export function startGoal(
  state: ModeMachineState,
  mode: GoalMode,
  topic: string,
  plannedMinutes?: number,
): TransitionResult {
  if (state.mode === 'rest') {
    return { ok: false, reason: '休息中，无法开始目标' }
  }
  const goal: Goal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mode,
    topic,
    plannedMinutes,
    startedAt: Date.now(),
    status: 'active',
  }
  const newState: ModeMachineState = {
    ...state,
    mode,
    activeGoal: goal,
  }
  return { ok: true, state: newState, event: { type: 'goal_started', goal } }
}

export function endGoal(state: ModeMachineState): TransitionResult {
  if (!state.activeGoal) {
    return { ok: false, reason: '当前没有活跃目标' }
  }
  const endedGoal: Goal = {
    ...state.activeGoal,
    endedAt: Date.now(),
    status: 'completed',
  }
  const newState: ModeMachineState = {
    ...state,
    mode: 'idle',
    activeGoal: null,
  }
  return { ok: true, state: newState, event: { type: 'goal_ended', goal: endedGoal } }
}

export function startRest(state: ModeMachineState, minutes: number): TransitionResult {
  if (state.mode === 'rest') {
    return { ok: false, reason: '已经在休息中' }
  }
  const newState: ModeMachineState = {
    ...state,
    mode: 'rest',
    restReturnMode: state.mode,
    restUntil: Date.now() + minutes * 60 * 1000,
  }
  return { ok: true, state: newState, event: { type: 'mode_switch', from: state.restReturnMode ?? state.mode, to: 'rest' } }
}

export function endRest(state: ModeMachineState): TransitionResult {
  if (state.mode !== 'rest') {
    return { ok: false, reason: '当前不在休息模式' }
  }
  const returnMode = state.restReturnMode ?? 'idle'
  const newState: ModeMachineState = {
    ...state,
    mode: returnMode,
    restReturnMode: null,
    restUntil: null,
  }
  return { ok: true, state: newState, event: { type: 'mode_switch', from: 'rest', to: returnMode } }
}

export function enterCompanion(state: ModeMachineState): TransitionResult {
  if (state.mode === 'rest') {
    return { ok: false, reason: '休息中，无法进入陪伴' }
  }
  // 如果有活跃目标，先结束它
  let s = state
  if (s.activeGoal) {
    const ended = endGoal(s)
    if (ended.ok) s = ended.state
  }
  const newState: ModeMachineState = { ...s, mode: 'companion' }
  return { ok: true, state: newState, event: { type: 'mode_switch', from: state.mode, to: 'companion' } }
}

export function backToIdle(state: ModeMachineState): TransitionResult {
  if (state.activeGoal) {
    return { ok: false, reason: '有活跃目标，无法回到空闲' }
  }
  const newState: ModeMachineState = { ...state, mode: 'idle' }
  return { ok: true, state: newState, event: { type: 'mode_switch', from: state.mode, to: 'idle' } }
}

export function checkRestTimeout(state: ModeMachineState, now: number): TransitionResult | null {
  if (state.mode === 'rest' && state.restUntil !== null && now >= state.restUntil) {
    return endRest(state)
  }
  return null
}
