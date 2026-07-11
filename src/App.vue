<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import ChatPanel from './components/ChatPanel.vue'
import MessageInput from './components/MessageInput.vue'
import StatusBar from './components/StatusBar.vue'
import TodaySummary from './components/TodaySummary.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import HistoryView from './components/HistoryView.vue'
import DebugPanel from './components/DebugPanel.vue'
import { AppController } from './controller'
import type { Mode, Goal, PersonaConfig, LLMConfig, CompanionConfig } from './types'
import { DEFAULT_PERSONA, DEFAULT_LLM_CONFIG, DEFAULT_COMPANION_CONFIG } from './config'

const mode = ref<Mode>('idle')
const activeGoal = ref<Goal | null>(null)
const messages = ref<Array<{ role: 'user' | 'assistant' | 'system'; content: string; ts: number }>>([])
const showSettings = ref(false)
const showHistory = ref(false)
const showDebug = ref(false)
const persona = ref<PersonaConfig>({ ...DEFAULT_PERSONA })
const llmConfig = ref<LLMConfig>({ ...DEFAULT_LLM_CONFIG })
const companionConfig = ref<CompanionConfig>({ ...DEFAULT_COMPANION_CONFIG })
const slackCount = ref(0)
const workMinutes = ref(0)
const goalProgress = ref<number | null>(null)

const controller = new AppController()

controller.onStateChange = (state) => {
  mode.value = state.mode
  activeGoal.value = state.activeGoal
  slackCount.value = state.slackCount
}

controller.onMessage = (msg) => {
  messages.value.push(msg)
}

onMounted(async () => {
  try {
    const result = await controller.init()
    if (result.needsGoalTimeoutPrompt) {
      messages.value.push({ role: 'system', content: '上次的目标超时了，要继续还是归档？', ts: Date.now() })
    }
  } catch (e) {
    messages.value.push({ role: 'system', content: `启动失败: ${e}`, ts: Date.now() })
  }
})

onUnmounted(() => {
  controller.destroy()
})

function handleSend(text: string) {
  controller.handleUserMessage(text)
}

async function handleSwitchMode(m: 'companion' | 'study' | 'work' | 'rest') {
  await controller.switchMode(m)
}

function handleSaveSettings(s: { persona: PersonaConfig; llmConfig: LLMConfig; companionConfig: CompanionConfig }) {
  persona.value = s.persona
  llmConfig.value = s.llmConfig
  companionConfig.value = s.companionConfig
  controller.updateConfig(s.persona, s.llmConfig, s.companionConfig)
  showSettings.value = false
}
</script>

<template>
  <div class="app">
    <header>
      <span class="char-name">{{ persona.characterName }}</span>
      <div class="header-btns">
        <button class="settings-btn" @click="showDebug = !showDebug">🔧</button>
        <button class="settings-btn" @click="showSettings = !showSettings">⚙</button>
      </div>
    </header>

    <DebugPanel v-if="showDebug" :controller="controller" @close="showDebug = false" />

    <SettingsPanel
      v-if="showSettings"
      :persona="persona"
      :llm-config="llmConfig"
      :companion-config="companionConfig"
      @save="handleSaveSettings"
    />

    <ChatPanel :messages="messages" />

    <MessageInput @send="handleSend" />

    <StatusBar
      :mode="mode"
      :active-goal="activeGoal"
      @switch-mode="handleSwitchMode"
    />

    <TodaySummary
      :summary="null"
      :slack-count="slackCount"
      :work-minutes="workMinutes"
      :goal-progress="goalProgress"
      @view-full="showHistory = !showHistory"
    />

    <HistoryView v-if="showHistory" />
  </div>
</template>

<style scoped>
.app { max-width: 600px; margin: 0 auto; padding: 16px; font-family: sans-serif; }
header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
.char-name { font-size: 1.2em; font-weight: bold; }
.header-btns { display: flex; gap: 8px; }
.settings-btn { background: none; border: none; font-size: 1.2em; cursor: pointer; }
</style>
