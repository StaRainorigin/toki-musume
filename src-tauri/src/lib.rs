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
fn append_log(_app: tauri::AppHandle, event: storage::LogEventInput) -> Result<(), String> {
    let app_dir = get_app_data_dir()?;
    let logs_dir = app_dir.join("logs");
    storage::append_log_event(&logs_dir, &event)
}

#[tauri::command(rename_all = "snake_case")]
fn read_logs(_app: tauri::AppHandle, start_date: String, end_date: String) -> Result<Vec<String>, String> {
    let app_dir = get_app_data_dir()?;
    let logs_dir = app_dir.join("logs");
    storage::read_log_events(&logs_dir, &start_date, &end_date)
}

/// 读取 config.json，如果不存在则自动生成默认模板
#[tauri::command]
fn read_config_file() -> Result<String, String> {
    let app_dir = get_app_data_dir()?;
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("无法创建目录: {}", e))?;
    let config_path = app_dir.join("config.json");

    if !config_path.exists() {
        // 生成默认配置模板
        let default_config = serde_json::json!({
            "persona": {
                "characterName": "时娘",
                "appName": "toki-musume"
            },
            "llm": {
                "judge": {
                    "model": "gpt-4o-mini",
                    "apiKey": "",
                    "apiBase": "https://api.openai.com/v1"
                },
                "generate": {
                    "model": "gpt-4o-mini",
                    "apiKey": "",
                    "apiBase": "https://api.openai.com/v1"
                },
                "summary": {
                    "model": "gpt-4o",
                    "apiKey": "",
                    "apiBase": "https://api.openai.com/v1"
                }
            },
            "companion": {
                "enabled": true,
                "frequency": "normal",
                "cooldownMinutes": 10,
                "triggerProbability": 0.3,
                "fallbackIntervalMinutes": 30
            }
        });
        let pretty = serde_json::to_string_pretty(&default_config)
            .map_err(|e| format!("序列化失败: {}", e))?;
        std::fs::write(&config_path, &pretty)
            .map_err(|e| format!("写入配置文件失败: {}", e))?;
        return Ok(pretty);
    }

    std::fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))
}

/// 写入 config.json
#[tauri::command]
fn write_config_file(content: String) -> Result<(), String> {
    let app_dir = get_app_data_dir()?;
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("无法创建目录: {}", e))?;
    let config_path = app_dir.join("config.json");
    std::fs::write(&config_path, &content)
        .map_err(|e| format!("写入配置文件失败: {}", e))
}

/// 打开 config.json 所在目录
#[tauri::command]
fn open_config_dir() -> Result<String, String> {
    let app_dir = get_app_data_dir()?;
    let config_path = app_dir.join("config.json");
    // 返回路径让前端显示
    Ok(config_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DbState(Mutex::new(None)))
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem};
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_foreground_window,
            get_idle_ms,
            init_database,
            append_log,
            read_logs,
            read_config_file,
            write_config_file,
            open_config_dir,
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
            commands::get_app_config,
            commands::save_app_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
