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
  it('初始状态是 idle', () => {
    expect(createInitialState().mode).toBe('idle')
  })

  it('开始学习目标进入 study 模式', () => {
    const s = createInitialState()
    const r = startGoal(s, 'study', 'React', 120)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('study')
      expect(r.state.activeGoal?.topic).toBe('React')
      expect(r.state.activeGoal?.plannedMinutes).toBe(120)
    }
  })

  it('结束目标回到 idle', () => {
    const r1 = startGoal(createInitialState(), 'work', '论文')
    if (!r1.ok) throw new Error('should succeed')
    const r = endGoal(r1.state)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('idle')
      expect(r.state.activeGoal).toBeNull()
    }
  })

  it('休息中不能开始目标', () => {
    const r1 = startRest(createInitialState(), 15)
    if (!r1.ok) throw new Error('should succeed')
    const r = startGoal(r1.state, 'study', 'React')
    expect(r.ok).toBe(false)
  })

  it('休息到时间自动结束', () => {
    const before = Date.now()
    const r1 = startRest(createInitialState(), 1)
    if (!r1.ok) throw new Error('should succeed')
    const r = checkRestTimeout(r1.state, before + 61 * 1000)
    expect(r).not.toBeNull()
    if (r && r.ok) {
      expect(r.state.mode).toBe('idle')
    }
  })

  it('有活跃目标时进入陪伴会自动结束目标', () => {
    const r1 = startGoal(createInitialState(), 'study', 'React')
    if (!r1.ok) throw new Error('should succeed')
    const r = enterCompanion(r1.state)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('companion')
      expect(r.state.activeGoal).toBeNull()
    }
  })

  it('无目标可进入陪伴', () => {
    const s = createInitialState()
    const r = enterCompanion(s)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('companion')
    }
  })
})
