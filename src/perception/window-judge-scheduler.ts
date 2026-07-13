import type { LLMClient } from '../llm/client'
import type { Goal } from '../types'
import type { WindowHistoryTracker, WindowRecord } from './window-history'
import { buildWindowHistoryJudgePrompt, type WindowJudgeResult } from '../llm/window-history-prompt'

/**
 * 定期 LLM 窗口历史检查器
 * - 窗口切换后 30 秒做首次检查（快速反应）
 * - 之后每 10 分钟检查一次
 */
export class WindowJudgeScheduler {
  private firstCheckTimerId: number | null = null
  private periodicCheckTimerId: number | null = null
  private lastCheckAt = 0
  private lastResult: WindowJudgeResult | null = null

  constructor(
    private history: WindowHistoryTracker,
    private llm: LLMClient,
    private onJudge: (result: WindowJudgeResult, records: WindowRecord[]) => void,
  ) {}

  /** 窗口切换时调用，启动首次检查倒计时 */
  onWindowSwitch(goal: Goal | null): void {
    if (!goal) return
    if (this.llm.isConfigured('generate') === false) return

    // 取消之前的首次检查定时器
    if (this.firstCheckTimerId !== null) {
      clearTimeout(this.firstCheckTimerId)
      this.firstCheckTimerId = null
    }

    // 30 秒后做首次检查
    this.firstCheckTimerId = window.setTimeout(() => {
      this.firstCheckTimerId = null
      this.check(goal)
    }, 30 * 1000)
  }

  /** 启动周期性检查（每 10 分钟） */
  startPeriodic(goal: Goal | null): void {
    this.stopPeriodic()
    if (!goal) return
    this.periodicCheckTimerId = window.setInterval(() => {
      this.check(goal)
    }, 10 * 60 * 1000)
  }

  /** 停止周期性检查 */
  stopPeriodic(): void {
    if (this.periodicCheckTimerId !== null) {
      clearInterval(this.periodicCheckTimerId)
      this.periodicCheckTimerId = null
    }
    if (this.firstCheckTimerId !== null) {
      clearTimeout(this.firstCheckTimerId)
      this.firstCheckTimerId = null
    }
  }

  /** 手动触发检查（调试用） */
  async checkNow(goal: Goal): Promise<WindowJudgeResult | null> {
    return this.check(goal)
  }

  /** 获取上次检查结果 */
  getLastResult(): WindowJudgeResult | null {
    return this.lastResult
  }

  /** 获取上次检查时间 */
  getLastCheckAt(): number {
    return this.lastCheckAt
  }

  private async check(goal: Goal): Promise<WindowJudgeResult | null> {
    if (!this.llm.isConfigured('generate')) return null

    // 获取自上次检查以来的新记录，如果没有则取最近 10 分钟
    const records = this.lastCheckAt > 0
      ? this.history.getRecordsSince(this.lastCheckAt)
      : this.history.getRecentRecords(10)

    if (records.length === 0) return null

    const { system, user } = buildWindowHistoryJudgePrompt(goal, records)

    try {
      const raw = await this.llm.chat(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        'generate',
      )
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const parsed = JSON.parse(cleaned) as WindowJudgeResult
      this.lastResult = parsed
      this.lastCheckAt = Date.now()
      this.onJudge(parsed, records)
      return parsed
    } catch (e) {
      console.error('[WindowJudge] LLM check failed', e)
      return null
    }
  }
}
