import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LLMClient, FALLBACK_REPLIES } from './client'
import type { LLMConfig } from '../types'

const config: LLMConfig = {
  judgeModel: 'gpt-4o-mini', judgeApiKey: 'sk-test', judgeApiBase: 'https://api.test.com/v1',
  generateModel: 'gpt-4o-mini', generateApiKey: 'sk-test', generateApiBase: 'https://api.test.com/v1',
  summaryModel: 'gpt-4o', summaryApiKey: 'sk-test', summaryApiBase: 'https://api.test.com/v1',
}

describe('LLMClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('isConfigured 检测模型和 key', () => {
    const client = new LLMClient(config)
    expect(client.isConfigured('judge')).toBe(true)
    const emptyConfig = { ...config, judgeModel: '', judgeApiKey: '' }
    expect(new LLMClient(emptyConfig).isConfigured('judge')).toBe(false)
  })

  it('chatWithIntent 解析 JSON 响应', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"reply":"好的","intent":null}' } }],
      }),
    } as Response)
    const client = new LLMClient(config)
    const result = await client.chatWithIntent([])
    expect(result.reply).toBe('好的')
    expect(result.intent).toBeNull()
  })

  it('chatWithIntent 降级处理非 JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '就是一句普通回复' } }],
      }),
    } as Response)
    const client = new LLMClient(config)
    const result = await client.chatWithIntent([])
    expect(result.reply).toBe('就是一句普通回复')
    expect(result.intent).toBeNull()
  })

  it('judgeSlack 解析失败时保守判 related=true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '这不是 JSON' } }],
      }),
    } as Response)
    const client = new LLMClient(config)
    const result = await client.judgeSlack('sys', 'usr')
    expect(result.related).toBe(true)
  })

  it('未配置时抛错', async () => {
    const client = new LLMClient({ ...config, judgeModel: '', judgeApiKey: '' })
    await expect(client.chat([], 'judge')).rejects.toThrow('未配置')
  })

  it('兜底话术存在', () => {
    expect(FALLBACK_REPLIES.reminderLevel1).toBeTruthy()
    expect(FALLBACK_REPLIES.companionIdle).toBeTruthy()
  })
})
