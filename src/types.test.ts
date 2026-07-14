import { describe, it, expect } from 'vitest'
import type { Mode, Goal, LogEvent, AppProfile } from './types'

describe('types', () => {
  it('Mode 类型可用', () => {
    const m: Mode = 'focus'
    expect(m).toBe('focus')
  })

  it('Goal 类型可用', () => {
    const g: Goal = {
      id: 'g1', topic: 'React',
      startedAt: Date.now(), status: 'active',
    }
    expect(g.topic).toBe('React')
  })

  it('LogEvent 类型可用', () => {
    const e: LogEvent = {
      ts: Date.now(), type: 'window_switch', mode: 'focus',
      processName: 'Code.exe', windowTitle: 'main.ts',
    }
    expect(e.type).toBe('window_switch')
  })

  it('AppProfile 类型可用', () => {
    const p: AppProfile = { processName: 'Code.exe', list: 'whitelist', goalTopic: 'React' }
    expect(p.list).toBe('whitelist')
  })
})
