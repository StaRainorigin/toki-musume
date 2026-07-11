use crate::DbState;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

fn with_conn<F, R>(state: &tauri::State<DbState>, f: F) -> Result<R, String>
where
    F: FnOnce(&Connection) -> Result<R, String>,
{
    let guard = state.0.lock().map_err(|e| format!("锁失败: {}", e))?;
    let conn = guard.as_ref().ok_or("数据库未初始化")?;
    f(conn)
}

// ===== runtime_state =====
#[derive(Debug, Serialize, Deserialize)]
pub struct RuntimeStateRow {
    pub mode: String,
    pub active_goal_id: Option<String>,
    pub companion_cooldown_until: i64,
    pub last_spoke_at: Option<i64>,
}

#[tauri::command]
pub fn get_runtime_state(state: tauri::State<DbState>) -> Result<RuntimeStateRow, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT mode, active_goal_id, companion_cooldown_until, last_spoke_at FROM runtime_state WHERE id = 1")
            .map_err(|e| e.to_string())?;
        let row = stmt
            .query_row([], |r| {
                Ok(RuntimeStateRow {
                    mode: r.get(0)?,
                    active_goal_id: r.get(1)?,
                    companion_cooldown_until: r.get(2)?,
                    last_spoke_at: r.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;
        Ok(row)
    })
}

#[tauri::command]
pub fn save_runtime_state(
    state: tauri::State<DbState>,
    mode: String,
    activeGoalId: Option<String>,
    companionCooldownUntil: i64,
    lastSpokeAt: Option<i64>,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE runtime_state SET mode = ?, active_goal_id = ?, companion_cooldown_until = ?, last_spoke_at = ? WHERE id = 1",
            rusqlite::params![mode, activeGoalId, companionCooldownUntil, lastSpokeAt],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

// ===== app_profiles =====
#[derive(Debug, Serialize, Deserialize)]
pub struct AppProfileRow {
    pub process_name: String,
    pub list: String,
    pub goal_topic: Option<String>,
    pub learned_at: Option<i64>,
    pub pending_suggest: bool,
}

#[tauri::command]
pub fn get_app_profiles(
    state: tauri::State<DbState>,
    goalTopic: Option<String>,
) -> Result<Vec<AppProfileRow>, String> {
    with_conn(&state, |conn| {
        let (sql, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match &goalTopic {
            Some(t) => (
                "SELECT process_name, list, goal_topic, learned_at, pending_suggest FROM app_profiles WHERE goal_topic = ? OR goal_topic IS NULL".to_string(),
                vec![Box::new(t.clone())],
            ),
            None => (
                "SELECT process_name, list, goal_topic, learned_at, pending_suggest FROM app_profiles".to_string(),
                vec![],
            ),
        };
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(params.iter()), |r| {
                Ok(AppProfileRow {
                    process_name: r.get(0)?,
                    list: r.get(1)?,
                    goal_topic: r.get(2)?,
                    learned_at: r.get(3)?,
                    pending_suggest: r.get::<_, i32>(4)? != 0,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        Ok(result)
    })
}

#[tauri::command]
pub fn upsert_app_profile(
    state: tauri::State<DbState>,
    processName: String,
    list: String,
    goalTopic: Option<String>,
    learnedAt: Option<i64>,
    pendingSuggest: bool,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO app_profiles (process_name, list, goal_topic, learned_at, pending_suggest)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(process_name, goal_topic) DO UPDATE SET list = ?, learned_at = ?, pending_suggest = ?",
            rusqlite::params![
                processName, list, goalTopic, learnedAt, pendingSuggest as i32,
                list, learnedAt, pendingSuggest as i32,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

// ===== goals =====
#[derive(Debug, Serialize, Deserialize)]
pub struct GoalRow {
    pub id: String,
    pub mode: String,
    pub topic: String,
    pub planned_minutes: Option<i64>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub status: String,
}

#[tauri::command]
pub fn save_goal(state: tauri::State<DbState>, goal: GoalRow) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO goals (id, mode, topic, planned_minutes, started_at, ended_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET ended_at = ?, status = ?",
            rusqlite::params![
                goal.id, goal.mode, goal.topic, goal.planned_minutes, goal.started_at, goal.ended_at, goal.status,
                goal.ended_at, goal.status,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn get_active_goal(state: tauri::State<DbState>, goalId: String) -> Result<Option<GoalRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, mode, topic, planned_minutes, started_at, ended_at, status FROM goals WHERE id = ?")
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_row([&goalId], |r| {
                Ok(GoalRow {
                    id: r.get(0)?,
                    mode: r.get(1)?,
                    topic: r.get(2)?,
                    planned_minutes: r.get(3)?,
                    started_at: r.get(4)?,
                    ended_at: r.get(5)?,
                    status: r.get(6)?,
                })
            })
            .ok();
        Ok(result)
    })
}

// ===== llm_cache =====
#[derive(Debug, Serialize, Deserialize)]
pub struct LlmCacheRow {
    pub process_name: String,
    pub goal_topic: String,
    pub related: bool,
    pub reason: Option<String>,
    pub judged_at: i64,
}

#[tauri::command]
pub fn get_llm_cache(
    state: tauri::State<DbState>,
    processName: String,
    goalTopic: String,
) -> Result<Option<LlmCacheRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT process_name, goal_topic, related, reason, judged_at FROM llm_cache WHERE process_name = ? AND goal_topic = ?")
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_row([&processName, &goalTopic], |r| {
                Ok(LlmCacheRow {
                    process_name: r.get(0)?,
                    goal_topic: r.get(1)?,
                    related: r.get::<_, i32>(2)? != 0,
                    reason: r.get(3)?,
                    judged_at: r.get(4)?,
                })
            })
            .ok();
        Ok(result)
    })
}

#[tauri::command]
pub fn save_llm_cache(
    state: tauri::State<DbState>,
    processName: String,
    goalTopic: String,
    related: bool,
    reason: Option<String>,
    judgedAt: i64,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO llm_cache (process_name, goal_topic, related, reason, judged_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(process_name, goal_topic) DO UPDATE SET related = ?, reason = ?, judged_at = ?",
            rusqlite::params![
                processName, goalTopic, related as i32, reason, judgedAt,
                related as i32, reason, judgedAt,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

// ===== summaries =====
#[tauri::command]
pub fn save_daily_summary(
    state: tauri::State<DbState>,
    date: String,
    data: String,
    generatedAt: i64,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO daily_summaries (date, data, generated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET data = ?, generated_at = ?",
            rusqlite::params![date, data, generatedAt, data, generatedAt],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn get_daily_summary(state: tauri::State<DbState>, date: String) -> Result<Option<String>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT data FROM daily_summaries WHERE date = ?")
            .map_err(|e| e.to_string())?;
        let result = stmt.query_row([&date], |r| r.get::<_, String>(0)).ok();
        Ok(result)
    })
}

#[tauri::command]
pub fn list_daily_summaries(
    state: tauri::State<DbState>,
    startDate: String,
    endDate: String,
) -> Result<Vec<(String, String)>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT date, data FROM daily_summaries WHERE date >= ? AND date <= ? ORDER BY date")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([&startDate, &endDate], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        Ok(result)
    })
}

#[tauri::command]
pub fn save_weekly_summary(
    state: tauri::State<DbState>,
    weekStart: String,
    data: String,
    generatedAt: i64,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO weekly_summaries (week_start, data, generated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(week_start) DO UPDATE SET data = ?, generated_at = ?",
            rusqlite::params![weekStart, data, generatedAt, data, generatedAt],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

// ===== 系统通知（占位，实际用 Web Notification）=====
#[tauri::command]
pub fn show_notification(_title: String, _body: String) -> Result<(), String> {
    Ok(())
}

// ===== app_config =====
#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfigRow {
    pub persona: String,
    pub llm_config: String,
    pub companion_config: String,
}

#[tauri::command]
pub fn get_app_config(state: tauri::State<DbState>) -> Result<AppConfigRow, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT persona, llm_config, companion_config FROM app_config WHERE id = 1")
            .map_err(|e| e.to_string())?;
        let row = stmt
            .query_row([], |r| {
                Ok(AppConfigRow {
                    persona: r.get(0)?,
                    llm_config: r.get(1)?,
                    companion_config: r.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;
        Ok(row)
    })
}

#[tauri::command]
pub fn save_app_config(
    state: tauri::State<DbState>,
    persona: String,
    llmConfig: String,
    companionConfig: String,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE app_config SET persona = ?, llm_config = ?, companion_config = ? WHERE id = 1",
            rusqlite::params![persona, llmConfig, companionConfig],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}
