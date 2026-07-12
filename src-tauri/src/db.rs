use rusqlite::Connection;
use std::path::Path;

/// 初始化数据库，创建所有表
pub fn init_db(db_path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS app_profiles (
            process_name TEXT NOT NULL,
            list TEXT NOT NULL CHECK(list IN ('whitelist','blacklist','unknown')),
            goal_topic TEXT,
            learned_at INTEGER,
            pending_suggest INTEGER DEFAULT 0,
            PRIMARY KEY (process_name, goal_topic)
        );

        CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            mode TEXT NOT NULL,
            topic TEXT NOT NULL,
            planned_minutes INTEGER,
            started_at INTEGER NOT NULL,
            ended_at INTEGER,
            status TEXT NOT NULL DEFAULT 'active'
        );

        CREATE TABLE IF NOT EXISTS daily_summaries (
            date TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            generated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS weekly_summaries (
            week_start TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            generated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS llm_cache (
            process_name TEXT NOT NULL,
            goal_topic TEXT NOT NULL,
            related INTEGER NOT NULL,
            reason TEXT,
            judged_at INTEGER NOT NULL,
            PRIMARY KEY (process_name, goal_topic)
        );

        CREATE TABLE IF NOT EXISTS runtime_state (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            mode TEXT NOT NULL DEFAULT 'idle',
            active_goal_id TEXT,
            companion_cooldown_until INTEGER DEFAULT 0,
            last_spoke_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS app_config (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            persona TEXT NOT NULL DEFAULT '{}',
            llm_config TEXT NOT NULL DEFAULT '{}',
            companion_config TEXT NOT NULL DEFAULT '{}'
        );

        INSERT OR IGNORE INTO runtime_state (id, mode) VALUES (1, 'idle');
        INSERT OR IGNORE INTO app_config (id) VALUES (1);
        ",
    )?;
    Ok(conn)
}
