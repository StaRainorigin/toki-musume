import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  getAppProfiles: vi.fn(),
  upsertAppProfile: vi.fn(),
}))

import { getAppProfiles, upsertAppProfile } from '../tauri-bridge'
import { AppProfileStore } from './app-profiles'

describe('AppProfileStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lookup 未命中返回 unknown', async () => {
    vi.mocked(getAppProfiles).mockResolvedValue([])
    const store = new AppProfileStore()
    await store.load()
    expect(store.lookup('Unknown.exe', 'React')).toBe('unknown')
  })

  it('目标专属名单优先于全局', async () => {
    vi.mocked(getAppProfiles).mockResolvedValue([
      { processName: 'Code.exe', list: 'whitelist', goalTopic: 'React' },
      { processName: 'Code.exe', list: 'blacklist', goalTopic: undefined },
    ])
    const store = new AppProfileStore()
    await store.load()
    expect(store.lookup('Code.exe', 'React')).toBe('whitelist')
    expect(store.lookup('Code.exe')).toBe('blacklist')
  })

  it('addToList 更新缓存和持久层', async () => {
    vi.mocked(getAppProfiles).mockResolvedValue([])
    vi.mocked(upsertAppProfile).mockResolvedValue(undefined)
    const store = new AppProfileStore()
    await store.load()
    await store.addToList('Bilibili.exe', 'blacklist', 'React')
    expect(store.lookup('Bilibili.exe', 'React')).toBe('blacklist')
    expect(upsertAppProfile).toHaveBeenCalled()
  })

  it('待确认候选可查询', async () => {
    vi.mocked(getAppProfiles).mockResolvedValue([])
    vi.mocked(upsertAppProfile).mockResolvedValue(undefined)
    const store = new AppProfileStore()
    await store.load()
    await store.addToList('NewApp.exe', 'whitelist', 'React')
    await store.markPendingSuggestion('NewApp.exe', 'React')
    const pending = store.getPendingSuggestions('React')
    expect(pending).toHaveLength(1)
    expect(pending[0].processName).toBe('NewApp.exe')
  })
})
