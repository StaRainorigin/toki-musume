import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildSlackJudgePrompt, buildReminderPrompt, buildCompanionPrompt } from './prompts'
import type { PersonaConfig, Goal } from '../types'

const persona: PersonaConfig = { characterName: '小时', appName: 'toki-musume' }
const goal: Goal = {
  id: 'g1', mode: 'study', topic: 'React', plannedMinutes: 120,
  startedAt: Date.now() - 40 * 60000, status: 'active',
}

describe('prompts', () => {
  it('system prompt 含角色名', () => {
    const p = buildSystemPrompt(persona, 'focus', goal)
    expect(p).toContain('小时')
    expect(p).toContain('toki-musume')
    expect(p).toContain('React')
  })

  it('slack judge prompt 要求 JSON 返回', () => {
    const p = buildSlackJudgePrompt(goal, { processName: 'Bili.exe', windowTitle: 'B站', pid: 1 })
    expect(p.system).toContain('JSON')
    expect(p.user).toContain('Bili.exe')
    expect(p.user).toContain('React')
  })

  it('reminder prompt 含等级和语气', () => {
    const p1 = buildReminderPrompt(1, goal)
    expect(p1.system).toContain('第1级')
    expect(p1.system).toContain('调侃')
    const p3 = buildReminderPrompt(3, goal)
    expect(p3.system).toContain('第3级')
    expect(p3.system).toContain('严肃')
  })

  it('companion prompt 空闲场景', () => {
    const p = buildCompanionPrompt({ isIdle: true, idleMinutes: 6 })
    expect(p.user).toContain('空闲')
    expect(p.user).toContain('6')
  })
})
