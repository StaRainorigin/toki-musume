import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  initDatabase: vi.fn(),
  getRuntimeState: vi.fn(),
  getActiveGoal: vi.fn(),
  getAppProfiles: vi.fn(),
  upsertAppProfile: vi.fn(),
  getLlmCache: vi.fn(),
  saveLlmCache: vi.fn(),
  readConfigFile: vi.fn(),
  writeConfigFile: vi.fn(),
  openConfigDir: vi.fn(),
}))

import { recoverState } from './runtime-state'
import { initDatabase, getRuntimeState, getActiveGoal, getAppProfiles, readConfigFile } from '../tauri-bridge'

describe('recoverState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readConfigFile).mockResolvedValue('{}')
  })

  it('正常恢复 idle 状态', async () => {
    vi.mocked(initDatabase).mockResolvedValue('')
    vi.mocked(getRuntimeState).mockResolvedValue({
      mode: 'idle', activeGoalId: undefined,
      companionCooldownUntil: 0, lastSpokeAt: undefined,
    })
    vi.mocked(getAppProfiles).mockResolvedValue([])
    const result = await recoverState()
    expect(result.modeMachine.mode).toBe('idle')
    expect(result.activeGoal).toBeNull()
    expect(result.needsGoalTimeoutPrompt).toBe(false)
  })

  it('有超时目标时提示', async () => {
    vi.mocked(initDatabase).mockResolvedValue('')
    vi.mocked(getRuntimeState).mockResolvedValue({
      mode: 'study', activeGoalId: 'g1',
      companionCooldownUntil: 0, lastSpokeAt: undefined,
    })
    vi.mocked(getActiveGoal).mockResolvedValue({
      id: 'g1', mode: 'study', topic: 'React', plannedMinutes: 30,
      startedAt: Date.now() - 60 * 60000, status: 'active',
    })
    vi.mocked(getAppProfiles).mockResolvedValue([])
    const result = await recoverState()
    expect(result.needsGoalTimeoutPrompt).toBe(true)
    expect(result.activeGoal?.topic).toBe('React')
  })
})
