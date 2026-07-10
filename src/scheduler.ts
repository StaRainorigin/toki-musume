import { DEFAULTS } from './config'
import { generateDailySummary } from './summary/daily'
import { generateWeeklySummary, getCurrentWeekStart } from './summary/weekly'
import type { LLMClient } from './llm/client'

export class SummaryScheduler {
  private checkIntervalId: number | null = null

  constructor(private llm: LLMClient) {}

  start(): void {
    this.checkIntervalId = window.setInterval(() => {
      this.checkTimes()
    }, 60 * 1000)
    this.checkTimes()
  }

  stop(): void {
    if (this.checkIntervalId !== null) {
      clearInterval(this.checkIntervalId)
      this.checkIntervalId = null
    }
  }

  private checkTimes(): void {
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = now.toISOString().slice(0, 10)

    if (hhmm === DEFAULTS.summaryTime) {
      this.generateDaily(today)
    }

    if (now.getDay() === DEFAULTS.weeklySummaryDay && hhmm === DEFAULTS.weeklySummaryTime) {
      this.generateWeekly()
    }
  }

  private async generateDaily(date: string): Promise<void> {
    try {
      const summary = await generateDailySummary(this.llm, date)
      console.log(`每日总结已生成: ${date}`, summary.comment)
    } catch (e) {
      console.error('每日总结生成失败', e)
    }
  }

  private async generateWeekly(): Promise<void> {
    try {
      const weekStart = getCurrentWeekStart()
      const summary = await generateWeeklySummary(this.llm, weekStart)
      console.log(`每周总结已生成: ${weekStart}`, summary.comment)
    } catch (e) {
      console.error('每周总结生成失败', e)
    }
  }
}
