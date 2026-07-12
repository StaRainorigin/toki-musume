<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import ChatPanel from './components/ChatPanel.vue'
import MessageInput from './components/MessageInput.vue'
import StatusBar from './components/StatusBar.vue'
import TodaySummary from './components/TodaySummary.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import HistoryView from './components/HistoryView.vue'
import DebugPanel from './components/DebugPanel.vue'
import { useController } from './composables/useController'

const {
  mode, activeGoal, slackCount, messages,
  persona, llmConfig, companionConfig,
  init, sendMessage, switchMode, updateConfig, destroy,
} = useController()

const showSettings = ref(false)
const showHistory = ref(false)
const showDebug = ref(false)

onMounted(async () => {
  try {
    const result = await init()
    if (result.needsGoalTimeoutPrompt) {
      messages.value.push({ role: 'system', content: '上次的目标超时了，要继续还是归档？', ts: Date.now() })
    }
  } catch (e) {
    messages.value.push({ role: 'system', content: `启动失败: ${e}`, ts: Date.now() })
  }
})

onUnmounted(() => {
  destroy()
})
</script>

<template>
  <div class="app">
    <header>
      <span class="char-name">{{ persona.characterName }}</span>
      <div class="header-btns">
        <button class="icon-btn" @click="showDebug = !showDebug">🔧</button>
        <button class="icon-btn" @click="showSettings = !showSettings">⚙</button>
      </div>
    </header>

    <DebugPanel v-if="showDebug" @close="showDebug = false" />

    <SettingsPanel
      v-if="showSettings"
      :persona="persona"
      :llm-config="llmConfig"
      :companion-config="companionConfig"
      @save="(s) => { updateConfig(s.persona, s.llmConfig, s.companionConfig); showSettings = false }"
      @cancel="showSettings = false"
    />

    <ChatPanel :messages="messages" />

    <MessageInput @send="sendMessage" />

    <StatusBar
      :mode="mode"
      :active-goal="activeGoal"
      @switch-mode="switchMode"
    />

    <TodaySummary
      :slack-count="slackCount"
      @view-full="showHistory = !showHistory"
    />

    <HistoryView v-if="showHistory" @close="showHistory = false" />
  </div>
</template>

<style scoped>
.app { max-width: var(--app-max-width); margin: 0 auto; padding: var(--spacing-lg); font-family: sans-serif; }
header { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm) 0; }
.char-name { font-size: 1.2em; font-weight: bold; }
.header-btns { display: flex; gap: var(--spacing-sm); }
.icon-btn { background: none; border: none; font-size: 1.2em; cursor: pointer; }
</style>
