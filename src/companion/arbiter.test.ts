import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  getAppProfiles: vi.fn(),
  upsertAppProfile: vi.fn(),
  getLlmCache: vi.fn(),
  saveLlmCache: vi.fn(),
}))

import { arbitrate, generateCompanionMessage, computeNewCooldown } from './arbiter'
import { LLMClient } from '../llm/client'
import type { CompanionConfig, LLMConfig } from '../types'

const config: CompanionConfig = {
  enabled: true,
  frequency: 'normal',
  cooldownMinutes: 15,
  triggerProbability: 1,
  fallbackIntervalMinutes: 45,
}
const llmConfig: LLMConfig = {
  judgeModel: 'm', judgeApiKey: 'k', judgeApiBase: 'https://a.com/v1',
  generateModel: 'm', generateApiKey: 'k', generateApiBase: 'https://a.com/v1',
  summaryModel: 'm', summaryApiKey: 'k', summaryApiBase: 'https://a.com/v1',
}

describe('arbiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('非陪伴模式不说话', () => {
    const decision = arbitrate(
      { type: 'idle_started', idleMinutes: 5 },
      { mode: 'study', lastSpokeAt: 0, cooldownUntil: 0, config, isIdle: false },
    )
    expect(decision.shouldSpeak).toBe(false)
  })

  it('冷却中不说话', () => {
    const decision = arbitrate(
      { type: 'idle_started', idleMinutes: 5 },
      { mode: 'companion', lastSpokeAt: 0, cooldownUntil: Date.now() + 60000, config, isIdle: false },
    )
    expect(decision.shouldSpeak).toBe(false)
  })

  it('陪伴模式 + 概率通过 → 说话', () => {
    const decision = arbitrate(
      { type: 'idle_started', idleMinutes: 5 },
      { mode: 'companion', lastSpokeAt: 0, cooldownUntil: 0, config, isIdle: true, idleMinutes: 5 },
    )
    expect(decision.shouldSpeak).toBe(true)
  })

  it('disabled 时不说话', () => {
    const decision = arbitrate(
      { type: 'idle_started', idleMinutes: 5 },
      { mode: 'companion', lastSpokeAt: 0, cooldownUntil: 0, config: { ...config, enabled: false }, isIdle: false },
    )
    expect(decision.shouldSpeak).toBe(false)
  })

  it('computeNewCooldown 正确计算', () => {
    const before = Date.now()
    const cd = computeNewCooldown(config)
    expect(cd).toBeGreaterThanOrEqual(before + 14 * 60000)
    expect(cd).toBeLessThanOrEqual(before + 16 * 60000)
  })

  it('LLM 未配置用兜底话术', async () => {
    const llm = new LLMClient({ ...llmConfig, generateModel: '', generateApiKey: '' })
    const msg = await generateCompanionMessage(llm, { system: 's', user: 'u' })
    expect(msg).toBeTruthy()
  })
})
