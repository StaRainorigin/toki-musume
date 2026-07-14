import type { Goal, Mode, ReminderLevel, ForegroundWindow, PersonaConfig } from '../types'
import { DEFAULT_PERSONALITY_PROMPT } from '../config'

export function buildSystemPrompt(persona: PersonaConfig, _mode: Mode, goal: Goal | null): string {
  const parts: string[] = [
    DEFAULT_PERSONALITY_PROMPT,
    `你的名字是「${persona.characterName}」，这个软件叫「${persona.appName}」。`,
  ]
  if (goal) {
    parts.push(`用户当前正在专注：${goal.topic}。`)
    if (goal.plannedMinutes) {
      const elapsed = Math.floor((Date.now() - goal.startedAt) / 60000)
      parts.push(`计划 ${goal.plannedMinutes} 分钟，已进行 ${elapsed} 分钟。`)
    }
    parts.push('如果用户在摸鱼（与目标无关），你应该调侃后提醒他回到正事。')
  } else {
    parts.push('用户当前没有在专注，处于休息/陪伴状态。自然闲聊即可，简短不啰嗦。')
  }
  return parts.join('\n')
}

export function buildSlackJudgePrompt(goal: Goal, win: ForegroundWindow): { system: string; user: string } {
  return {
    system: '你是一个应用分类助手。判断给定应用是否与用户的学习/工作目标相关。只返回 JSON。',
    user: JSON.stringify({
      instruction: '判断这个应用是否与目标相关，返回 {"related": true/false, "reason": "简短理由"}',
      goal: `专注：${goal.topic}`,
      processName: win.processName,
      windowTitle: win.windowTitle,
    }),
  }
}

export function buildReminderPrompt(level: ReminderLevel, goal: Goal): { system: string; user: string } {
  const toneMap: Record<ReminderLevel, string> = {
    1: '轻调侃，像朋友开玩笑，一句话',
    2: '正经提醒，认真但友好，一句话',
    3: '严肃但关心，强调该回来了，一到两句话',
  }
  return {
    system: `你是一个监督伙伴。用户在专注${goal.topic}时摸鱼了。当前是第${level}级提醒，语气：${toneMap[level]}。只输出要说的话，不要加引号或前缀。`,
    user: '生成提醒话术。',
  }
}

export function buildCompanionPrompt(context: {
  windowTitle?: string
  processName?: string
  isIdle: boolean
  idleMinutes?: number
}): { system: string; user: string } {
  let userMsg = ''
  if (context.isIdle) {
    userMsg = `用户已经空闲 ${context.idleMinutes} 分钟了，自然地说句话（比如关心或调侃）。`
  } else if (context.processName) {
    userMsg = `用户当前在用 ${context.processName}（标题：${context.windowTitle}），自然地说句话。`
  } else {
    userMsg = '自然地说一句闲聊的话。'
  }
  return {
    system: '你是用户的桌面陪伴。主动开口说一句简短自然的话，不要超过两句。不要用敬语。',
    user: userMsg,
  }
}

export function buildChatPrompt(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
): { system: string; user: string } {
  const system = `你是一个桌面陪伴角色。用户跟你说话，你要用亲切自然的语气回复。
同时分析用户的话是否包含以下意图之一：
- start_task: 用户想开始一个学习/工作任务，提取 mode(study/work)、topic(任务标题)、plannedMinutes(计划分钟数，可选)
- take_break: 用户想休息一下
- sokai_yila: 用户在赖账（如"再看5分钟"），提取 minutes
- end_goal: 用户说结束/学完了
- summary: 用户想看总结（daily/weekly）

返回 JSON：{"reply": "你的回复", "intent": {...} | null}
intent 格式示例：{"type":"start_task","mode":"study","topic":"React","plannedMinutes":120}
或 {"type":"take_break"}
或 {"type":"sokai_yila","minutes":5}
或 {"type":"end_goal"}
或 {"type":"summary","range":"daily"}
如果无意图，intent 为 null。`

  const historyText = history
    .slice(-8)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')
  const user = historyText ? `${historyText}\nuser: ${userMessage}` : userMessage

  return { system, user }
}

export function buildDailySummaryPrompt(
  date: string,
  aggregated: {
    appTimeDistribution: Record<string, number>
    slackCount: number
    sokaiCount: number
    sokaiTotalMinutes: number
    goals: Array<{ topic: string; mode: string; completed: boolean; minutes: number }>
  },
): { system: string; user: string } {
  return {
    system: '你是一个桌面活动总结助手。根据用户今天的活动数据，生成一段纯文字总结报告，最后加一句简短点评。报告包含：各应用使用时长、摸鱼次数（含赖账）、目标完成情况。',
    user: `日期：${date}\n活动数据：\n${JSON.stringify(aggregated, null, 2)}`,
  }
}
