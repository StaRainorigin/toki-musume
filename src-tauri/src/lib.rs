mod winapi;
mod db;
mod storage;
mod commands;

use std::sync::Mutex;
use tauri::Manager;

struct DbState(Mutex<Option<rusqlite::Connection>>);

fn get_app_data_dir() -> Result<std::path::PathBuf, String> {
    let base = std::env::var("APPDATA")
        .map_err(|_| "APPDATA 未设置".to_string())?;
    Ok(std::path::PathBuf::from(base).join("toki-musume"))
}

#[tauri::command]
fn get_foreground_window() -> Option<winapi::ForegroundWindowInfo> {
    winapi::get_foreground_window()
}

#[tauri::command]
fn get_idle_ms() -> u64 {
    winapi::get_idle_ms()
}

#[tauri::command]
fn init_database(app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = get_app_data_dir()?;
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("无法创建目录: {}", e))?;
    let db_path = app_dir.join("toki-musume.db");
    let conn = db::init_db(&db_path).map_err(|e| format!("DB 初始化失败: {}", e))?;
    let state = app.state::<DbState>();
    *state.0.lock().unwrap() = Some(conn);
    Ok(db_path.to_string_lossy().to_string())
}

#[tauri::command]
fn append_log(app: tauri::AppHandle, event: storage::LogEventInput) -> Result<(), String> {
    let app_dir = get_app_data_dir()?;
    let logs_dir = app_dir.join("logs");
    storage::append_log_event(&logs_dir, &event)
}

#[tauri::command]
fn read_logs(app: tauri::AppHandle, start_date: String, end_date: String) -> Result<Vec<String>, String> {
    let app_dir = get_app_data_dir()?;
    let logs_dir = app_dir.join("logs");
    storage::read_log_events(&logs_dir, &start_date, &end_date)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DbState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            get_foreground_window,
            get_idle_ms,
            init_database,
            append_log,
            read_logs,
            commands::get_runtime_state,
            commands::save_runtime_state,
            commands::get_app_profiles,
            commands::upsert_app_profile,
            commands::save_goal,
            commands::get_active_goal,
            commands::get_llm_cache,
            commands::save_llm_cache,
            commands::save_daily_summary,
            commands::get_daily_summary,
            commands::list_daily_summaries,
            commands::save_weekly_summary,
            commands::show_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
