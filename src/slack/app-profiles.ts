import type { AppProfile, ListKind } from '../types'
import { getAppProfiles, upsertAppProfile } from '../tauri-bridge'

type ProfileCache = Map<string, Map<string, AppProfile>>

const GLOBAL_KEY = '__global__'

export class AppProfileStore {
  private cache: ProfileCache = new Map()
  private loaded = false

  async load(goalTopic?: string): Promise<void> {
    const profiles = await getAppProfiles(goalTopic)
    for (const p of profiles) {
      const key = p.goalTopic ?? GLOBAL_KEY
      if (!this.cache.has(key)) {
        this.cache.set(key, new Map())
      }
      this.cache.get(key)!.set(p.processName, p)
    }
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
    await upsertAppProfile(profile)
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
        await upsertAppProfile(p)
      }
    }
  }

  isLoaded(): boolean {
    return this.loaded
  }
}
