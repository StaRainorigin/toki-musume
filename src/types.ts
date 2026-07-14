// ===== 模式 =====
export type Mode = 'idle' | 'companion' | 'study' | 'work' | 'rest'

// ===== 目标 =====
export type GoalMode = 'study' | 'work'
export type GoalStatus = 'active' | 'completed' | 'abandoned'

export type Goal = {
  id: string
  mode: GoalMode
  topic: string
  plannedMinutes?: number
  startedAt: number
  endedAt?: number
  status: GoalStatus
}

// ===== 任务系统 =====
export type TaskType = 'timed' | 'target'
export type TaskStatus = 'pending' | 'active' | 'completed' | 'abandoned'

export type Task = {
  id: string
  title: string
  type: TaskType             // timed=计时(番茄钟), target=目标任务
  mode: GoalMode             // study | work
  status: TaskStatus
  // 计时任务
  plannedMinutes?: number    // 计划总时长
  completedMinutes?: number   // 已完成时长
  pomodoroCount?: number     // 已完成番茄数
  // 目标任务
  description?: string
  // 通用
  createdAt: number
  startedAt?: number
  completedAt?: number
}

// ===== 番茄钟 =====
export type PomodoroPhase = 'focus' | 'break' | 'long_break' | 'idle'

export type PomodoroState = {
  phase: PomodoroPhase
  phaseStartedAt: number
  phaseDurationMin: number
  cycleCount: number
  focusMin: number
  breakMin: number
  longBreakMin: number
  cyclesBeforeLongBreak: number
}

export type PomodoroConfig = {
  focusMin: number
  breakMin: number
  longBreakMin: number
  cyclesBeforeLongBreak: number
}

// ===== AI 今日计划建议 =====
export type TaskSuggestion = {
  title: string
  type: TaskType
  mode: GoalMode
  plannedMinutes?: number
  description?: string
}

// ===== 前台窗口感知 =====
export type ForegroundWindow = {
  processName: string
  windowTitle: string
  pid: number
}

// ===== 空闲检测 =====
export type IdleState = {
  idleMs: number
  isIdle: boolean
}

// ===== 应用画像（黑白名单）=====
export type ListKind = 'whitelist' | 'blacklist' | 'unknown'

export type AppProfile = {
  processName: string
  list: ListKind
  goalTopic?: string
  learnedAt?: number
  pendingSuggest?: boolean
}

// ===== 日志事件 =====
export type EventType =
  | 'window_switch'
  | 'idle_started'
  | 'idle_ended'
  | 'slack_detected'
  | 'reminder'
  | 'sokai_yila'
  | 'goal_started'
  | 'goal_ended'
  | 'companion_speak'
  | 'user_chat'
  | 'mode_switch'
  | 'pomodoro_focus_end'
  | 'pomodoro_break_end'
  | 'task_completed'

export type LogEvent = {
  ts: number
  type: EventType
  mode: Mode
  goalId?: string
  processName?: string
  windowTitle?: string
  note?: string
  data?: Record<string, unknown>
}

// ===== LLM =====
export type LLMModelTier = 'judge' | 'generate' | 'summary'

export type LLMConfig = {
  judgeModel: string
  judgeApiKey: string
  judgeApiBase: string
  generateModel: string
  generateApiKey: string
  generateApiBase: string
  summaryModel: string
  summaryApiKey: string
  summaryApiBase: string
}

// ===== 摸鱼提醒分级 =====
export type ReminderLevel = 1 | 2 | 3

// ===== 意图识别（对话场景）=====
export type Intent =
  | { type: 'switch_mode'; mode: Mode; topic?: string; plannedMinutes?: number }
  | { type: 'sokai_yila'; minutes: number }
  | { type: 'end_goal' }
  | { type: 'summary'; range: 'daily' | 'weekly' }
  | null

export type ChatLLMResponse = {
  reply: string
  intent: Intent
}

// ===== 摸鱼 fallback 判断结果 =====
export type SlackJudgeResult = {
  related: boolean
  reason: string
}

// ===== 陪伴配置 =====
export type CompanionFrequency = 'quiet' | 'normal' | 'chatty'

export type CompanionConfig = {
  enabled: boolean
  frequency: CompanionFrequency
  cooldownMinutes: number
  triggerProbability: number
  fallbackIntervalMinutes: number
}

// ===== 用户配置（角色名/软件名）=====
export type PersonaConfig = {
  characterName: string
  appName: string
}

// ===== 运行时状态（持久化用）=====
export type RuntimeState = {
  mode: Mode
  activeGoalId?: string
  companionCooldownUntil: number
  lastSpokeAt?: number
}

// ===== 日总结 =====
export type SlackDetail = {
  time: string        // 时间点 HH:MM
  processName: string
  windowTitle: string
  reason: string
}

export type DailySummary = {
  date: string // YYYY-MM-DD
  appTimeDistribution: Record<string, number> // processName -> minutes
  slackCount: number
  slackDetails: SlackDetail[]   // 每次摸鱼的详情
  sokaiCount: number
  sokaiTotalMinutes: number
  goals: Array<{ topic: string; mode: GoalMode; completed: boolean; minutes: number }>
  comment: string
  generatedAt: number
}

export type WeeklySummary = {
  weekStart: string // YYYY-MM-DD
  dailySummaries: DailySummary[]
  comment: string
  generatedAt: number
}
