import type { AppProfile, ListKind } from '../types'

type ProfileCache = Map<string, Map<string, AppProfile>>

const GLOBAL_KEY = '__global__'

export class AppProfileStore {
  private cache: ProfileCache = new Map()
  private loaded = false

  async load(_goalTopic?: string): Promise<void> {
    // 内存模式：不从数据库加载，黑白名单在运行时动态学习
    this.loaded = true
  }

  lookup(processName: string, goalTopic?: string): ListKind {
    if (goalTopic) {
      const topicProfiles = this.cache.get(goalTopic)
      if (topicProfiles) {
        const p = topicProfiles.get(processName)
        if (p) return p.list
      }
    }
    const globalProfiles = this.cache.get(GLOBAL_KEY)
    if (globalProfiles) {
      const p = globalProfiles.get(processName)
      if (p) return p.list
    }
    return 'unknown'
  }

  async addToList(
    processName: string,
    list: 'whitelist' | 'blacklist',
    goalTopic?: string,
    learned = false,
  ): Promise<void> {
    const profile: AppProfile = {
      processName,
      list,
      goalTopic,
      learnedAt: learned ? Date.now() : undefined,
      pendingSuggest: false,
    }
    const key = goalTopic ?? GLOBAL_KEY
    if (!this.cache.has(key)) {
      this.cache.set(key, new Map())
    }
    this.cache.get(key)!.set(processName, profile)
  }

  getPendingSuggestions(goalTopic?: string): AppProfile[] {
    const result: AppProfile[] = []
    const key = goalTopic ?? GLOBAL_KEY
    const profiles = this.cache.get(key)
    if (profiles) {
      for (const p of profiles.values()) {
        if (p.pendingSuggest) result.push(p)
      }
    }
    return result
  }

  async markPendingSuggestion(processName: string, goalTopic?: string): Promise<void> {
    const key = goalTopic ?? GLOBAL_KEY
    const profiles = this.cache.get(key)
    if (profiles) {
      const p = profiles.get(processName)
      if (p) {
        p.pendingSuggest = true
      }
    }
  }

  isLoaded(): boolean {
    return this.loaded
  }

  debugSnapshot(): { whitelisted: string[]; blacklisted: string[] } {
    const whitelisted: string[] = []
    const blacklisted: string[] = []
    for (const [, profiles] of this.cache) {
      for (const [name, p] of profiles) {
        if (p.list === 'whitelist') whitelisted.push(name)
        else if (p.list === 'blacklist') blacklisted.push(name)
      }
    }
    return { whitelisted, blacklisted }
  }
}
