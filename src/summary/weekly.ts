import type { LLMClient } from '../llm/client'
import { saveWeeklySummary } from '../tauri-bridge'
import { getWeekStart } from '../storage/log-aggregator'
import { generateDailySummary, loadDailySummary } from './daily'
import type { WeeklySummary, DailySummary } from '../types'

export async function generateWeeklySummary(
  llm: LLMClient,
  weekStartDate: string,
): Promise<WeeklySummary> {
  const start = new Date(weekStartDate)
  const dailySummaries: DailySummary[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    let summary = await loadDailySummary(dateStr)
    if (!summary) {
      summary = await generateDailySummary(llm, dateStr)
    }
    dailySummaries.push(summary)
  }

  const totalSlack = dailySummaries.reduce((sum, d) => sum + d.slackCount, 0)
  const totalSokai = dailySummaries.reduce((sum, d) => sum + d.sokaiCount, 0)
  const completedGoals = dailySummaries.reduce((sum, d) => sum + d.goals.filter((g) => g.completed).length, 0)

  let comment = `本周摸鱼 ${totalSlack} 次，赖账 ${totalSokai} 次，完成目标 ${completedGoals} 个。`
  if (llm.isConfigured('summary')) {
    try {
      comment = await llm.chat(
        [{
          role: 'system',
          content: '你是一个周报总结助手。根据本周每日数据生成一段简短周报点评。',
        }, {
          role: 'user',
          content: JSON.stringify({ totalSlack, totalSokai, completedGoals, dailySummaries: dailySummaries.map((d) => ({ date: d.date, slackCount: d.slackCount, goals: d.goals })) }),
        }],
        'summary',
      )
    } catch {
      // 保留默认 comment
    }
  }

  const summary: WeeklySummary = {
    weekStart: weekStartDate,
    dailySummaries,
    comment,
    generatedAt: Date.now(),
  }

  await saveWeeklySummary(weekStartDate, JSON.stringify(summary))
  return summary
}

export function getCurrentWeekStart(): string {
  return getWeekStart(new Date())
}
