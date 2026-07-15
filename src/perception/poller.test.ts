import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  getForegroundWindow: vi.fn(),
  getIdleMs: vi.fn(),
  listenForegroundWindowChanged: vi.fn().mockResolvedValue(() => {}),
}))

import { getForegroundWindow } from '../tauri-bridge'
import { WindowPoller } from './poller'
import { checkIdle, createIdleDetectorState } from './idle-detector'

describe('WindowPoller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('forcePoll 获取窗口并更新', async () => {
    vi.mocked(getForegroundWindow).mockResolvedValue({ processName: 'A.exe', windowTitle: 'A', pid: 1 })
    const poller = new WindowPoller()
    const win = await poller.forcePoll()
    expect(win?.processName).toBe('A.exe')
    expect(poller.getLastWindow()?.processName).toBe('A.exe')
  })

  it('forcePoll 返回 null 时不更新', async () => {
    vi.mocked(getForegroundWindow).mockResolvedValue(null)
    const poller = new WindowPoller()
    const win = await poller.forcePoll()
    expect(win).toBeNull()
    expect(poller.getLastWindow()).toBeNull()
  })
})

describe('idle-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('超阈值触发 idle_started', async () => {
    const { getIdleMs } = await import('../tauri-bridge')
    vi.mocked(getIdleMs).mockResolvedValue(6 * 60 * 1000)
    const state = createIdleDetectorState()
    const result = await checkIdle(state, 5)
    expect(result.transition).toBe('idle_started')
    expect(result.state.isIdle).toBe(true)
  })

  it('恢复操作触发 idle_ended', async () => {
    const { getIdleMs } = await import('../tauri-bridge')
    vi.mocked(getIdleMs).mockResolvedValue(1000)
    const state = { isIdle: true, idleStartedAt: Date.now() - 600000 }
    const result = await checkIdle(state, 5)
    expect(result.transition).toBe('idle_ended')
    expect(result.state.isIdle).toBe(false)
  })
})
