import type { LLMClient } from '../llm/client'
import { buildDailySummaryPrompt } from '../llm/prompts'
import { readLogs, saveDailySummary, getDailySummary } from '../tauri-bridge'
import { aggregateDay } from '../storage/log-aggregator'
import type { DailySummary } from '../types'

export async function generateDailySummary(
  llm: LLMClient,
  date: string,
): Promise<DailySummary> {
  const events = await readLogs(date, date)
  const aggregated = aggregateDay(events, date)

  let comment = '（无活动数据）'
  if (llm.isConfigured('summary') && events.length > 0) {
    const { system, user } = buildDailySummaryPrompt(date, aggregated)
    try {
      comment = await llm.chat(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        'summary',
      )
    } catch {
      comment = '总结生成失败'
    }
  } else if (events.length > 0) {
    comment = `今天用了 ${Object.keys(aggregated.appTimeDistribution).length} 个应用，摸鱼 ${aggregated.slackCount} 次。`
  }

  const summary: DailySummary = {
    date,
    appTimeDistribution: aggregated.appTimeDistribution,
    slackCount: aggregated.slackCount,
    slackDetails: aggregated.slackDetails,
    sokaiCount: aggregated.sokaiCount,
    sokaiTotalMinutes: aggregated.sokaiTotalMinutes,
    goals: aggregated.goals as DailySummary['goals'],
    comment,
    generatedAt: Date.now(),
  }

  await saveDailySummary(date, JSON.stringify(summary))
  return summary
}

export async function loadDailySummary(date: string): Promise<DailySummary | null> {
  const data = await getDailySummary(date)
  if (!data) return null
  return JSON.parse(data) as DailySummary
}
