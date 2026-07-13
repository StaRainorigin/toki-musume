import { describe, it, expect, beforeEach } from 'vitest'
import { AppProfileStore } from './app-profiles'

describe('AppProfileStore', () => {
  let store: AppProfileStore

  beforeEach(async () => {
    store = new AppProfileStore()
    await store.load()
  })

  it('lookup 未命中返回 unknown', () => {
    expect(store.lookup('Unknown.exe', 'React')).toBe('unknown')
  })

  it('目标专属名单优先于全局', async () => {
    await store.addToList('Code.exe', 'whitelist', 'React')
    await store.addToList('Code.exe', 'blacklist', undefined)
    expect(store.lookup('Code.exe', 'React')).toBe('whitelist')
    expect(store.lookup('Code.exe')).toBe('blacklist')
  })

  it('addToList 更新缓存', async () => {
    await store.addToList('Bilibili.exe', 'blacklist', 'React')
    expect(store.lookup('Bilibili.exe', 'React')).toBe('blacklist')
  })

  it('待确认候选可查询', async () => {
    await store.addToList('NewApp.exe', 'whitelist', 'React')
    await store.markPendingSuggestion('NewApp.exe', 'React')
    const pending = store.getPendingSuggestions('React')
    expect(pending).toHaveLength(1)
    expect(pending[0].processName).toBe('NewApp.exe')
  })
})
