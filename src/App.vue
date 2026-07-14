<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import ChatPanel from './components/ChatPanel.vue'
import MessageInput from './components/MessageInput.vue'
import StatusBar from './components/StatusBar.vue'
import TodaySummary from './components/TodaySummary.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import HistoryView from './components/HistoryView.vue'
import DebugPanel from './components/DebugPanel.vue'
import TaskList from './components/TaskList.vue'
import PomodoroTimer from './components/PomodoroTimer.vue'
import { useController } from './composables/useController'
import { useModeIcons } from './composables/useModeIcons'
import { useTheme } from './composables/useTheme'
import type { TaskType, GoalMode, TaskSuggestion } from './types'

const {
  mode, activeGoal, slackCount, messages,
  persona, llmConfig, companionConfig,
  tasks, pomodoroDisplay,
  init, sendMessage, updateConfig, destroy,
  addTask, removeTask, completeTask, setActiveTask,
  startPomodoro, pausePomodoro, skipPhase,
  generateDailyPlan, confirmDailyPlan,
  controller: ctrl,
} = useController()

const modeInfo = useModeIcons()
const { themes, currentTheme, setTheme, initTheme } = useTheme()

const showSettings = ref(false)
const showHistory = ref(false)
const showDebug = ref(false)
const showThemePicker = ref(false)

const currentModeInfo = computed(() => modeInfo[mode.value])
const pendingSuggestions = ref<TaskSuggestion[]>([])

async function handleGeneratePlan() {
  const suggestions = await generateDailyPlan()
  if (suggestions.length > 0) {
    pendingSuggestions.value = suggestions
  }
}

async function handleGenerateSummary() {
  const date = new Date().toISOString().slice(0, 10)
  try {
    await ctrl.generateSummaryNow(date)
    messages.value.push({ role: 'system', content: '今日总结已生成，点击下方"查看历史"查看', ts: Date.now() })
  } catch (e) {
    messages.value.push({ role: 'system', content: `总结生成失败: ${e}`, ts: Date.now() })
  }
}

function handleConfirmPlan() {
  confirmDailyPlan(pendingSuggestions.value)
  pendingSuggestions.value = []
}

function handleAddTask(task: { title: string; type: TaskType; mode: GoalMode; plannedMinutes?: number; description?: string }) {
  addTask(task.title, task.type, task.mode, task.plannedMinutes, task.description)
}

