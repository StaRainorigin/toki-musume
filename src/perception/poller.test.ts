import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  getForegroundWindow: vi.fn(),
  getIdleMs: vi.fn(),
}))

import { getForegroundWindow } from '../tauri-bridge'
import { WindowPoller } from './poller'
import { checkIdle, createIdleDetectorState } from './idle-detector'

describe('WindowPoller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('窗口变化时触发回调', async () => {
    vi.mocked(getForegroundWindow)
      .mockResolvedValueOnce({ processName: 'A.exe', windowTitle: 'A', pid: 1 })
      .mockResolvedValueOnce({ processName: 'B.exe', windowTitle: 'B', pid: 2 })

    const poller = new WindowPoller()
    const changes: string[] = []
    poller.start((win) => changes.push(win.processName), 1)

    await vi.advanceTimersByTimeAsync(1100)
    await vi.advanceTimersByTimeAsync(1100)
    poller.stop()

    expect(changes).toEqual(['A.exe', 'B.exe'])
  })

  it('窗口未变化不触发', async () => {
    vi.mocked(getForegroundWindow).mockResolvedValue({ processName: 'A.exe', windowTitle: 'A', pid: 1 })

    const poller = new WindowPoller()
    const changes: string[] = []
    poller.start((win) => changes.push(win.processName), 1)

    await vi.advanceTimersByTimeAsync(1100)
    await vi.advanceTimersByTimeAsync(1100)
    poller.stop()

    expect(changes).toEqual(['A.exe'])
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
