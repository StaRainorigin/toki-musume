import type { Goal } from '../types'
import type { WindowRecord } from '../perception/window-history'

/**
 * 构建 LLM 窗口历史检查的 prompt
 * 学习模式更严格，工作模式更宽松
 */
export function buildWindowHistoryJudgePrompt(
  goal: Goal,
  records: WindowRecord[],
): { system: string; user: string } {
  const isStudy = goal.mode === 'study'
  const strictness = isStudy
    ? `严格标准：只有以下应用算学习——IDE/编辑器、文档工具、网课平台、技术文档网站、终端。浏览器只有在标题明确包含学习关键词时才算学习（如教程、文档、leetcode）。通讯软件、社交媒体、视频网站一律算摸鱼。`
    : `宽松标准：以下应用算工作——IDE/编辑器、文档工具、浏览器（查资料/看文档）、邮件、通讯软件（工作沟通）、终端。只有视频网站（B站/YouTube娱乐内容）、游戏、社交媒体（微博/小红书）才算摸鱼。`

  const system = `你是一个桌面活动监督助手。用户正在${isStudy ? '学习' : '工作'}：${goal.topic}。
判断标准：${strictness}

你将看到用户最近的窗口切换历史（进程名、窗口标题、停留秒数）。
请分析这段时间用户是在学习/工作还是在摸鱼。

返回 JSON：
{
  "isSlacking": true/false,
  "slackRatio": 0.0-1.0,  // 摸鱼时间占比
  "reason": "简短理由（一句话）",
  "details": "详细分析（可选）"
}

只返回 JSON，不要加其他内容。`

  const recordsText = records.map((r, i) => {
    const sec = Math.round(r.durationMs / 1000)
    return `${i + 1}. [${sec}秒] ${r.processName} — ${r.windowTitle}`
  }).join('\n')

  const user = `目标：${isStudy ? '学习' : '工作'} ${goal.topic}\n\n窗口历史：\n${recordsText}`

  return { system, user }
}

/**
 * LLM 返回的检查结果
 */
export type WindowJudgeResult = {
  isSlacking: boolean
  slackRatio: number
  reason: string
  details?: string
}
