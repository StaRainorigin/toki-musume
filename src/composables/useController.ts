import { ref } from 'vue'
import { AppController } from '../controller'
import type { UIMessage, ControllerState } from '../controller'
import type { Mode, Goal, PersonaConfig, LLMConfig, CompanionConfig, DailySummary } from '../types'

// 单例
let controller: AppController | null = null

// 响应式状态
const mode = ref<Mode>('idle')
const activeGoal = ref<Goal | null>(null)
const slackCount = ref(0)
const messages = ref<UIMessage[]>([])
const persona = ref<PersonaConfig>({ characterName: '时娘', appName: 'toki-musume' })
const llmConfig = ref<LLMConfig>({
  judgeModel: '', judgeApiKey: '', judgeApiBase: 'https://api.openai.com/v1',
  generateModel: '', generateApiKey: '', generateApiBase: 'https://api.openai.com/v1',
  summaryModel: '', summaryApiKey: '', summaryApiBase: 'https://api.openai.com/v1',
})
const companionConfig = ref<CompanionConfig>({
  enabled: true, frequency: 'normal', cooldownMinutes: 10,
  triggerProbability: 0.3, fallbackIntervalMinutes: 30,
})

function ensureController(): AppController {
  if (!controller) {
    controller = new AppController()
    controller.onStateChange = (state: ControllerState) => {
      mode.value = state.mode
      activeGoal.value = state.activeGoal
      slackCount.value = state.slackCount
    }
    controller.onMessage = (msg: UIMessage) => {
      messages.value.push(msg)
    }
  }
  return controller
}

export function useController() {
  const c = ensureController()

  async function init() {
    const result = await c.init()
    // 同步配置到响应式 ref
    persona.value = { ...c.persona }
    llmConfig.value = { ...c.llmConfig }
    companionConfig.value = { ...c.companionConfig }
    return result
  }

  function sendMessage(text: string) {
    c.handleUserMessage(text)
  }

  async function switchMode(m: 'companion' | 'study' | 'work' | 'rest') {
    await c.switchMode(m)
  }

  function updateConfig(p: PersonaConfig, l: LLMConfig, cc: CompanionConfig) {
    persona.value = { ...p }
    llmConfig.value = { ...l }
    companionConfig.value = { ...cc }
    c.updateConfig(p, l, cc)
  }

  async function listHistory(startDate: string, endDate: string): Promise<Array<{ date: string; data: DailySummary }>> {
    return c.listHistory(startDate, endDate)
  }

  function destroy() {
    c.destroy()
  }

  return {
    // 状态
    mode,
    activeGoal,
    slackCount,
    messages,
    persona,
    llmConfig,
    companionConfig,
    // 方法
    init,
    sendMessage,
    switchMode,
    updateConfig,
    listHistory,
    destroy,
    // 原始 controller（调试面板用）
    controller: c,
  }
}
