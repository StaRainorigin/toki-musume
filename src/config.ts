import type { CompanionConfig, CompanionFrequency, LLMConfig, PersonaConfig } from './types'

// ===== 默认参数（spec 6.7 节）=====
export const DEFAULTS = {
  pollIntervalSec: 2,
  fallbackPollSec: 30,  // 事件钩子失败时的备选轮询间隔
  idleThresholdMin: 5,
  slackLevel1Sec: 30,
  slackLevel2Min: 3,
  slackLevel3Min: 10,
  llmFallbackCooldownMin: 10,
  summaryTime: '23:00',
  weeklySummaryTime: '22:00',
  weeklySummaryDay: 0, // 周日
  summaryRefreshMin: 10,
  longActivityThresholdMin: 120, // 2 小时
  conversationHistoryRounds: 8,  // 对话场景带最近 8 轮
} as const

// ===== 陪伴频率档位映射 =====
export const FREQUENCY_MAP: Record<CompanionFrequency, {
  cooldownMinutes: number
  triggerProbability: number
  fallbackIntervalMinutes: number
}> = {
  quiet: { cooldownMinutes: 30, triggerProbability: 0.2, fallbackIntervalMinutes: 90 },
  normal: { cooldownMinutes: 15, triggerProbability: 0.5, fallbackIntervalMinutes: 45 },
  chatty: { cooldownMinutes: 5, triggerProbability: 0.8, fallbackIntervalMinutes: 20 },
}

export function resolveCompanionConfig(
  enabled: boolean,
  frequency: CompanionFrequency,
  overrides?: Partial<CompanionConfig>,
): CompanionConfig {
  const base = FREQUENCY_MAP[frequency]
  return {
    enabled,
    frequency,
    cooldownMinutes: overrides?.cooldownMinutes ?? base.cooldownMinutes,
    triggerProbability: overrides?.triggerProbability ?? base.triggerProbability,
    fallbackIntervalMinutes: overrides?.fallbackIntervalMinutes ?? base.fallbackIntervalMinutes,
  }
}

// ===== 默认陪伴配置 =====
export const DEFAULT_COMPANION_CONFIG: CompanionConfig = resolveCompanionConfig(true, 'normal')

// ===== 默认角色配置 =====
export const DEFAULT_PERSONA: PersonaConfig = {
  characterName: '小时',
  appName: 'toki-musume',
}

// ===== 默认 LLM 配置（空，需用户填）=====
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  judgeModel: '',
  judgeApiKey: '',
  judgeApiBase: 'https://api.openai.com/v1',
  generateModel: '',
  generateApiKey: '',
  generateApiBase: 'https://api.openai.com/v1',
  summaryModel: '',
  summaryApiKey: '',
  summaryApiBase: 'https://api.openai.com/v1',
}

// ===== 默认角色性格 System prompt 片段 =====
export const DEFAULT_PERSONALITY_PROMPT = `你是一个友好、略带调侃的桌面陪伴监督者。
用户在学习和工作时你会监督他，发现摸鱼会调侃后提醒。
用户在陪伴模式下你会自然闲聊，简短不啰嗦。
语气亲切，像朋友一样，不要用敬语。`
