import type { ForegroundWindow, Goal, SlackJudgeResult } from '../types'
import { AppProfileStore } from './app-profiles'
import { LLMClient } from '../llm/client'
import { buildSlackJudgePrompt } from '../llm/prompts'
import { getLlmCache, saveLlmCache } from '../tauri-bridge'
import { DEFAULTS } from '../config'

export type SlackJudgeOutcome = 'working' | 'slacking' | 'unknown'

export type DetectionResult = {
  outcome: SlackJudgeOutcome
  processName: string
  windowTitle: string
  needsReminder: boolean
}

export class SlackDetector {
  private lastJudgeAt: Map<string, number> = new Map()

  constructor(
    private profiles: AppProfileStore,
    private llm: LLMClient,
  ) {}

  async detect(win: ForegroundWindow, goal: Goal): Promise<DetectionResult> {
    const listKind = this.profiles.lookup(win.processName, goal.topic)

    if (listKind === 'whitelist') {
      return { outcome: 'working', processName: win.processName, windowTitle: win.windowTitle, needsReminder: false }
    }
    if (listKind === 'blacklist') {
      return { outcome: 'slacking', processName: win.processName, windowTitle: win.windowTitle, needsReminder: true }
    }

    const judgeResult = await this.llmFallbackJudge(win, goal)
    if (judgeResult === null) {
      return { outcome: 'unknown', processName: win.processName, windowTitle: win.windowTitle, needsReminder: false }
    }

    const list: 'whitelist' | 'blacklist' = judgeResult.related ? 'whitelist' : 'blacklist'
    await this.profiles.addToList(win.processName, list, goal.topic, true)
    await this.profiles.markPendingSuggestion(win.processName, goal.topic)

    return {
      outcome: judgeResult.related ? 'working' : 'slacking',
      processName: win.processName,
      windowTitle: win.windowTitle,
      needsReminder: !judgeResult.related,
    }
  }

  private async llmFallbackJudge(win: ForegroundWindow, goal: Goal): Promise<SlackJudgeResult | null> {
    const last = this.lastJudgeAt.get(win.processName) ?? 0
    const cooldownMs = DEFAULTS.llmFallbackCooldownMin * 60 * 1000
    if (Date.now() - last < cooldownMs) {
      const cached = await getLlmCache(win.processName, goal.topic)
      if (cached) return cached
      return null
    }

    if (!this.llm.isConfigured('judge')) {
      return null
    }

    const { system, user } = buildSlackJudgePrompt(goal, win)
    const result = await this.llm.judgeSlack(system, user)
    this.lastJudgeAt.set(win.processName, Date.now())
    await saveLlmCache(win.processName, goal.topic, result)
    return result
  }
}
