import { getRuntimeState, getActiveGoal, initDatabase, getAppProfiles } from '../tauri-bridge'
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

  const modeMachine: ModeMachineState = {
    ...createInitialState(),
    mode: runtimeState.mode,
    activeGoal,
    restReturnMode: null,
    restUntil: null,
  }

  return {
    modeMachine,
    activeGoal,
    profiles,
    companionConfig: DEFAULT_COMPANION_CONFIG,
    persona: DEFAULT_PERSONA,
    llmConfig: DEFAULT_LLM_CONFIG,
    needsGoalTimeoutPrompt,
  }
}
