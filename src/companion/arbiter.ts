import type { CompanionConfig, Mode, ForegroundWindow } from '../types'
import type { CompanionEvent } from './triggers'
import { LLMClient, FALLBACK_REPLIES } from '../llm/client'
import { buildCompanionPrompt } from '../llm/prompts'

export type ArbiterContext = {
  mode: Mode
  lastSpokeAt: number
  cooldownUntil: number
  config: CompanionConfig
  currentWindow?: ForegroundWindow
  isIdle: boolean
  idleMinutes?: number
}

export type ArbiterDecision =
  | { shouldSpeak: true; prompt: { system: string; user: string } }
  | { shouldSpeak: false; reason: string }

export function arbitrate(event: CompanionEvent, ctx: ArbiterContext): ArbiterDecision {
  // 只在休息/陪伴状态触发主动说话，专注时不打扰
  if (ctx.mode !== 'rest') {
    return { shouldSpeak: false, reason: '专注中不打扰' }
  }
  if (!ctx.config.enabled) {
    return { shouldSpeak: false, reason: '陪伴说话已关闭' }
  }
  const now = Date.now()
  if (now < ctx.cooldownUntil) {
    return { shouldSpeak: false, reason: '冷却中' }
  }
  const probability = event.type === 'fallback_timer' ? ctx.config.triggerProbability * 0.5 : ctx.config.triggerProbability
  if (Math.random() > probability) {
    return { shouldSpeak: false, reason: '概率未通过' }
  }
  const prompt = buildCompanionPrompt({
    windowTitle: ctx.currentWindow?.windowTitle,
    processName: ctx.currentWindow?.processName,
    isIdle: ctx.isIdle,
    idleMinutes: ctx.idleMinutes,
  })
  return { shouldSpeak: true, prompt }
}

export async function generateCompanionMessage(
  llm: LLMClient,
  prompt: { system: string; user: string },
): Promise<string> {
  if (!llm.isConfigured('generate')) {
    return FALLBACK_REPLIES.companionGeneric
  }
  try {
    return await llm.chat(
      [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      'generate',
    )
  } catch {
    return FALLBACK_REPLIES.companionGeneric
  }
}

export function computeNewCooldown(config: CompanionConfig): number {
  return Date.now() + config.cooldownMinutes * 60 * 1000
}
