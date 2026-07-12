import type { Goal, ReminderLevel } from '../types'
import { DEFAULTS } from '../config'
import { LLMClient, FALLBACK_REPLIES } from '../llm/client'
import { buildReminderPrompt } from '../llm/prompts'
import { showNotification } from '../tauri-bridge'

export type ReminderState = {
  slackStartedAt: number | null
  currentLevel: 0 | 1 | 2 | 3
  sokaiPausedUntil: number | null
  sokaiCount: number
}

export function createReminderState(): ReminderState {
  return {
    slackStartedAt: null,
    currentLevel: 0,
    sokaiPausedUntil: null,
    sokaiCount: 0,
  }
}

export function checkReminderLevel(state: ReminderState, now: number = Date.now()): ReminderLevel | null {
  if (state.sokaiPausedUntil !== null && now < state.sokaiPausedUntil) {
    return null
  }
  if (state.slackStartedAt === null) return null

  const elapsedSec = (now - state.slackStartedAt) / 1000
  const level1Sec = DEFAULTS.slackLevel1Sec
  const level2Sec = DEFAULTS.slackLevel2Min * 60
  const level3Sec = DEFAULTS.slackLevel3Min * 60

  if (elapsedSec >= level3Sec && state.currentLevel < 3) return 3
  if (elapsedSec >= level2Sec && state.currentLevel < 2) return 2
  if (elapsedSec >= level1Sec && state.currentLevel < 1) return 1
  return null
}

export async function generateReminderMessage(
  llm: LLMClient,
  level: ReminderLevel,
  goal: Goal,
): Promise<string> {
  if (!llm.isConfigured('generate')) {
    const fallbacks: Record<ReminderLevel, string> = {
      1: FALLBACK_REPLIES.reminderLevel1,
      2: FALLBACK_REPLIES.reminderLevel2,
      3: FALLBACK_REPLIES.reminderLevel3,
    }
    return fallbacks[level]
  }
  const { system, user } = buildReminderPrompt(level, goal)
  try {
    return await llm.chat(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      'generate',
    )
  } catch {
    const fallbacks: Record<ReminderLevel, string> = {
      1: FALLBACK_REPLIES.reminderLevel1,
      2: FALLBACK_REPLIES.reminderLevel2,
      3: FALLBACK_REPLIES.reminderLevel3,
    }
    return fallbacks[level]
  }
}

export async function executeReminder(
  llm: LLMClient,
  level: ReminderLevel,
  goal: Goal,
): Promise<{ message: string; notified: boolean }> {
  const message = await generateReminderMessage(llm, level, goal)
  if (level === 3) {
    await showNotification('该回来了！', message)
    return { message, notified: true }
  }
  return { message, notified: false }
}

export function handleSokai(state: ReminderState, minutes: number, now: number = Date.now()): ReminderState {
  return {
    ...state,
    sokaiPausedUntil: now + minutes * 60 * 1000,
    sokaiCount: state.sokaiCount + 1,
  }
}

export function resetSlack(state: ReminderState): ReminderState {
  return {
    ...state,
    slackStartedAt: null,
    currentLevel: 0,
    sokaiPausedUntil: null,
  }
}

export function markSlackStart(state: ReminderState, now: number = Date.now()): ReminderState {
  if (state.slackStartedAt !== null) return state
  return { ...state, slackStartedAt: now }
}

export function updateLevel(state: ReminderState, level: ReminderLevel): ReminderState {
  return { ...state, currentLevel: level }
}
