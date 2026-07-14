import { ref } from 'vue'
import { AppController } from '../controller'
import type { UIMessage, ControllerState } from '../controller'
import type { Mode, Goal, PersonaConfig, LLMConfig, CompanionConfig, DailySummary, Task, TaskType, GoalMode, TaskSuggestion } from '../types'

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
const tasks = ref<Task[]>([])
const pomodoroDisplay = ref({ phase: 'idle', label: '待开始', remainingSec: 0, progress: 0, cycleCount: 0 })

function ensureController(): AppController {
  if (!controller) {
    const c = new AppController()
    c.onStateChange = (state: ControllerState) => {
      mode.value = state.mode
      activeGoal.value = state.activeGoal
      slackCount.value = state.slackCount
      tasks.value = [...c.taskStore.getTodayTasks()]
      pomodoroDisplay.value = c.getPomodoroDisplay()
    }
    c.onMessage = (msg: UIMessage) => {
      messages.value.push(msg)
    }
    controller = c
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

  function addTask(title: string, type: TaskType, mode: GoalMode, plannedMinutes?: number, description?: string) {
    c.addTask(title, type, mode, plannedMinutes, description)
  }

  function removeTask(id: string) {
    c.removeTask(id)
  }

  function completeTask(id: string) {
    c.completeTask(id)
  }

  function setActiveTask(id: string) {
    c.setActiveTask(id)
  }

  function startPomodoro() {
    c.startPomodoro()
  }

  function pausePomodoro() {
    c.pausePomodoro()
  }

  function skipPhase() {
    c.skipPhase()
  }

  async function generateDailyPlan(): Promise<TaskSuggestion[]> {
    return c.generateDailyPlan()
  }

  function confirmDailyPlan(suggestions: TaskSuggestion[]) {
    c.confirmDailyPlan(suggestions)
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
    tasks,
    pomodoroDisplay,
    // 方法
    init,
    sendMessage,
    switchMode,
    updateConfig,
    listHistory,
    addTask,
    removeTask,
    completeTask,
    setActiveTask,
    startPomodoro,
    pausePomodoro,
    skipPhase,
    generateDailyPlan,
    confirmDailyPlan,
    destroy,
    // 原始 controller（调试面板用）
    controller: c,
  }
}
