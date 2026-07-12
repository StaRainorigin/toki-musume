use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LogEventInput {
    pub ts: i64,
    pub r#type: String,
    pub mode: String,
    pub goal_id: Option<String>,
    pub process_name: Option<String>,
    pub window_title: Option<String>,
    pub note: Option<String>,
    pub data: Option<serde_json::Value>,
}

/// 追加一条事件到当天的 JSONL 文件
pub fn append_log_event(logs_dir: &PathBuf, event: &LogEventInput) -> Result<(), String> {
    std::fs::create_dir_all(logs_dir).map_err(|e| format!("创建 logs 目录失败: {}", e))?;

    let date = format_date(event.ts);
    let file_path = logs_dir.join(format!("{}.jsonl", date));

    let line = serde_json::to_string(event).map_err(|e| format!("序列化失败: {}", e))?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("打开日志文件失败: {}", e))?;

    writeln!(file, "{}", line).map_err(|e| format!("写入失败: {}", e))?;
    Ok(())
}

/// 读取指定日期范围的 JSONL 事件
pub fn read_log_events(
    logs_dir: &PathBuf,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<String>, String> {
    let mut results = Vec::new();
    let mut current = parse_date(start_date).map_err(|e| format!("日期解析失败: {}", e))?;
    let end = parse_date(end_date).map_err(|e| format!("日期解析失败: {}", e))?;

    while current <= end {
        let file_path = logs_dir.join(format!("{}.jsonl", current.format("%Y-%m-%d")));
        if file_path.exists() {
            let content = std::fs::read_to_string(&file_path)
                .map_err(|e| format!("读取失败: {}", e))?;
            for line in content.lines() {
                if !line.trim().is_empty() {
                    results.push(line.to_string());
                }
            }
        }
        current = current.succ_opt().ok_or("日期溢出")?;
    }
    Ok(results)
}

fn format_date(ts: i64) -> String {
    let secs = ts / 1000;
    let dt = chrono::DateTime::from_timestamp(secs, 0)
        .unwrap_or_else(|| chrono::DateTime::UNIX_EPOCH);
    dt.format("%Y-%m-%d").to_string()
}

fn parse_date(s: &str) -> Result<chrono::NaiveDate, String> {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|e| e.to_string())
}
