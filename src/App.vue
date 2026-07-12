<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ChatPanel from './components/ChatPanel.vue'
import MessageInput from './components/MessageInput.vue'
import StatusBar from './components/StatusBar.vue'
import TodaySummary from './components/TodaySummary.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import HistoryView from './components/HistoryView.vue'
import DebugPanel from './components/DebugPanel.vue'
import { useController } from './composables/useController'
import type { Mode } from './types'

const {
  mode, activeGoal, slackCount, messages,
  persona, llmConfig, companionConfig,
  init, sendMessage, switchMode, updateConfig, destroy,
} = useController()

const showSettings = ref(false)
const showHistory = ref(false)
const showDebug = ref(false)

const modeEmoji: Record<Mode, string> = {
  idle: '🌸',
  companion: '💕',
  study: '📖',
  work: '💼',
  rest: '☕',
}

const modeStatus: Record<Mode, string> = {
  idle: '在等你呀～',
  companion: '陪你聊天中',
  study: '正在监督你学习～',
  work: '一起加油工作！',
  rest: '好好休息一下吧',
}

const avatarEmoji = computed(() => modeEmoji[mode.value])
const statusText = computed(() => modeStatus[mode.value])

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
  <div class="app" :class="`app--${mode}`">
    <header class="app-header">
      <div class="avatar-area">
        <div class="avatar">{{ avatarEmoji }}</div>
        <div class="char-info">
          <span class="char-name">{{ persona.characterName }}</span>
          <span class="char-status">{{ statusText }}</span>
        </div>
      </div>
      <div class="header-btns">
        <button class="icon-btn" @click="showDebug = !showDebug" title="调试">🔧</button>
        <button class="icon-btn" @click="showSettings = !showSettings" title="设置">⚙</button>
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

    <ChatPanel :messages="messages" :avatar="avatarEmoji" />

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
.app {
  max-width: var(--app-max-width);
  margin: 0 auto;
  padding: var(--spacing-lg);
  font-family: var(--font-family);
  min-height: 100vh;
  background: linear-gradient(160deg, #fff9f5 0%, #fff0ee 50%, #ffeef5 100%);
  transition: background 0.5s ease;
}

/* 模式主题渐变 */
.app--study {
  background: linear-gradient(160deg, #fff9f5 0%, #eef5fc 50%, #e8f0fc 100%);
}
.app--work {
  background: linear-gradient(160deg, #fff9f5 0%, #fff5ef 50%, #ffece5 100%);
}
.app--rest {
  background: linear-gradient(160deg, #fff9f5 0%, #eef9f3 50%, #e6f7ee 100%);
}
.app--companion {
  background: linear-gradient(160deg, #fff9f5 0%, #fff0f3 50%, #ffe6ec 100%);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) 0;
  margin-bottom: var(--spacing-md);
}

.avatar-area {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.avatar {
  width: var(--avatar-size);
  height: var(--avatar-size);
  border-radius: 50%;
  background: var(--color-bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6em;
  box-shadow: var(--shadow-sm);
  border: 2px solid var(--color-border-light);
}

.char-info {
  display: flex;
  flex-direction: column;
}

.char-name {
  font-size: var(--font-lg);
  font-weight: bold;
  color: var(--color-text);
}

.char-status {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.header-btns {
  display: flex;
  gap: var(--spacing-sm);
}

.icon-btn {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  font-size: 1.2em;
  cursor: pointer;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}

.icon-btn:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-md);
}
</style>
