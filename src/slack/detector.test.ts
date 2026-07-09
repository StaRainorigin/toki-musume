import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  getLlmCache: vi.fn(),
  saveLlmCache: vi.fn(),
  getAppProfiles: vi.fn(),
  upsertAppProfile: vi.fn(),
}))

import { AppProfileStore } from './app-profiles'
import { SlackDetector } from './detector'
import { LLMClient } from '../llm/client'
import type { Goal, LLMConfig } from '../types'

const goal: Goal = {
  id: 'g1', mode: 'study', topic: 'React', startedAt: Date.now(), status: 'active',
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
    const { getAppProfiles } = await import('../tauri-bridge')
    vi.mocked(getAppProfiles).mockResolvedValue([
      { processName: 'Code.exe', list: 'whitelist', goalTopic: 'React' },
    ])
    const store = new AppProfileStore()
    await store.load()
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
    const { getAppProfiles } = await import('../tauri-bridge')
    vi.mocked(getAppProfiles).mockResolvedValue([
      { processName: 'Bili.exe', list: 'blacklist', goalTopic: 'React' },
    ])
    const store = new AppProfileStore()
    await store.load()
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
    const { getAppProfiles, getLlmCache, saveLlmCache, upsertAppProfile } = await import('../tauri-bridge')
    vi.mocked(getAppProfiles).mockResolvedValue([])
    vi.mocked(getLlmCache).mockResolvedValue(null)
    vi.mocked(saveLlmCache).mockResolvedValue(undefined)
    vi.mocked(upsertAppProfile).mockResolvedValue(undefined)

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
    expect(saveLlmCache).toHaveBeenCalled()
  })

  it('LLM 未配置时返回 unknown 不误判', async () => {
    const { getAppProfiles, getLlmCache } = await import('../tauri-bridge')
    vi.mocked(getAppProfiles).mockResolvedValue([])
    vi.mocked(getLlmCache).mockResolvedValue(null)
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
