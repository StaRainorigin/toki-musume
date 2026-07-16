import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { ForegroundWindow, LogEvent, AppProfile, Goal, RuntimeState, SlackJudgeResult } from './types'

// ===== 前台窗口与空闲 =====
export async function getForegroundWindow(): Promise<ForegroundWindow | null> {
  return invoke<ForegroundWindow | null>('get_foreground_window')
}

export async function getIdleMs(): Promise<number> {
  return invoke<number>('get_idle_ms')
}

/** 监听前台窗口切换事件（由 Rust SetWinEventHook 发出） */
export async function listenForegroundWindowChanged(cb: (win: ForegroundWindow) => void): Promise<UnlistenFn> {
  return listen<ForegroundWindow>('foreground_window_changed', (event) => {
    if (event.payload) {
      cb(event.payload)
    }
  })
}

/** 截屏 + OCR，返回识别到的文字 */
export async function captureAndOcr(): Promise<string> {
  return invoke<string>('capture_and_ocr')
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
      goalId: event.goalId,
      processName: event.processName,
      windowTitle: event.windowTitle,
      note: event.note,
      data: event.data,
    },
  })
}

export async function readLogs(startDate: string, endDate: string): Promise<LogEvent[]> {
  const lines = await invoke<string[]>('read_logs', { start_date: startDate, end_date: endDate })
  return lines.map((line) => JSON.parse(line) as LogEvent)
}

// ===== runtime_state =====
export async function getRuntimeState(): Promise<RuntimeState> {
  const row = await invoke<{
    mode: string
    activeGoalId: string | null
    companionCooldownUntil: number
    lastSpokeAt: number | null
  }>('get_runtime_state')
  return {
    mode: row.mode as RuntimeState['mode'],
    activeGoalId: row.activeGoalId ?? undefined,
    companionCooldownUntil: row.companionCooldownUntil,
    lastSpokeAt: row.lastSpokeAt ?? undefined,
  }
}

export async function saveRuntimeState(state: RuntimeState): Promise<void> {
  await invoke('save_runtime_state', {
    mode: state.mode,
    active_goal_id: state.activeGoalId ?? null,
    companion_cooldown_until: state.companionCooldownUntil,
    last_spoke_at: state.lastSpokeAt ?? null,
  })
}

// ===== app_profiles =====
export async function getAppProfiles(goalTopic?: string): Promise<AppProfile[]> {
  const rows = await invoke<Array<{
    processName: string
    list: string
    goalTopic: string | null
    learnedAt: number | null
    pendingSuggest: boolean
  }>>('get_app_profiles', { goal_topic: goalTopic ?? null })
  return rows.map((r) => ({
    processName: r.processName,
    list: r.list as AppProfile['list'],
    goalTopic: r.goalTopic ?? undefined,
    learnedAt: r.learnedAt ?? undefined,
    pendingSuggest: r.pendingSuggest,
  }))
}

export async function upsertAppProfile(profile: AppProfile): Promise<void> {
  await invoke('upsert_app_profile', {
    process_name: profile.processName,
    list: profile.list,
    goal_topic: profile.goalTopic ?? null,
    learned_at: profile.learnedAt ?? null,
    pending_suggest: profile.pendingSuggest ?? false,
  })
}

// ===== goals =====
export async function saveGoal(goal: Goal): Promise<void> {
  await invoke('save_goal', {
    goal: {
      id: goal.id,
      topic: goal.topic,
      plannedMinutes: goal.plannedMinutes ?? null,
      startedAt: goal.startedAt,
      endedAt: goal.endedAt ?? null,
      status: goal.status,
    },
  })
}

export async function getActiveGoal(goalId: string): Promise<Goal | null> {
  const row = await invoke<{
    id: string
    mode: string
    topic: string
    plannedMinutes: number | null
    startedAt: number
    endedAt: number | null
    status: string
  } | null>('get_active_goal', { goal_id: goalId })
  if (!row) return null
  return {
    id: row.id,
    topic: row.topic,
    plannedMinutes: row.plannedMinutes ?? undefined,
    startedAt: row.startedAt,
    endedAt: row.endedAt ?? undefined,
    status: row.status as Goal['status'],
  }
}

// ===== llm_cache =====
export async function getLlmCache(processName: string, goalTopic: string): Promise<SlackJudgeResult | null> {
  const row = await invoke<{
    related: boolean
    reason: string | null
    judgedAt: number
  } | null>('get_llm_cache', {
    query: { process_name: processName, goal_topic: goalTopic },
  })
  if (!row) return null
  return { related: row.related, reason: row.reason ?? '' }
}

export async function saveLlmCache(
  processName: string,
  goalTopic: string,
  result: SlackJudgeResult,
): Promise<void> {
  await invoke('save_llm_cache', {
    data: {
      process_name: processName,
      goal_topic: goalTopic,
      related: result.related,
      reason: result.reason,
      judged_at: Date.now(),
    },
  })
}

// ===== summaries =====
export async function saveDailySummary(date: string, data: string): Promise<void> {
  await invoke('save_daily_summary', { date, data, generated_at: Date.now() })
}

export async function getDailySummary(date: string): Promise<string | null> {
  return invoke<string | null>('get_daily_summary', { date })
}

export async function listDailySummaries(startDate: string, endDate: string): Promise<Array<{ date: string; data: string }>> {
  const rows = await invoke<Array<[string, string]>>('list_daily_summaries', { start_date: startDate, end_date: endDate })
  return rows.map(([date, data]) => ({ date, data }))
}

export async function saveWeeklySummary(weekStart: string, data: string): Promise<void> {
  await invoke('save_weekly_summary', { week_start: weekStart, data, generated_at: Date.now() })
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
