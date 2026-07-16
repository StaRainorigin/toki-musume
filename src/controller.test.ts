import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock tauri-bridge — 所有 invoke 调用都 mock 掉
vi.mock('./tauri-bridge', () => ({
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
  getForegroundWindow: vi.fn().mockResolvedValue(null),
  getIdleMs: vi.fn().mockResolvedValue(0),
  readConfigFile: vi.fn().mockResolvedValue('{}'),
  writeConfigFile: vi.fn().mockResolvedValue(undefined),
  openConfigDir: vi.fn().mockResolvedValue(''),
  readLogs: vi.fn().mockResolvedValue([]),
  listenForegroundWindowChanged: vi.fn().mockResolvedValue(() => {}),
  captureAndOcr: vi.fn().mockResolvedValue(''),
}))

// Mock window.setInterval/clearInterval
Object.defineProperty(globalThis, 'setInterval', { value: vi.fn().mockReturnValue(1) })
Object.defineProperty(globalThis, 'clearInterval', { value: vi.fn() })

import { AppController } from './controller'
import { DEFAULT_LLM_CONFIG, DEFAULT_COMPANION_CONFIG } from './config'
import { readConfigFile, writeConfigFile } from './tauri-bridge'

describe('AppController 端到端逻辑测试', () => {
  let controller: AppController

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readConfigFile).mockResolvedValue('{}')
    controller = new AppController()
    controller.onStateChange = vi.fn()
    controller.onMessage = vi.fn()
  })

  it('init 启动后进入 idle 模式，配置从 config.json 加载', async () => {
    // 模拟 config.json 文件内容
    vi.mocked(readConfigFile).mockResolvedValue(JSON.stringify({
      persona: { characterName: '测试娘', appName: 'toki' },
      llm: {
        judge: { model: 'gpt-4o', apiKey: 'sk-test', apiBase: 'https://api.openai.com/v1' },
        generate: { model: 'gpt-4o', apiKey: 'sk-test', apiBase: 'https://api.openai.com/v1' },
        summary: { model: 'gpt-4o', apiKey: 'sk-test', apiBase: 'https://api.openai.com/v1' },
      },
      companion: { enabled: true, frequency: 'normal', cooldownMinutes: 10, triggerProbability: 0.3, fallbackIntervalMinutes: 30 },
    }))

    await controller.init()
    const msgCb = controller.onMessage as unknown as (m: { content: string }) => void
    expect(msgCb).toHaveBeenCalledWith(expect.objectContaining({ content: '测试娘 已启动' }))
  })

  it('setActiveTask 开始任务后进入专注模式', async () => {
    await controller.init()
    const task = controller.taskStore.addTask('学React', 'timed', 60)
    controller.setActiveTask(task.id)
    const stateCb = controller.onStateChange as unknown as (s: { mode: string; activeGoal: { topic: string } | null }) => void
    const lastCall = vi.mocked(stateCb).mock.calls[vi.mocked(stateCb).mock.calls.length - 1][0]
    expect(lastCall.mode).toBe('focus')
    expect(lastCall.activeGoal).not.toBeNull()
    expect(lastCall.activeGoal!.topic).toBe('学React')
  })

  it('pausePomodoro 停止专注回到休息', async () => {
    await controller.init()
    const task = controller.taskStore.addTask('学React', 'timed', 60)
    controller.setActiveTask(task.id)
    controller.pausePomodoro()
    const stateCb = controller.onStateChange as unknown as (s: { mode: string }) => void
    const lastCall = vi.mocked(stateCb).mock.calls[vi.mocked(stateCb).mock.calls.length - 1][0]
    expect(lastCall.mode).toBe('rest')
  })

  it('updateConfig 保存配置到 config.json', async () => {
    await controller.init()
    const persona = { characterName: '新名字', appName: 'toki-musume' }
    const llmConfig = { ...DEFAULT_LLM_CONFIG, judgeModel: 'gpt-4o', judgeApiKey: 'sk-123' }
    const companionConfig = { ...DEFAULT_COMPANION_CONFIG }
    controller.updateConfig(persona, llmConfig, companionConfig)
    // 给 writeConfigFile 的 catch 一点时间
    await new Promise((r) => setTimeout(r, 10))
    expect(writeConfigFile).toHaveBeenCalled()
    const writtenArg = vi.mocked(writeConfigFile).mock.calls[0][0]
    const parsed = JSON.parse(writtenArg)
    expect(parsed.persona.characterName).toBe('新名字')
    expect(parsed.llm.judge.apiKey).toBe('sk-123')
  })

  it('init 后从 config.json 恢复配置', async () => {
    vi.mocked(readConfigFile).mockResolvedValue(JSON.stringify({
      persona: { characterName: '持久化娘', appName: 'toki' },
      llm: {
        judge: { model: 'gpt-4o', apiKey: 'sk-persisted', apiBase: 'https://api.openai.com/v1' },
        generate: { model: 'gpt-4o', apiKey: 'sk-persisted', apiBase: 'https://api.openai.com/v1' },
        summary: { model: 'gpt-4o', apiKey: 'sk-persisted', apiBase: 'https://api.openai.com/v1' },
      },
      companion: { enabled: true, frequency: 'normal', cooldownMinutes: 10, triggerProbability: 0.3, fallbackIntervalMinutes: 30 },
    }))
    await controller.init()
    const msgCb = controller.onMessage as unknown as (m: { content: string }) => void
    expect(msgCb).toHaveBeenCalledWith(expect.objectContaining({ content: '持久化娘 已启动' }))
  })

  it('debugGetSnapshot 返回正确状态', async () => {
    await controller.init()
    const task = controller.taskStore.addTask('学React', 'timed', 60)
    controller.setActiveTask(task.id)
    const snapshot = await controller.debugGetSnapshot()
    expect(snapshot.mode).toBe('focus')
    expect(snapshot.activeGoal).not.toBeNull()
    expect(snapshot.slackCount).toBe(0)
    expect(snapshot.profiles).toBeDefined()
  })

  it('debugDetectSlack 无前台窗口时返回错误提示', async () => {
    await controller.init()
    // idle 模式下 poller 没有 lastWindow
    const result = await controller.debugDetectSlack()
    expect(result.error).toBeDefined()
  })
})
