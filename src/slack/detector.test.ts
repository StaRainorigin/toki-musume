import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  getForegroundWindow: vi.fn(),
  getIdleMs: vi.fn(),
  initDatabase: vi.fn().mockResolvedValue(''),
  getRuntimeState: vi.fn().mockResolvedValue({
    mode: 'idle', activeGoalId: undefined,
    companionCooldownUntil: 0, lastSpokeAt: undefined,
  }),
  getActiveGoal: vi.fn().mockResolvedValue(null),
  getAppProfiles: vi.fn().mockResolvedValue([]),
  upsertAppProfile: vi.fn().mockResolvedValue(undefined),
  getLlmCache: vi.fn().mockResolvedValue(null),
  saveLlmCache: vi.fn().mockResolvedValue(undefined),
  appendLog: vi.fn().mockResolvedValue(undefined),
  saveRuntimeState: vi.fn().mockResolvedValue(undefined),
  saveGoal: vi.fn().mockResolvedValue(undefined),
  saveDailySummary: vi.fn().mockResolvedValue(undefined),
  getDailySummary: vi.fn().mockResolvedValue(null),
  listDailySummaries: vi.fn().mockResolvedValue([]),
  saveWeeklySummary: vi.fn().mockResolvedValue(undefined),
  showNotification: vi.fn().mockResolvedValue(undefined),
  readConfigFile: vi.fn().mockResolvedValue('{}'),
  writeConfigFile: vi.fn().mockResolvedValue(undefined),
  openConfigDir: vi.fn().mockResolvedValue(''),
  readLogs: vi.fn().mockResolvedValue([]),
}))

import { AppProfileStore } from './app-profiles'
import { SlackDetector } from './detector'
import { LLMClient } from '../llm/client'
import type { Goal, LLMConfig } from '../types'

const goal: Goal = {
  id: 'g1', topic: 'React', startedAt: Date.now(), status: 'active',
}
const config: LLMConfig = {
  judgeModel: 'm', judgeApiKey: 'k', judgeApiBase: 'https://a.com/v1',
  generateModel: 'm', generateApiKey: 'k', generateApiBase: 'https://a.com/v1',
  summaryModel: 'm', summaryApiKey: 'k', summaryApiBase: 'https://a.com/v1',
}

describe('SlackDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('白名单应用判为 working', async () => {
    const store = new AppProfileStore()
    await store.load()
    await store.addToList('Code.exe', 'whitelist', 'React')
    const llm = new LLMClient(config)
    const detector = new SlackDetector(store, llm)
    const result = await detector.detect(
      { processName: 'Code.exe', windowTitle: 'main.ts', pid: 1 },
      goal,
    )
    expect(result.outcome).toBe('working')
    expect(result.needsReminder).toBe(false)
  })

  it('黑名单应用判为 slacking', async () => {
    const store = new AppProfileStore()
    await store.load()
    await store.addToList('Bili.exe', 'blacklist', 'React')
    const llm = new LLMClient(config)
    const detector = new SlackDetector(store, llm)
    const result = await detector.detect(
      { processName: 'Bili.exe', windowTitle: 'B站', pid: 2 },
      goal,
    )
    expect(result.outcome).toBe('slacking')
    expect(result.needsReminder).toBe(true)
  })

  it('unknown 应用走 LLM fallback', async () => {
    const store = new AppProfileStore()
    await store.load()
    const llm = new LLMClient(config)
    vi.spyOn(llm, 'judgeSlack').mockResolvedValue({ related: false, reason: '视频网站' })
    const detector = new SlackDetector(store, llm)
    const result = await detector.detect(
      { processName: 'Unknown.exe', windowTitle: '某视频', pid: 3 },
      goal,
    )
    expect(result.outcome).toBe('slacking')
    expect(result.needsReminder).toBe(true)
    expect(result.reason).toBe('视频网站')
  })

  it('LLM 未配置时返回 unknown 不误判', async () => {
    const store = new AppProfileStore()
    await store.load()
    const llm = new LLMClient({ ...config, judgeModel: '', judgeApiKey: '' })
    const detector = new SlackDetector(store, llm)
    const result = await detector.detect(
      { processName: 'Unknown.exe', windowTitle: 'x', pid: 4 },
      goal,
    )
    expect(result.outcome).toBe('unknown')
    expect(result.needsReminder).toBe(false)
  })
})
