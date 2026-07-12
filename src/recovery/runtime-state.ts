import { getRuntimeState, getActiveGoal, initDatabase, readConfigFile } from '../tauri-bridge'
import { AppProfileStore } from '../slack/app-profiles'
import type { ModeMachineState } from '../state/mode-machine'
import { createInitialState } from '../state/mode-machine'
import type { CompanionConfig, Goal, PersonaConfig, LLMConfig } from '../types'
import { DEFAULT_COMPANION_CONFIG, DEFAULT_PERSONA, DEFAULT_LLM_CONFIG } from '../config'

export type RecoveredState = {
  modeMachine: ModeMachineState
  activeGoal: Goal | null
  profiles: AppProfileStore
  companionConfig: CompanionConfig
  persona: PersonaConfig
  llmConfig: LLMConfig
  needsGoalTimeoutPrompt: boolean
}

type ConfigFile = {
  persona?: Partial<PersonaConfig>
  llm?: {
    judge?: { model?: string; apiKey?: string; apiBase?: string }
    generate?: { model?: string; apiKey?: string; apiBase?: string }
    summary?: { model?: string; apiKey?: string; apiBase?: string }
  }
  companion?: Partial<CompanionConfig>
}

function parseConfigFile(raw: string): { persona: PersonaConfig; llmConfig: LLMConfig; companionConfig: CompanionConfig } {
  const cfg = JSON.parse(raw) as ConfigFile
  const persona: PersonaConfig = { ...DEFAULT_PERSONA, ...cfg.persona }

  const llmConfig: LLMConfig = { ...DEFAULT_LLM_CONFIG }
  if (cfg.llm?.judge) {
    if (cfg.llm.judge.model !== undefined) llmConfig.judgeModel = cfg.llm.judge.model
    if (cfg.llm.judge.apiKey !== undefined) llmConfig.judgeApiKey = cfg.llm.judge.apiKey
    if (cfg.llm.judge.apiBase !== undefined) llmConfig.judgeApiBase = cfg.llm.judge.apiBase
  }
  if (cfg.llm?.generate) {
    if (cfg.llm.generate.model !== undefined) llmConfig.generateModel = cfg.llm.generate.model
    if (cfg.llm.generate.apiKey !== undefined) llmConfig.generateApiKey = cfg.llm.generate.apiKey
    if (cfg.llm.generate.apiBase !== undefined) llmConfig.generateApiBase = cfg.llm.generate.apiBase
  }
  if (cfg.llm?.summary) {
    if (cfg.llm.summary.model !== undefined) llmConfig.summaryModel = cfg.llm.summary.model
    if (cfg.llm.summary.apiKey !== undefined) llmConfig.summaryApiKey = cfg.llm.summary.apiKey
    if (cfg.llm.summary.apiBase !== undefined) llmConfig.summaryApiBase = cfg.llm.summary.apiBase
  }

  const companionConfig: CompanionConfig = { ...DEFAULT_COMPANION_CONFIG, ...cfg.companion }

  return { persona, llmConfig, companionConfig }
}

export async function loadConfigFromFile(): Promise<{ persona: PersonaConfig; llmConfig: LLMConfig; companionConfig: CompanionConfig }> {
  try {
    const raw = await readConfigFile()
    return parseConfigFile(raw)
  } catch (e) {
    console.error('读取配置文件失败，使用默认配置', e)
    return { persona: DEFAULT_PERSONA, llmConfig: DEFAULT_LLM_CONFIG, companionConfig: DEFAULT_COMPANION_CONFIG }
  }
}

export async function recoverState(): Promise<RecoveredState> {
  await initDatabase()

  const runtimeState = await getRuntimeState()

  let activeGoal: Goal | null = null
  let needsGoalTimeoutPrompt = false
  if (runtimeState.activeGoalId) {
    activeGoal = await getActiveGoal(runtimeState.activeGoalId)
    if (activeGoal && activeGoal.plannedMinutes) {
      const elapsed = (Date.now() - activeGoal.startedAt) / 60000
      if (elapsed > activeGoal.plannedMinutes) {
        needsGoalTimeoutPrompt = true
      }
    }
  }

  const profiles = new AppProfileStore()
  await profiles.load(activeGoal?.topic)

  // 从 config.json 文件加载配置
  const { persona, llmConfig, companionConfig } = await loadConfigFromFile()

  // 启动时回到 idle
  const modeMachine: ModeMachineState = {
    ...createInitialState(),
    mode: 'idle',
    activeGoal: null,
    restReturnMode: null,
    restUntil: null,
  }

  return {
    modeMachine,
    activeGoal,
    profiles,
    companionConfig,
    persona,
    llmConfig,
    needsGoalTimeoutPrompt,
  }
}
