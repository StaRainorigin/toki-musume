import type { ForegroundWindow, Goal, SlackJudgeResult } from '../types'
import { AppProfileStore } from './app-profiles'
import { LLMClient } from '../llm/client'
import { buildSlackJudgePrompt } from '../llm/prompts'
import { DEFAULTS } from '../config'

export type SlackJudgeOutcome = 'working' | 'slacking' | 'unknown'

export type DetectionResult = {
  outcome: SlackJudgeOutcome
  processName: string
  windowTitle: string
  needsReminder: boolean
  reason?: string
}

export class SlackDetector {
  private lastJudgeAt: Map<string, number> = new Map()
  private judgeCache: Map<string, SlackJudgeResult> = new Map()

  constructor(
    private profiles: AppProfileStore,
    private llm: LLMClient,
  ) {}

  async detect(win: ForegroundWindow, goal: Goal): Promise<DetectionResult> {
    const listKind = this.profiles.lookup(win.processName, goal.topic)

    if (listKind === 'whitelist') {
      return { outcome: 'working', processName: win.processName, windowTitle: win.windowTitle, needsReminder: false, reason: '白名单' }
    }
    if (listKind === 'blacklist') {
      return { outcome: 'slacking', processName: win.processName, windowTitle: win.windowTitle, needsReminder: true, reason: '黑名单' }
    }

    const judgeResult = await this.llmFallbackJudge(win, goal)
    if (judgeResult === null) {
      return { outcome: 'unknown', processName: win.processName, windowTitle: win.windowTitle, needsReminder: false, reason: 'LLM 未配置或冷却中' }
    }

    const list: 'whitelist' | 'blacklist' = judgeResult.related ? 'whitelist' : 'blacklist'
    await this.profiles.addToList(win.processName, list, goal.topic, true)
    await this.profiles.markPendingSuggestion(win.processName, goal.topic)

    return {
      outcome: judgeResult.related ? 'working' : 'slacking',
      processName: win.processName,
      windowTitle: win.windowTitle,
      needsReminder: !judgeResult.related,
      reason: judgeResult.reason,
    }
  }

  private async llmFallbackJudge(win: ForegroundWindow, goal: Goal): Promise<SlackJudgeResult | null> {
    const cacheKey = `${win.processName}::${goal.topic}`
    const last = this.lastJudgeAt.get(cacheKey) ?? 0
    const cooldownMs = DEFAULTS.llmFallbackCooldownMin * 60 * 1000
    if (Date.now() - last < cooldownMs) {
      const cached = this.judgeCache.get(cacheKey)
      if (cached) return cached
      return null
    }

    if (!this.llm.isConfigured('judge')) {
      return null
    }

    const { system, user } = buildSlackJudgePrompt(goal, win)
    const result = await this.llm.judgeSlack(system, user)
    this.lastJudgeAt.set(cacheKey, Date.now())
    this.judgeCache.set(cacheKey, result)
    return result
  }
}
