import { describe, it, expect } from 'vitest'
import {
  DEFAULTS,
  FREQUENCY_MAP,
  resolveCompanionConfig,
  DEFAULT_COMPANION_CONFIG,
  DEFAULT_PERSONA,
} from './config'

describe('config', () => {
  it('默认轮询间隔 2 秒', () => {
    expect(DEFAULTS.pollIntervalSec).toBe(2)
  })

  it('分级阈值正确', () => {
    expect(DEFAULTS.slackLevel1Sec).toBe(30)
    expect(DEFAULTS.slackLevel2Min).toBe(3)
    expect(DEFAULTS.slackLevel3Min).toBe(10)
  })

  it('quiet 档冷却最长', () => {
    expect(FREQUENCY_MAP.quiet.cooldownMinutes).toBe(30)
    expect(FREQUENCY_MAP.chatty.cooldownMinutes).toBe(5)
  })

  it('resolveCompanionConfig 正确合并', () => {
    const cfg = resolveCompanionConfig(true, 'chatty')
    expect(cfg.cooldownMinutes).toBe(5)
    expect(cfg.triggerProbability).toBe(0.8)
  })

  it('resolveCompanionConfig 支持 override', () => {
    const cfg = resolveCompanionConfig(true, 'normal', { cooldownMinutes: 10 })
    expect(cfg.cooldownMinutes).toBe(10)
    expect(cfg.triggerProbability).toBe(0.5) // 未 override 的保持默认
  })

  it('默认陪伴配置是 normal 档', () => {
    expect(DEFAULT_COMPANION_CONFIG.frequency).toBe('normal')
  })

  it('默认角色名非空', () => {
    expect(DEFAULT_PERSONA.characterName.length).toBeGreaterThan(0)
  })
})
