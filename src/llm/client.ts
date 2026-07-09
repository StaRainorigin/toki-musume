import type { LLMConfig, LLMModelTier, ChatLLMResponse, SlackJudgeResult } from '../types'

export type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export class LLMClient {
  constructor(private config: LLMConfig) {}

  isConfigured(tier: LLMModelTier): boolean {
    const { model, apiKey } = this.getTierConfig(tier)
    return !!model && !!apiKey
  }

  private getTierConfig(tier: LLMModelTier): { model: string; apiKey: string; apiBase: string } {
    switch (tier) {
      case 'judge': return { model: this.config.judgeModel, apiKey: this.config.judgeApiKey, apiBase: this.config.judgeApiBase }
      case 'generate': return { model: this.config.generateModel, apiKey: this.config.generateApiKey, apiBase: this.config.generateApiBase }
      case 'summary': return { model: this.config.summaryModel, apiKey: this.config.summaryApiKey, apiBase: this.config.summaryApiBase }
    }
  }

  async chat(messages: LLMMessage[], tier: LLMModelTier): Promise<string> {
    const { model, apiKey, apiBase } = this.getTierConfig(tier)
    if (!this.isConfigured(tier)) {
      throw new Error(`LLM ${tier} 档未配置`)
    }
    const resp = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.8 }),
    })
    if (!resp.ok) {
      throw new Error(`LLM 请求失败: ${resp.status} ${resp.statusText}`)
    }
    const data = await resp.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  async chatWithIntent(messages: LLMMessage[], tier: LLMModelTier = 'generate'): Promise<ChatLLMResponse> {
    const raw = await this.chat(messages, tier)
    try {
      const parsed = JSON.parse(raw) as ChatLLMResponse
      return { reply: parsed.reply ?? raw, intent: parsed.intent ?? null }
    } catch {
      return { reply: raw, intent: null }
    }
  }

  async judgeSlack(system: string, user: string, tier: LLMModelTier = 'judge'): Promise<SlackJudgeResult> {
    const raw = await this.chat(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      tier,
    )
    try {
      const parsed = JSON.parse(raw) as SlackJudgeResult
      return { related: !!parsed.related, reason: parsed.reason ?? '' }
    } catch {
      return { related: true, reason: '判断失败，保守处理' }
    }
  }
}

export const FALLBACK_REPLIES = {
  slackJudgeFail: '判断失败，暂时放过',
  reminderLevel1: '诶？这不是该学习的时间吗？',
  reminderLevel2: '喂，你已经摸鱼一会儿了，回来学习吧。',
  reminderLevel3: '你已经摸鱼很久了！认真点好不好？',
  companionIdle: '发呆呢？',
  companionGeneric: '在忙吗？',
  llmNotConfigured: '（LLM 未配置，只能简单回复）',
}
