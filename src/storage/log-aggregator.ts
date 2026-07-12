import type { LogEvent } from '../types'

export type AggregatedDay = {
  date: string
  appTimeDistribution: Record<string, number>
  slackCount: number
  sokaiCount: number
  sokaiTotalMinutes: number
  goals: Array<{ topic: string; mode: string; completed: boolean; minutes: number }>
}

export function aggregateDay(events: LogEvent[], date: string): AggregatedDay {
  const appTime: Record<string, number> = {}
  let slackCount = 0
  let sokaiCount = 0
  let sokaiTotalMinutes = 0
  const goalMap = new Map<string, { topic: string; mode: string; startedAt: number; endedAt?: number; completed: boolean }>()

  const sorted = [...events].sort((a, b) => a.ts - b.ts)

  for (const evt of sorted) {
    switch (evt.type) {
      case 'slack_detected':
        slackCount++
        break
      case 'sokai_yila':
        sokaiCount++
        if (evt.data?.minutes) {
          sokaiTotalMinutes += evt.data.minutes as number
        }
        break
      case 'goal_started':
        if (evt.data?.goal) {
          const g = evt.data.goal as { id: string; topic: string; mode: string }
          goalMap.set(g.id, { topic: g.topic, mode: g.mode, startedAt: evt.ts, completed: false })
        }
        break
      case 'goal_ended':
        if (evt.data?.goal) {
          const g = evt.data.goal as { id: string }
          const existing = goalMap.get(g.id)
          if (existing) {
            existing.endedAt = evt.ts
            existing.completed = true
          }
        }
        break
    }
  }

  const windowEvents = sorted.filter((e) => e.type === 'window_switch')
  for (let i = 0; i < windowEvents.length; i++) {
    const curr = windowEvents[i]
    const next = windowEvents[i + 1]
    const endTime = next ? next.ts : curr.ts + 60000
    const minutes = Math.max(1, Math.round((endTime - curr.ts) / 60000))
    if (curr.processName) {
      appTime[curr.processName] = (appTime[curr.processName] ?? 0) + minutes
    }
  }

  const goals = Array.from(goalMap.values()).map((g) => ({
    topic: g.topic,
    mode: g.mode,
    completed: g.completed,
    minutes: g.endedAt ? Math.round((g.endedAt - g.startedAt) / 60000) : Math.round((Date.now() - g.startedAt) / 60000),
  }))

  return {
    date,
    appTimeDistribution: appTime,
    slackCount,
    sokaiCount,
    sokaiTotalMinutes,
    goals,
  }
}

export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}
