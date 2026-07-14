import type { Goal } from '../types'
import type { WindowRecord } from '../perception/window-history'

/**
 * 构建 LLM 窗口历史检查的 prompt
 */
export function buildWindowHistoryJudgePrompt(
  goal: Goal,
  records: WindowRecord[],
): { system: string; user: string } {
  const system = `你是一个桌面活动监督助手。用户正在专注做：${goal.topic}。
判断用户最近的窗口活动是否和这个任务相关。

判断标准：
- 和任务相关的应用（如 IDE、文档、浏览器查资料）不算摸鱼
- 明显无关的娱乐应用（如视频网站、游戏、社交媒体）算摸鱼
- 如果不确定，倾向于不算摸鱼（不误判）

你将看到用户最近的窗口切换历史（进程名、窗口标题、停留秒数）。
请分析这段时间用户是在专注还是在摸鱼。

返回 JSON：
{
  "isSlacking": true/false,
  "slackRatio": 0.0-1.0,
  "reason": "简短理由（一句话）",
  "details": "详细分析（可选）"
}

只返回 JSON，不要加其他内容。`

  const recordsText = records.map((r, i) => {
    const sec = Math.round(r.durationMs / 1000)
    return `${i + 1}. [${sec}秒] ${r.processName} — ${r.windowTitle}`
  }).join('\n')

  const user = `任务：${goal.topic}\n\n窗口历史：\n${recordsText}`

  return { system, user }
}

export type WindowJudgeResult = {
  isSlacking: boolean
  slackRatio: number
  reason: string
  details?: string
}
