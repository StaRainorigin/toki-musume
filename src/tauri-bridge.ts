import { invoke } from '@tauri-apps/api/core'
import type { ForegroundWindow, LogEvent, AppProfile, Goal, RuntimeState, SlackJudgeResult } from './types'

// ===== 前台窗口与空闲 =====
export async function getForegroundWindow(): Promise<ForegroundWindow | null> {
  return invoke<ForegroundWindow | null>('get_foreground_window')
}

export async function getIdleMs(): Promise<number> {
  return invoke<number>('get_idle_ms')
}

// ===== 数据库初始化 =====
export async function initDatabase(): Promise<string> {
  return invoke<string>('init_database')
}

// ===== 日志 =====
export async function appendLog(event: LogEvent): Promise<void> {
  await invoke('append_log', {
    event: {
      ts: event.ts,
      type: event.type,
      mode: event.mode,
      goal_id: event.goalId,
      process_name: event.processName,
      window_title: event.windowTitle,
      note: event.note,
      data: event.data,
    },
  })
}

export async function readLogs(startDate: string, endDate: string): Promise<LogEvent[]> {
  const lines = await invoke<string[]>('read_logs', { startDate, endDate })
  return lines.map((line) => JSON.parse(line) as LogEvent)
}

// ===== runtime_state =====
export async function getRuntimeState(): Promise<RuntimeState> {
  const row = await invoke<{
    mode: string
    active_goal_id: string | null
    companion_cooldown_until: number
    last_spoke_at: number | null
  }>('get_runtime_state')
  return {
    mode: row.mode as RuntimeState['mode'],
    activeGoalId: row.active_goal_id ?? undefined,
    companionCooldownUntil: row.companion_cooldown_until,
    lastSpokeAt: row.last_spoke_at ?? undefined,
  }
}

export async function saveRuntimeState(state: RuntimeState): Promise<void> {
  await invoke('save_runtime_state', {
    mode: state.mode,
    activeGoalId: state.activeGoalId ?? null,
    companionCooldownUntil: state.companionCooldownUntil,
    lastSpokeAt: state.lastSpokeAt ?? null,
  })
}

// ===== app_profiles =====
export async function getAppProfiles(goalTopic?: string): Promise<AppProfile[]> {
  const rows = await invoke<Array<{
    process_name: string
    list: string
    goal_topic: string | null
    learned_at: number | null
    pending_suggest: boolean
  }>>('get_app_profiles', { goalTopic: goalTopic ?? null })
  return rows.map((r) => ({
    processName: r.process_name,
    list: r.list as AppProfile['list'],
    goalTopic: r.goal_topic ?? undefined,
    learnedAt: r.learned_at ?? undefined,
    pendingSuggest: r.pending_suggest,
  }))
}

export async function upsertAppProfile(profile: AppProfile): Promise<void> {
  await invoke('upsert_app_profile', {
    processName: profile.processName,
    list: profile.list,
    goalTopic: profile.goalTopic ?? null,
    learnedAt: profile.learnedAt ?? null,
    pendingSuggest: profile.pendingSuggest ?? false,
  })
}

// ===== goals =====
export async function saveGoal(goal: Goal): Promise<void> {
  await invoke('save_goal', {
    goal: {
      id: goal.id,
      mode: goal.mode,
      topic: goal.topic,
      planned_minutes: goal.plannedMinutes ?? null,
      started_at: goal.startedAt,
      ended_at: goal.endedAt ?? null,
      status: goal.status,
    },
  })
}

export async function getActiveGoal(goalId: string): Promise<Goal | null> {
  const row = await invoke<{
    id: string
    mode: string
    topic: string
    planned_minutes: number | null
    started_at: number
    ended_at: number | null
    status: string
  } | null>('get_active_goal', { goalId })
  if (!row) return null
  return {
    id: row.id,
    mode: row.mode as Goal['mode'],
    topic: row.topic,
    plannedMinutes: row.planned_minutes ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    status: row.status as Goal['status'],
  }
}

// ===== llm_cache =====
export async function getLlmCache(processName: string, goalTopic: string): Promise<SlackJudgeResult | null> {
  const row = await invoke<{
    related: boolean
    reason: string | null
    judged_at: number
  } | null>('get_llm_cache', { processName, goalTopic })
  if (!row) return null
  return { related: row.related, reason: row.reason ?? '' }
}

export async function saveLlmCache(
  processName: string,
  goalTopic: string,
  result: SlackJudgeResult,
): Promise<void> {
  await invoke('save_llm_cache', {
    processName,
    goalTopic,
    related: result.related,
    reason: result.reason,
    judgedAt: Date.now(),
  })
}

// ===== summaries =====
export async function saveDailySummary(date: string, data: string): Promise<void> {
  await invoke('save_daily_summary', { date, data, generatedAt: Date.now() })
}

export async function getDailySummary(date: string): Promise<string | null> {
  return invoke<string | null>('get_daily_summary', { date })
}

export async function listDailySummaries(startDate: string, endDate: string): Promise<Array<{ date: string; data: string }>> {
  const rows = await invoke<Array<[string, string]>>('list_daily_summaries', { startDate, endDate })
  return rows.map(([date, data]) => ({ date, data }))
}

export async function saveWeeklySummary(weekStart: string, data: string): Promise<void> {
  await invoke('save_weekly_summary', { weekStart, data, generatedAt: Date.now() })
}

// ===== 通知 =====
export async function showNotification(title: string, body: string): Promise<void> {
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification')
    await sendNotification({ title, body })
  } catch {
    if ('Notification' in window) {
      new Notification(title, { body })
    }
  }
}

// ===== 配置文件 =====
export async function readConfigFile(): Promise<string> {
  return invoke<string>('read_config_file')
}

export async function writeConfigFile(content: string): Promise<void> {
  await invoke('write_config_file', { content })
}

export async function openConfigDir(): Promise<string> {
  return invoke<string>('open_config_dir')
}
