import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  startGoal,
  endGoal,
  startRest,
  enterCompanion,
  checkRestTimeout,
} from './mode-machine'

describe('mode-machine', () => {
  it('初始状态是 rest', () => {
    expect(createInitialState().mode).toBe('rest')
  })

  it('开始学习目标进入 focus 模式', () => {
    const s = createInitialState()
    const r = startGoal(s, 'study', 'React', 120)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('focus')
      expect(r.state.activeGoal?.topic).toBe('React')
      expect(r.state.activeGoal?.plannedMinutes).toBe(120)
    }
  })

  it('结束目标回到 rest', () => {
    const r1 = startGoal(createInitialState(), 'work', '论文')
    if (!r1.ok) throw new Error('should succeed')
    const r = endGoal(r1.state)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('rest')
      expect(r.state.activeGoal).toBeNull()
    }
  })

  it('休息中可以开始目标（不再阻止）', () => {
    const r1 = startRest(createInitialState(), 15)
    if (!r1.ok) throw new Error('should succeed')
    const r = startGoal(r1.state, 'study', 'React')
    expect(r.ok).toBe(true)
  })

  it('休息到时间自动结束', () => {
    const before = Date.now()
    const r1 = startRest(createInitialState(), 1)
    if (!r1.ok) throw new Error('should succeed')
    const r = checkRestTimeout(r1.state, before + 61 * 1000)
    expect(r).not.toBeNull()
    if (r && r.ok) {
      expect(r.state.mode).toBe('rest')
    }
  })

  it('有活跃目标时进入休息会自动结束目标', () => {
    const r1 = startGoal(createInitialState(), 'study', 'React')
    if (!r1.ok) throw new Error('should succeed')
    const r = enterCompanion(r1.state)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('rest')
      expect(r.state.activeGoal).toBeNull()
    }
  })

  it('无目标可进入休息', () => {
    const s = createInitialState()
    const r = enterCompanion(s)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('rest')
    }
  })
})