onMounted(async () => {
  initTheme()
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
        <div class="avatar">
          <Icon :icon="currentModeInfo.icon" width="28" />
        </div>
        <div class="char-info">
          <span class="char-name">{{ persona.characterName }}</span>
          <span class="char-status">{{ currentModeInfo.status }}</span>
        </div>
      </div>
      <div class="header-btns">
        <!-- 主题切换 -->
        <div class="theme-picker-wrapper">
          <button class="icon-btn" @click="showThemePicker = !showThemePicker" title="主题">
            <Icon icon="tabler:palette" width="20" />
          </button>
          <div v-if="showThemePicker" class="theme-picker">
            <button
              v-for="t in themes"
              :key="t.name"
              @click="setTheme(t.name); showThemePicker = false"
              :class="['theme-option', { active: currentTheme === t.name }]"
            >
              <span class="theme-color-dot" :style="{ background: `var(--color-accent)` }" v-if="currentTheme === t.name"></span>
              {{ t.label }}
            </button>
          </div>
        </div>
        <button class="icon-btn" @click="showDebug = !showDebug" title="调试">
          <Icon icon="tabler:bug" width="20" />
        </button>
        <button class="icon-btn" @click="showSettings = !showSettings" title="设置">
          <Icon icon="tabler:settings" width="20" />
        </button>
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

    <ChatPanel :messages="messages" :avatar-icon="currentModeInfo.icon" />

    <MessageInput @send="sendMessage" />

    <!-- 番茄钟（有活跃任务时显示） -->
    <PomodoroTimer
      v-if="pomodoroDisplay.phase !== 'idle' || activeGoal"
      :phase="pomodoroDisplay.phase"
      :label="pomodoroDisplay.label"
      :remaining-sec="pomodoroDisplay.remainingSec"
      :progress="pomodoroDisplay.progress"
      :cycle-count="pomodoroDisplay.cycleCount"
      @start="startPomodoro"
      @pause="pausePomodoro"
      @skip="skipPhase"
    />

    <!-- AI 计划建议确认 -->
    <div v-if="pendingSuggestions.length > 0" class="suggestions-panel">
      <div class="suggestions-header">
        <h4><Icon icon="tabler:sparkles" width="16" /> AI 建议的任务</h4>
        <button class="close-btn" @click="pendingSuggestions = []"><Icon icon="tabler:x" width="16" /></button>
      </div>
      <div v-for="(s, i) in pendingSuggestions" :key="i" class="suggestion-item">
        <Icon :icon="s.type === 'timed' ? 'tabler:clock' : 'tabler:target'" width="16" />
        <span>{{ s.title }}</span>
        <span v-if="s.plannedMinutes" class="sug-min">{{ s.plannedMinutes }}m</span>
      </div>
      <div class="suggestions-actions">
        <button class="save-btn" @click="handleConfirmPlan">全部添加</button>
        <button class="cancel-btn" @click="pendingSuggestions = []">取消</button>
      </div>
    </div>

    <!-- 任务列表 -->
    <TaskList
      :tasks="tasks"
      @add-task="handleAddTask"
      @remove-task="removeTask"
      @complete-task="completeTask"
      @set-active-task="setActiveTask"
      @generate-plan="handleGeneratePlan"
    />

    <StatusBar
      :mode="mode"
      :active-goal="activeGoal"
    />

    <TodaySummary
      :slack-count="slackCount"
      @view-full="showHistory = !showHistory"
      @generate-summary="handleGenerateSummary"
    />

    <HistoryView v-if="showHistory" @close="showHistory = false" />
  </div>
</template>

<style scoped>
/* AI 建议面板 */
.suggestions-panel {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  box-shadow: var(--shadow-sm);
}
.suggestions-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm); }
.suggestions-header h4 { margin: 0; display: flex; align-items: center; gap: var(--spacing-xs); color: var(--color-text); }
.close-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted); }
.suggestion-item { display: flex; align-items: center; gap: var(--spacing-xs); padding: var(--spacing-xs) 0; font-size: var(--font-sm); color: var(--color-text-secondary); }
.sug-min { color: var(--color-accent); margin-left: auto; }
.suggestions-actions { display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-sm); }
.save-btn { padding: 4px var(--spacing-md); background: var(--color-accent); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--font-sm); }
.cancel-btn { padding: 4px var(--spacing-md); background: var(--color-bg-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; font-size: var(--font-sm); }

.app {
  max-width: var(--app-max-width);
  margin: 0 auto;
  padding: var(--spacing-lg);
  font-family: var(--font-family);
  min-height: 100vh;
  background: linear-gradient(160deg, var(--color-bg) 0%, var(--color-bg-secondary) 50%, var(--color-bg-hover) 100%);
  transition: background 0.5s ease;
}

.app--rest {
  background: linear-gradient(160deg, var(--color-bg) 0%, var(--color-rest-light) 50%, var(--color-bg-hover) 100%);
}
.app--focus {
  background: linear-gradient(160deg, var(--color-bg) 0%, var(--color-accent-light) 50%, var(--color-bg-hover) 100%);
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
  box-shadow: var(--shadow-sm);
  border: 2px solid var(--color-border-light);
  color: var(--color-accent);
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
  position: relative;
}

.icon-btn {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  cursor: pointer;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.icon-btn:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-md);
  color: var(--color-accent);
}

/* 主题选择器 */
.theme-picker-wrapper { position: relative; }
.theme-picker {
  position: absolute;
  top: 42px;
  right: 0;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-xs);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.theme-option {
  background: none;
  border: none;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  white-space: nowrap;
}
.theme-option:hover { background: var(--color-bg-hover); }
.theme-option.active { color: var(--color-accent); font-weight: bold; }
.theme-color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
