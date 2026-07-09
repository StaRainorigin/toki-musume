import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { appendLog, getForegroundWindow, getIdleMs } from './tauri-bridge'

describe('tauri-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getForegroundWindow 调用 invoke', async () => {
    vi.mocked(invoke).mockResolvedValue({ processName: 'Code.exe', windowTitle: 'main.ts', pid: 1234 })
    const result = await getForegroundWindow()
    expect(invoke).toHaveBeenCalledWith('get_foreground_window')
    expect(result?.processName).toBe('Code.exe')
  })

  it('getIdleMs 调用 invoke', async () => {
    vi.mocked(invoke).mockResolvedValue(300000)
    const result = await getIdleMs()
    expect(result).toBe(300000)
    expect(invoke).toHaveBeenCalledWith('get_idle_ms')
  })

  it('appendLog 转换字段名为 snake_case', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    await appendLog({
      ts: 1000,
      type: 'window_switch',
      mode: 'study',
      processName: 'Code.exe',
      windowTitle: 'main.ts',
    })
    expect(invoke).toHaveBeenCalledWith('append_log', {
      event: {
        ts: 1000,
        type: 'window_switch',
        mode: 'study',
        goal_id: undefined,
        process_name: 'Code.exe',
        window_title: 'main.ts',
        note: undefined,
        data: undefined,
      },
    })
  })
})
