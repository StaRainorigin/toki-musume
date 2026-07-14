import { describe, it, expect } from 'vitest'
import { aggregateDay, getWeekStart } from './log-aggregator'
import type { LogEvent } from '../types'

describe('log-aggregator', () => {
  it('统计摸鱼次数', () => {
    const events: LogEvent[] = [
      { ts: 1000, type: 'slack_detected', mode: 'focus' },
      { ts: 2000, type: 'slack_detected', mode: 'focus' },
    ]
    const result = aggregateDay(events, '2026-07-09')
    expect(result.slackCount).toBe(2)
  })

  it('统计赖账次数和时长', () => {
    const events: LogEvent[] = [
      { ts: 1000, type: 'sokai_yila', mode: 'focus', data: { minutes: 5 } },
      { ts: 2000, type: 'sokai_yila', mode: 'focus', data: { minutes: 3 } },
    ]
    const result = aggregateDay(events, '2026-07-09')
    expect(result.sokaiCount).toBe(2)
    expect(result.sokaiTotalMinutes).toBe(8)
  })

  it('统计目标', () => {
    const events: LogEvent[] = [
      { ts: 1000, type: 'goal_started', mode: 'focus', data: { goal: { id: 'g1', topic: 'React', mode: 'focus' } } },
      { ts: 61000, type: 'goal_ended', mode: 'focus', data: { goal: { id: 'g1' } } },
    ]
    const result = aggregateDay(events, '2026-07-09')
    expect(result.goals).toHaveLength(1)
    expect(result.goals[0].topic).toBe('React')
    expect(result.goals[0].completed).toBe(true)
    expect(result.goals[0].minutes).toBe(1)
  })

  it('统计应用时长', () => {
    const events: LogEvent[] = [
      { ts: 1000, type: 'window_switch', mode: 'focus', processName: 'Code.exe' },
      { ts: 61000, type: 'window_switch', mode: 'focus', processName: 'Bili.exe' },
      { ts: 121000, type: 'window_switch', mode: 'focus', processName: 'Code.exe' },
    ]
    const result = aggregateDay(events, '2026-07-09')
    expect(result.appTimeDistribution['Code.exe']).toBeGreaterThanOrEqual(1)
    expect(result.appTimeDistribution['Bili.exe']).toBe(1)
  })

  it('getWeekStart 返回周日日期', () => {
    const weekStart = getWeekStart(new Date('2026-07-09T12:00:00'))
    expect(weekStart).toBe('2026-07-05')
  })
})
