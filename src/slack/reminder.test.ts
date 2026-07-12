import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  showNotification: vi.fn(),
  getAppProfiles: vi.fn(),
  upsertAppProfile: vi.fn(),
  getLlmCache: vi.fn(),
  saveLlmCache: vi.fn(),
}))

import {
  createReminderState,
  checkReminderLevel,
  handleSokai,
  resetSlack,
  markSlackStart,
  updateLevel,
  generateReminderMessage,
} from './reminder'
import { LLMClient } from '../llm/client'
import type { Goal, LLMConfig } from '../types'

const goal: Goal = { id: 'g1', mode: 'study', topic: 'React', startedAt: Date.now(), status: 'active' }
const config: LLMConfig = {
  judgeModel: 'm', judgeApiKey: 'k', judgeApiBase: 'https://a.com/v1',
  generateModel: 'm', generateApiKey: 'k', generateApiBase: 'https://a.com/v1',
  summaryModel: 'm', summaryApiKey: 'k', summaryApiBase: 'https://a.com/v1',
}

describe('reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('30 秒触发 1 级', () => {
    const state = markSlackStart(createReminderState(), 1000)
    const level = checkReminderLevel(state, 1000 + 31 * 1000)
    expect(level).toBe(1)
  })

  it('3 分钟触发 2 级', () => {
    const state = updateLevel(markSlackStart(createReminderState(), 1000), 1)
    const level = checkReminderLevel(state, 1000 + 181 * 1000)
    expect(level).toBe(2)
  })

  it('10 分钟触发 3 级', () => {
    const state = updateLevel(updateLevel(markSlackStart(createReminderState(), 1000), 1), 2)
    const level = checkReminderLevel(state, 1000 + 601 * 1000)
    expect(level).toBe(3)
  })

  it('赖账暂停中不提醒', () => {
    let state = markSlackStart(createReminderState(), 1000)
    state = handleSokai(state, 5, 2000)
    const level = checkReminderLevel(state, 100000)
    expect(level).toBeNull()
  })

  it('赖账后到点恢复提醒', () => {
    let state = markSlackStart(createReminderState(), 1000)
    state = handleSokai(state, 5, 2000)
    const level = checkReminderLevel(state, 400000)
    expect(level).not.toBeNull()
  })

  it('resetSlack 清空计时', () => {
    const state = resetSlack(markSlackStart(createReminderState()))
    expect(state.slackStartedAt).toBeNull()
    expect(state.currentLevel).toBe(0)
  })

  it('赖账次数累加', () => {
    let state = createReminderState()
    state = handleSokai(state, 5)
    state = handleSokai(state, 3)
    expect(state.sokaiCount).toBe(2)
  })

  it('LLM 未配置时用兜底话术', async () => {
    const llm = new LLMClient({ ...config, generateModel: '', generateApiKey: '' })
    const msg = await generateReminderMessage(llm, 1, goal)
    expect(msg).toBeTruthy()
  })
})
