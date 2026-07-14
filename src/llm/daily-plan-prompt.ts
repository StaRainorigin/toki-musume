import type { TaskSuggestion } from '../types'

/**
 * 构建 AI 今日计划建议的 prompt
 */
export function buildDailyPlanPrompt(yesterdaySummary?: string): { system: string; user: string } {
  const system = `你是一个桌面陪伴助手，帮用户规划今天的学习/工作计划。
根据用户昨天的活动总结（如果有），建议 3-5 个今天的任务。

任务类型：
- timed: 计时任务（用番茄钟计时完成，如"学习 React 2小时"）
- target: 目标任务（做到完成为止，如"完成作业3"）

返回 JSON 数组，每个元素：
{
  "title": "任务标题",
  "type": "timed" | "target",
  "plannedMinutes": 60,
  "description": "目标描述"
}

只返回 JSON 数组，不要加其他内容。`

  const user = yesterdaySummary
    ? `昨天活动总结：${yesterdaySummary}\n\n请建议今天的任务计划。`
    : '请建议今天的任务计划。考虑到用户可能需要学习和工作兼顾。'

  return { system, user }
}

/**
 * 解析 LLM 返回的任务建议
 */
export function parseTaskSuggestions(raw: string): TaskSuggestion[] {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as TaskSuggestion[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((t) => t.title && t.type)
  } catch {
    return []
  }
}
