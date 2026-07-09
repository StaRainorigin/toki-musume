# toki-musume 第一阶段实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个 Windows 桌面陪伴监督 Agent，能定时感知前台窗口、按目标判定摸鱼、分级提醒、陪伴说话、记录日志、生成每日总结。

**Architecture:** Tauri 应用，Vue 3 + TypeScript 前端承载所有业务逻辑（状态机、摸鱼判定、LLM 调用、陪伴触发），Rust 后端作为薄桥只做系统 API 调用和文件读写。双存储：JSONL 原始事件流 + SQLite 汇总层。

**Tech Stack:** Tauri 2.x、Vue 3 + TypeScript + Vite、Rust（windows-rs crate）、SQLite（rusqlite）、Vitest（前端测试）

**Spec:** `docs/superpowers/specs/2026-07-09-toki-musume-phase1-design.md`

---

## 文件结构总览

### Rust 后端（`src-tauri/`）
- `src/lib.rs` — Tauri 应用入口，注册 commands
- `src/commands.rs` — 所有 Tauri command 定义
- `src/winapi.rs` — Windows API 封装（前台窗口、最后输入时间）
- `src/storage.rs` — JSONL 追加写入 + SQLite 读写封装
- `src/db.rs` — SQLite schema 初始化和查询

### TypeScript 前端（`src/`）
- `main.ts` — Vue 应用入口
- `App.vue` — 根组件
- `types.ts` — 所有共享类型定义（Mode、Goal、LogEvent、AppProfile 等）
- `config.ts` — 默认参数（轮询间隔、分级阈值、冷却等）和用户配置结构
- `tauri-bridge.ts` — 封装所有 Tauri invoke 调用
- `state/mode-machine.ts` — 模式状态机
- `state/goal-store.ts` — 目标管理
- `perception/poller.ts` — 前台窗口轮询
- `perception/idle-detector.ts` — 空闲检测
- `slack/detector.ts` — 摸鱼检测流程（名单 + LLM fallback）
- `slack/app-profiles.ts` — 黑白名单管理（按目标分组）
- `slack/reminder.ts` — 分级递进提醒 + 赖账处理
- `companion/triggers.ts` — 陪伴触发器（事件 + 定时）
- `companion/arbiter.ts` — 防话痨仲裁器
- `llm/client.ts` — 统一 LLM 调用服务
- `llm/prompts.ts` — 各场景 prompt 构建
- `storage/log-writer.ts` — 前端日志写入接口（调 Rust）
- `storage/log-reader.ts` — 日志读取和聚合
- `summary/daily.ts` — 每日总结生成
- `summary/weekly.ts` — 每周总结生成
- `recovery/runtime-state.ts` — 启动恢复

### UI 组件（`src/components/`）
- `ChatPanel.vue` — 对话区（气泡历史）
- `MessageInput.vue` — 输入框
- `StatusBar.vue` — 状态条 + 模式切换按钮
- `TodaySummary.vue` — 今日小结条
- `SettingsPanel.vue` — 设置面板
- `HistoryView.vue` — 历史总结查看

### 测试（`src/**/*.test.ts`）
与源文件同目录的 `.test.ts` 文件。

---

## Task 1: 脚手架与 Tauri + Vue 项目初始化

**Files:**
- Create: 整个 `src-tauri/` 和 `src/` 骨架（由 create-tauri-app 生成）
- Create: `package.json` 依赖
- Create: `src-tauri/Cargo.toml`

- [ ] **Step 1: 用 create-tauri-app 生成 Vue + TypeScript 项目**

```bash
cd E:/Devs/toki-musume
pnpm create tauri-app . --template vue-ts --manager pnpm --yes
```

如果提示目录非空（有 `docs/` 和 `.git/`），选择继续。生成后确认结构：
- `src/` 含 `main.ts`、`App.vue`
- `src-tauri/` 含 `Cargo.toml`、`src/main.rs`、`src/lib.rs`、`tauri.conf.json`

- [ ] **Step 2: 安装前端依赖**

```bash
cd E:/Devs/toki-musume
pnpm install
```

- [ ] **Step 3: 添加 Rust 依赖到 `src-tauri/Cargo.toml`**

在 `[dependencies]` 下添加：

```toml
windows = { version = "0.58", features = [
    "Win32_Foundation",
    "Win32_UI_WindowsAndMessaging",
    "Win32_System_SystemInformation",
] }
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
```

- [ ] **Step 4: 安装 Tauri CLI**

```bash
cd E:/Devs/toki-musume
pnpm add -D @tauri-apps/cli
```

- [ ] **Step 5: 验证项目能启动**

```bash
cd E:/Devs/toki-musume
pnpm tauri dev
```

预期：弹出 Tauri 窗口显示 Vue 默认页面。确认后 Ctrl+C 关闭。

- [ ] **Step 6: 添加 Vitest 测试框架**

```bash
cd E:/Devs/toki-musume
pnpm add -D vitest @vue/test-utils jsdom
```

在 `package.json` 的 `scripts` 添加：
```json
"test": "vitest run",
"test:watch": "vitest"
```

创建 `vitest.config.ts`：
```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 7: 验证测试框架**

创建 `src/sanity.test.ts`：
```typescript
import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })
})
```

运行：`pnpm test`
预期：1 个测试通过。

- [ ] **Step 8: Commit**

```bash
cd E:/Devs/toki-musume
git add -A
git commit -m "chore: scaffold Tauri + Vue 3 + TypeScript project with Vitest"
```

---

## Task 2: 共享类型定义

**Files:**
- Create: `src/types.ts`
- Test: `src/types.test.ts`

- [ ] **Step 1: 写类型定义文件 `src/types.ts`**

```typescript
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
export type DailySummary = {
  date: string // YYYY-MM-DD
  appTimeDistribution: Record<string, number> // processName -> minutes
  slackCount: number
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
```

- [ ] **Step 2: 写类型编译检查测试 `src/types.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import type { Mode, Goal, LogEvent, AppProfile } from './types'

describe('types', () => {
  it('Mode 类型可用', () => {
    const m: Mode = 'study'
    expect(m).toBe('study')
  })

  it('Goal 类型可用', () => {
    const g: Goal = {
      id: 'g1', mode: 'study', topic: 'React',
      startedAt: Date.now(), status: 'active',
    }
    expect(g.topic).toBe('React')
  })

  it('LogEvent 类型可用', () => {
    const e: LogEvent = {
      ts: Date.now(), type: 'window_switch', mode: 'study',
      processName: 'Code.exe', windowTitle: 'main.ts',
    }
    expect(e.type).toBe('window_switch')
  })

  it('AppProfile 类型可用', () => {
    const p: AppProfile = { processName: 'Code.exe', list: 'whitelist', goalTopic: 'React' }
    expect(p.list).toBe('whitelist')
  })
})
```

- [ ] **Step 3: 运行测试验证类型编译通过**

Run: `pnpm test`
Expected: 5 个测试通过（含 sanity）。

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/types.test.ts
git commit -m "feat: define shared TypeScript types"
```

---

## Task 3: 默认参数与用户配置

**Files:**
- Create: `src/config.ts`
- Test: `src/config.test.ts`

- [ ] **Step 1: 写配置文件 `src/config.ts`**

```typescript
import type { CompanionConfig, CompanionFrequency, LLMConfig, PersonaConfig } from './types'

// ===== 默认参数（spec 6.7 节）=====
export const DEFAULTS = {
  pollIntervalSec: 5,
  idleThresholdMin: 5,
  slackLevel1Sec: 30,
  slackLevel2Min: 3,
  slackLevel3Min: 10,
  llmFallbackCooldownMin: 10,
  summaryTime: '23:00',
  weeklySummaryTime: '22:00',
  weeklySummaryDay: 0, // 周日
  summaryRefreshMin: 10,
  longActivityThresholdMin: 120, // 2 小时
  conversationHistoryRounds: 8,  // 对话场景带最近 8 轮
} as const

// ===== 陪伴频率档位映射 =====
export const FREQUENCY_MAP: Record<CompanionFrequency, {
  cooldownMinutes: number
  triggerProbability: number
  fallbackIntervalMinutes: number
}> = {
  quiet: { cooldownMinutes: 30, triggerProbability: 0.2, fallbackIntervalMinutes: 90 },
  normal: { cooldownMinutes: 15, triggerProbability: 0.5, fallbackIntervalMinutes: 45 },
  chatty: { cooldownMinutes: 5, triggerProbability: 0.8, fallbackIntervalMinutes: 20 },
}

export function resolveCompanionConfig(
  enabled: boolean,
  frequency: CompanionFrequency,
  overrides?: Partial<CompanionConfig>,
): CompanionConfig {
  const base = FREQUENCY_MAP[frequency]
  return {
    enabled,
    frequency,
    cooldownMinutes: overrides?.cooldownMinutes ?? base.cooldownMinutes,
    triggerProbability: overrides?.triggerProbability ?? base.triggerProbability,
    fallbackIntervalMinutes: overrides?.fallbackIntervalMinutes ?? base.fallbackIntervalMinutes,
  }
}

// ===== 默认陪伴配置 =====
export const DEFAULT_COMPANION_CONFIG: CompanionConfig = resolveCompanionConfig(true, 'normal')

// ===== 默认角色配置 =====
export const DEFAULT_PERSONA: PersonaConfig = {
  characterName: '小时',
  appName: 'toki-musume',
}

// ===== 默认 LLM 配置（空，需用户填）=====
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  judgeModel: '',
  judgeApiKey: '',
  judgeApiBase: 'https://api.openai.com/v1',
  generateModel: '',
  generateApiKey: '',
  generateApiBase: 'https://api.openai.com/v1',
  summaryModel: '',
  summaryApiKey: '',
  summaryApiBase: 'https://api.openai.com/v1',
}

// ===== 默认角色性格 System prompt 片段 =====
export const DEFAULT_PERSONALITY_PROMPT = `你是一个友好、略带调侃的桌面陪伴监督者。
用户在学习和工作时你会监督他，发现摸鱼会调侃后提醒。
用户在陪伴模式下你会自然闲聊，简短不啰嗦。
语气亲切，像朋友一样，不要用敬语。`
```

- [ ] **Step 2: 写测试 `src/config.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import {
  DEFAULTS,
  FREQUENCY_MAP,
  resolveCompanionConfig,
  DEFAULT_COMPANION_CONFIG,
  DEFAULT_PERSONA,
} from './config'

describe('config', () => {
  it('默认轮询间隔 5 秒', () => {
    expect(DEFAULTS.pollIntervalSec).toBe(5)
  })

  it('分级阈值正确', () => {
    expect(DEFAULTS.slackLevel1Sec).toBe(30)
    expect(DEFAULTS.slackLevel2Min).toBe(3)
    expect(DEFAULTS.slackLevel3Min).toBe(10)
  })

  it('quiet 档冷却最长', () => {
    expect(FREQUENCY_MAP.quiet.cooldownMinutes).toBe(30)
    expect(FREQUENCY_MAP.chatty.cooldownMinutes).toBe(5)
  })

  it('resolveCompanionConfig 正确合并', () => {
    const cfg = resolveCompanionConfig(true, 'chatty')
    expect(cfg.cooldownMinutes).toBe(5)
    expect(cfg.triggerProbability).toBe(0.8)
  })

  it('resolveCompanionConfig 支持 override', () => {
    const cfg = resolveCompanionConfig(true, 'normal', { cooldownMinutes: 10 })
    expect(cfg.cooldownMinutes).toBe(10)
    expect(cfg.triggerProbability).toBe(0.5) // 未 override 的保持默认
  })

  it('默认陪伴配置是 normal 档', () => {
    expect(DEFAULT_COMPANION_CONFIG.frequency).toBe('normal')
  })

  it('默认角色名非空', () => {
    expect(DEFAULT_PERSONA.characterName.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test`
Expected: config 相关 7 个测试通过。

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/config.test.ts
git commit -m "feat: add default config and companion frequency mapping"
```

---

## Task 4: Rust — Windows API 封装（前台窗口 + 空闲时间）

**Files:**
- Create: `src-tauri/src/winapi.rs`
- Modify: `src-tauri/src/lib.rs`（注册模块）

- [ ] **Step 1: 写 `src-tauri/src/winapi.rs`**

```rust
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
};
use windows::Win32::System::SystemInformation::GetTickCount64;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ForegroundWindowInfo {
    pub process_name: String,
    pub window_title: String,
    pub pid: u32,
}

/// 获取前台窗口的进程名、标题、pid
pub fn get_foreground_window() -> Option<ForegroundWindowInfo> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }

        // 窗口标题
        let mut title_buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut title_buf);
        let window_title = String::from_utf16_lossy(&title_buf[..len as usize]);

        // pid
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        // 进程名：通过 process snapshot 获取
        let process_name = get_process_name(pid).unwrap_or_else(|_| String::from("unknown"));

        Some(ForegroundWindowInfo {
            process_name,
            window_title,
            pid,
        })
    }
}

/// 通过 pid 获取进程名
fn get_process_name(pid: u32) -> Result<String, String> {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            .map_err(|e| format!("CreateToolhelp32Snapshot failed: {}", e))?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                if entry.th32ProcessID == pid {
                    let name = String::from_utf16_lossy(
                        &entry.szExeFile.iter().take_while(|&&c| c != 0).cloned().collect::<Vec<_>>(),
                    );
                    return Ok(name);
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        Err(String::from("process not found"))
    }
}

/// 获取最后输入至今的毫秒数（用于空闲检测）
pub fn get_idle_ms() -> u64 {
    use windows::Win32::Foundation::LASTINPUTINFO;
    use windows::Win32::UI::Input::KeyboardAndMouse::GetLastInputInfo;
    unsafe {
        let mut lii = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut lii).as_bool() {
            let now = GetTickCount64();
            // GetLastInputInfo 返回的是 GetTickCount 的值（32位），做差处理
            let last = lii.dwTime as u64;
            let now32 = (now & 0xFFFFFFFF) as u64;
            if now32 >= last {
                now32 - last
            } else {
                // 32 位回绕
                (0xFFFFFFFF - last) + now32
            }
        } else {
            0
        }
    }
}
```

- [ ] **Step 2: 更新 `src-tauri/Cargo.toml` 添加 ToolHelp feature**

将 windows 的 features 列表添加：
```toml
windows = { version = "0.58", features = [
    "Win32_Foundation",
    "Win32_UI_WindowsAndMessaging",
    "Win32_System_SystemInformation",
    "Win32_System_Diagnostics_ToolHelp",
    "Win32_UI_Input_KeyboardAndMouse",
] }
```

- [ ] **Step 3: 在 `src-tauri/src/lib.rs` 注册模块并暴露 command**

```rust
mod winapi;

#[tauri::command]
fn get_foreground_window() -> Option<winapi::ForegroundWindowInfo> {
    winapi::get_foreground_window()
}

#[tauri::command]
fn get_idle_ms() -> u64 {
    winapi::get_idle_ms()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_foreground_window, get_idle_ms])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: 验证 Rust 编译通过**

Run: `cd src-tauri && cargo build`
Expected: 编译成功，无错误。

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/winapi.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(rust): add Windows API bindings for foreground window and idle time"
```

---

## Task 5: Rust — SQLite schema 初始化

**Files:**
- Create: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 写 `src-tauri/src/db.rs`**

```rust
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

        INSERT OR IGNORE INTO runtime_state (id, mode) VALUES (1, 'idle');
        ",
    )?;
    Ok(conn)
}
```

- [ ] **Step 2: 在 `src-tauri/src/lib.rs` 注册 db 模块并添加初始化 command**

在 `lib.rs` 添加：
```rust
mod db;

use std::sync::Mutex;
use tauri::Manager;

struct DbState(Mutex<Option<rusqlite::Connection>>);

#[tauri::command]
fn init_database(app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app.path().app_data_dir()
        .map_err(|e| format!("无法获取 app_data_dir: {}", e))?;
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("无法创建目录: {}", e))?;
    let db_path = app_dir.join("toki-musume.db");
    let conn = db::init_db(&db_path).map_err(|e| format!("DB 初始化失败: {}", e))?;
    let state = app.state::<DbState>();
    *state.0.lock().unwrap() = Some(conn);
    Ok(db_path.to_string_lossy().to_string())
}
```

更新 `run()` 函数：
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(DbState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            get_foreground_window,
            get_idle_ms,
            init_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

需要在 `Cargo.toml` 的 `tauri` features 里加 `"path"` 或使用 `tauri::Manager`（Tauri 2 中 path API 可能需要 `tauri-plugin-fs`，先用 `std::env` 兜底）。如果编译报 path 相关错误，改用：
```rust
fn get_app_data_dir() -> Result<std::path::PathBuf, String> {
    let base = std::env::var("APPDATA")
        .map_err(|_| "APPDATA 未设置".to_string())?;
    Ok(std::path::PathBuf::from(base).join("toki-musume"))
}
```

并在 `init_database` 中用 `get_app_data_dir()` 替代 `app.path().app_data_dir()`。

- [ ] **Step 3: 验证编译**

Run: `cd src-tauri && cargo build`
Expected: 编译成功。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(rust): add SQLite schema initialization for all tables"
```

---

## Task 6: Rust — JSONL 日志追加写入

**Files:**
- Create: `src-tauri/src/storage.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 写 `src-tauri/src/storage.rs`**

```rust
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
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = ts / 1000;
    let dt = chrono::NaiveDateTime::from_timestamp_opt(secs, 0)
        .unwrap_or_else(|| chrono::NaiveDateTime::from_timestamp(0, 0));
    dt.format("%Y-%m-%d").to_string()
}

fn parse_date(s: &str) -> Result<chrono::NaiveDate, String> {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|e| e.to_string())
}
```

- [ ] **Step 2: 添加 chrono 依赖到 `Cargo.toml`**

```toml
chrono = { version = "0.4", features = ["serde"] }
```

- [ ] **Step 3: 在 `lib.rs` 注册 storage 模块和 command**

```rust
mod storage;

use storage::LogEventInput;

#[tauri::command]
fn append_log(app: tauri::AppHandle, event: LogEventInput) -> Result<(), String> {
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
```

将 `append_log` 和 `read_logs` 加入 `generate_handler!` 列表。

- [ ] **Step 4: 验证编译**

Run: `cd src-tauri && cargo build`
Expected: 编译成功。

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/storage.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(rust): add JSONL log append and range read"
```

---

## Task 7: Rust — SQLite 读写 commands（runtime_state + app_profiles + goals + summaries）

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 写 `src-tauri/src/commands.rs`**

```rust
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
    active_goal_id: Option<String>,
    companion_cooldown_until: i64,
    last_spoke_at: Option<i64>,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE runtime_state SET mode = ?, active_goal_id = ?, companion_cooldown_until = ?, last_spoke_at = ? WHERE id = 1",
            rusqlite::params![mode, active_goal_id, companion_cooldown_until, last_spoke_at],
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
    goal_topic: Option<String>,
) -> Result<Vec<AppProfileRow>, String> {
    with_conn(&state, |conn| {
        let (sql, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match &goal_topic {
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
    process_name: String,
    list: String,
    goal_topic: Option<String>,
    learned_at: Option<i64>,
    pending_suggest: bool,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO app_profiles (process_name, list, goal_topic, learned_at, pending_suggest)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(process_name, goal_topic) DO UPDATE SET list = ?, learned_at = ?, pending_suggest = ?",
            rusqlite::params![
                process_name, list, goal_topic, learned_at, pending_suggest as i32,
                list, learned_at, pending_suggest as i32,
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
pub fn get_active_goal(state: tauri::State<DbState>, goal_id: String) -> Result<Option<GoalRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, mode, topic, planned_minutes, started_at, ended_at, status FROM goals WHERE id = ?")
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_row([&goal_id], |r| {
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
    process_name: String,
    goal_topic: String,
) -> Result<Option<LlmCacheRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT process_name, goal_topic, related, reason, judged_at FROM llm_cache WHERE process_name = ? AND goal_topic = ?")
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_row([&process_name, &goal_topic], |r| {
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
    process_name: String,
    goal_topic: String,
    related: bool,
    reason: Option<String>,
    judged_at: i64,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO llm_cache (process_name, goal_topic, related, reason, judged_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(process_name, goal_topic) DO UPDATE SET related = ?, reason = ?, judged_at = ?",
            rusqlite::params![
                process_name, goal_topic, related as i32, reason, judged_at,
                related as i32, reason, judged_at,
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
    generated_at: i64,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO daily_summaries (date, data, generated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET data = ?, generated_at = ?",
            rusqlite::params![date, data, generated_at, data, generated_at],
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
    start_date: String,
    end_date: String,
) -> Result<Vec<(String, String)>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT date, data FROM daily_summaries WHERE date >= ? AND date <= ? ORDER BY date")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([&start_date, &end_date], |r| {
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
    week_start: String,
    data: String,
    generated_at: i64,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO weekly_summaries (week_start, data, generated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(week_start) DO UPDATE SET data = ?, generated_at = ?",
            rusqlite::params![week_start, data, generated_at, data, generated_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

// ===== 系统通知 =====
#[tauri::command]
pub fn show_notification(title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    // 注：需要 tauri-plugin-notification，在 Task 8 或此处添加依赖
    // 先返回 Ok，实际实现在 UI 层用 Web Notification 或后续补
    Ok(())
}
```

- [ ] **Step 2: 更新 `lib.rs` 引入 commands 模块并注册所有 command**

```rust
mod commands;

// 在 generate_handler! 里加入所有 commands：
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
```

- [ ] **Step 3: 验证编译**

Run: `cd src-tauri && cargo build`
Expected: 编译成功（show_notification 可能需要 notification 插件，先让它返回 Ok 占位）。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(rust): add SQLite CRUD commands for runtime state, profiles, goals, cache, summaries"
```

---

## Task 8: TS — Tauri Bridge 封装

**Files:**
- Create: `src/tauri-bridge.ts`
- Test: `src/tauri-bridge.test.ts`

- [ ] **Step 1: 安装 `@tauri-apps/api`**

```bash
pnpm add @tauri-apps/api @tauri-apps/plugin-notification
```

- [ ] **Step 2: 写 `src/tauri-bridge.ts`**

```typescript
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
  // 用 Tauri notification 插件
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification')
    await sendNotification({ title, body })
  } catch {
    // 降级：Web Notification
    if ('Notification' in window) {
      new Notification(title, { body })
    }
  }
}
```

- [ ] **Step 3: 写测试 `src/tauri-bridge.test.ts`（mock invoke）**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { appendLog, getForegroundWindow, getIdleMs } from './tauri-bridge'

describe('tauri-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getForegroundWindow 调用 invoke', async () => {
    vi.mocked(invoke).mockResolvedValue({ processName: 'Code.exe', windowTitle: 'main.ts', pid: 1234 })
    const result = await getForegroundWindow()
    expect(invoke).toHaveBeenCalledWith('get_foreground_window')
    expect(result?.processName).toBe('Code.exe')
  })

  it('getIdleMs 调用 invoke', async () => {
    vi.mocked(invoke).mockResolvedValue(300000)
    const result = await getIdleMs()
    expect(result).toBe(300000)
    expect(invoke).toHaveBeenCalledWith('get_idle_ms')
  })

  it('appendLog 转换字段名为 snake_case', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    await appendLog({
      ts: 1000,
      type: 'window_switch',
      mode: 'study',
      processName: 'Code.exe',
      windowTitle: 'main.ts',
    })
    expect(invoke).toHaveBeenCalledWith('append_log', {
      event: {
        ts: 1000,
        type: 'window_switch',
        mode: 'study',
        goal_id: undefined,
        process_name: 'Code.exe',
        window_title: 'main.ts',
        note: undefined,
        data: undefined,
      },
    })
  })
})
```

- [ ] **Step 4: 运行测试**

Run: `pnpm test`
Expected: tauri-bridge 测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/tauri-bridge.ts src/tauri-bridge.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add TypeScript Tauri bridge with all invoke wrappers"
```

---

## Task 9: TS — 模式状态机

**Files:**
- Create: `src/state/mode-machine.ts`
- Test: `src/state/mode-machine.test.ts`

- [ ] **Step 1: 写 `src/state/mode-machine.ts`**

```typescript
import type { Mode, Goal, GoalMode } from '../types'

export type ModeMachineState = {
  mode: Mode
  activeGoal: Goal | null
  restReturnMode: Mode | null // 休息结束后回到哪个模式
  restUntil: number | null    // 休息到何时（时间戳）
}

export function createInitialState(): ModeMachineState {
  return {
    mode: 'idle',
    activeGoal: null,
    restReturnMode: null,
    restUntil: null,
  }
}

export type TransitionResult =
  | { ok: true; state: ModeMachineState; event: { type: string; [k: string]: unknown } }
  | { ok: false; reason: string }

export function startGoal(
  state: ModeMachineState,
  mode: GoalMode,
  topic: string,
  plannedMinutes?: number,
): TransitionResult {
  if (state.mode === 'rest') {
    return { ok: false, reason: '休息中，无法开始目标' }
  }
  const goal: Goal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mode,
    topic,
    plannedMinutes,
    startedAt: Date.now(),
    status: 'active',
  }
  const newState: ModeMachineState = {
    ...state,
    mode,
    activeGoal: goal,
  }
  return { ok: true, state: newState, event: { type: 'goal_started', goal } }
}

export function endGoal(state: ModeMachineState): TransitionResult {
  if (!state.activeGoal) {
    return { ok: false, reason: '当前没有活跃目标' }
  }
  const endedGoal: Goal = {
    ...state.activeGoal,
    endedAt: Date.now(),
    status: 'completed',
  }
  const newState: ModeMachineState = {
    ...state,
    mode: 'idle',
    activeGoal: null,
  }
  return { ok: true, state: newState, event: { type: 'goal_ended', goal: endedGoal } }
}

export function startRest(state: ModeMachineState, minutes: number): TransitionResult {
  if (state.mode === 'rest') {
    return { ok: false, reason: '已经在休息中' }
  }
  const newState: ModeMachineState = {
    ...state,
    mode: 'rest',
    restReturnMode: state.mode,
    restUntil: Date.now() + minutes * 60 * 1000,
  }
  return { ok: true, state: newState, event: { type: 'mode_switch', from: state.restReturnMode ?? state.mode, to: 'rest' } }
}

export function endRest(state: ModeMachineState): TransitionResult {
  if (state.mode !== 'rest') {
    return { ok: false, reason: '当前不在休息模式' }
  }
  const returnMode = state.restReturnMode ?? 'idle'
  const newState: ModeMachineState = {
    ...state,
    mode: returnMode,
    restReturnMode: null,
    restUntil: null,
  }
  return { ok: true, state: newState, event: { type: 'mode_switch', from: 'rest', to: returnMode } }
}

export function enterCompanion(state: ModeMachineState): TransitionResult {
  if (state.mode === 'rest') {
    return { ok: false, reason: '休息中，无法进入陪伴' }
  }
  if (state.activeGoal) {
    return { ok: false, reason: '有活跃目标，无法进入陪伴' }
  }
  const newState: ModeMachineState = { ...state, mode: 'companion' }
  return { ok: true, state: newState, event: { type: 'mode_switch', from: state.mode, to: 'companion' } }
}

export function backToIdle(state: ModeMachineState): TransitionResult {
  if (state.activeGoal) {
    return { ok: false, reason: '有活跃目标，无法回到空闲' }
  }
  const newState: ModeMachineState = { ...state, mode: 'idle' }
  return { ok: true, state: newState, event: { type: 'mode_switch', from: state.mode, to: 'idle' } }
}

/// 检查休息是否到时间，到时间自动结束
export function checkRestTimeout(state: ModeMachineState, now: number): TransitionResult | null {
  if (state.mode === 'rest' && state.restUntil !== null && now >= state.restUntil) {
    return endRest(state)
  }
  return null
}
```

- [ ] **Step 2: 写测试 `src/state/mode-machine.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  startGoal,
  endGoal,
  startRest,
  endRest,
  enterCompanion,
  checkRestTimeout,
} from './mode-machine'

describe('mode-machine', () => {
  it('初始状态是 idle', () => {
    expect(createInitialState().mode).toBe('idle')
  })

  it('开始学习目标进入 study 模式', () => {
    const s = createInitialState()
    const r = startGoal(s, 'study', 'React', 120)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('study')
      expect(r.state.activeGoal?.topic).toBe('React')
      expect(r.state.activeGoal?.plannedMinutes).toBe(120)
    }
  })

  it('结束目标回到 idle', () => {
    const s = startGoal(createInitialState(), 'work', '论文').state ?? createInitialState()
    const r = endGoal(s)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('idle')
      expect(r.state.activeGoal).toBeNull()
    }
  })

  it('休息中不能开始目标', () => {
    const s = startRest(createInitialState(), 15).state ?? createInitialState()
    const r = startGoal(s, 'study', 'React')
    expect(r.ok).toBe(false)
  })

  it('休息到时间自动结束', () => {
    const before = Date.now()
    const s = startRest(createInitialState(), 1).state ?? createInitialState()
    // 模拟 1 分钟后
    const r = checkRestTimeout(s, before + 61 * 1000)
    expect(r).not.toBeNull()
    if (r && r.ok) {
      expect(r.state.mode).toBe('idle')
    }
  })

  it('有活跃目标不能进入陪伴', () => {
    const s = startGoal(createInitialState(), 'study', 'React').state ?? createInitialState()
    const r = enterCompanion(s)
    expect(r.ok).toBe(false)
  })

  it('无目标可进入陪伴', () => {
    const s = createInitialState()
    const r = enterCompanion(s)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.mode).toBe('companion')
    }
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test`
Expected: mode-machine 测试通过。

- [ ] **Step 4: Commit**

```bash
git add src/state/mode-machine.ts src/state/mode-machine.test.ts
git commit -m "feat: implement mode state machine with goal/rest/companion transitions"
```

---

## Task 10: TS — 前台窗口轮询与空闲检测

**Files:**
- Create: `src/perception/poller.ts`
- Create: `src/perception/idle-detector.ts`
- Test: `src/perception/poller.test.ts`

- [ ] **Step 1: 写 `src/perception/idle-detector.ts`**

```typescript
import { getIdleMs } from '../tauri-bridge'
import { DEFAULTS } from '../config'

export type IdleDetectorState = {
  isIdle: boolean
  idleStartedAt: number | null
}

export function createIdleDetectorState(): IdleDetectorState {
  return { isIdle: false, idleStartedAt: null }
}

/// 检查空闲状态，返回是否发生状态转换
export async function checkIdle(
  state: IdleDetectorState,
  thresholdMin: number = DEFAULTS.idleThresholdMin,
): Promise<{ state: IdleDetectorState; transition: 'idle_started' | 'idle_ended' | null }> {
  const idleMs = await getIdleMs()
  const thresholdMs = thresholdMin * 60 * 1000
  const nowIdle = idleMs >= thresholdMs

  if (nowIdle && !state.isIdle) {
    return {
      state: { isIdle: true, idleStartedAt: Date.now() - idleMs },
      transition: 'idle_started',
    }
  }
  if (!nowIdle && state.isIdle) {
    return {
      state: { isIdle: false, idleStartedAt: null },
      transition: 'idle_ended',
    }
  }
  return { state, transition: null }
}
```

- [ ] **Step 2: 写 `src/perception/poller.ts`**

```typescript
import { getForegroundWindow } from '../tauri-bridge'
import { DEFAULTS } from '../config'
import type { ForegroundWindow, Mode } from '../types'

export type PollResult = {
  current: ForegroundWindow | null
  changed: boolean
}

export class WindowPoller {
  private intervalId: number | null = null
  private lastWindow: ForegroundWindow | null = null
  private lastCheckAt = 0

  start(
    onWindowChange: (win: ForegroundWindow) => void,
    intervalSec: number = DEFAULTS.pollIntervalSec,
  ): void {
    if (this.intervalId !== null) return
    this.intervalId = window.setInterval(async () => {
      const win = await getForegroundWindow()
      this.lastCheckAt = Date.now()
      if (!win) return

      const changed =
        !this.lastWindow ||
        this.lastWindow.processName !== win.processName ||
        this.lastWindow.windowTitle !== win.windowTitle

      if (changed) {
        this.lastWindow = win
        onWindowChange(win)
      }
    }, intervalSec * 1000)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  getLastWindow(): ForegroundWindow | null {
    return this.lastWindow
  }

  getLastCheckAt(): number {
    return this.lastCheckAt
  }
}
```

- [ ] **Step 3: 写测试 `src/perception/poller.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  getForegroundWindow: vi.fn(),
  getIdleMs: vi.fn(),
}))

import { getForegroundWindow } from '../tauri-bridge'
import { WindowPoller } from './poller'
import { checkIdle, createIdleDetectorState } from './idle-detector'

describe('WindowPoller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('窗口变化时触发回调', async () => {
    vi.mocked(getForegroundWindow)
      .mockResolvedValueOnce({ processName: 'A.exe', windowTitle: 'A', pid: 1 })
      .mockResolvedValueOnce({ processName: 'B.exe', windowTitle: 'B', pid: 2 })

    const poller = new WindowPoller()
    const changes: string[] = []
    poller.start((win) => changes.push(win.processName), 1)

    await vi.advanceTimersByTimeAsync(1100)
    await vi.advanceTimersByTimeAsync(1100)
    poller.stop()

    expect(changes).toEqual(['A.exe', 'B.exe'])
  })

  it('窗口未变化不触发', async () => {
    vi.mocked(getForegroundWindow).mockResolvedValue({ processName: 'A.exe', windowTitle: 'A', pid: 1 })

    const poller = new WindowPoller()
    const changes: string[] = []
    poller.start((win) => changes.push(win.processName), 1)

    await vi.advanceTimersByTimeAsync(1100)
    await vi.advanceTimersByTimeAsync(1100)
    poller.stop()

    expect(changes).toEqual(['A.exe'])
  })
})

describe('idle-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('超阈值触发 idle_started', async () => {
    const { getIdleMs } = await import('../tauri-bridge')
    vi.mocked(getIdleMs).mockResolvedValue(6 * 60 * 1000) // 6 分钟
    const state = createIdleDetectorState()
    const result = await checkIdle(state, 5)
    expect(result.transition).toBe('idle_started')
    expect(result.state.isIdle).toBe(true)
  })

  it('恢复操作触发 idle_ended', async () => {
    const { getIdleMs } = await import('../tauri-bridge')
    vi.mocked(getIdleMs).mockResolvedValue(1000) // 1 秒
    const state = { isIdle: true, idleStartedAt: Date.now() - 600000 }
    const result = await checkIdle(state, 5)
    expect(result.transition).toBe('idle_ended')
    expect(result.state.isIdle).toBe(false)
  })
})
```

- [ ] **Step 4: 运行测试**

Run: `pnpm test`
Expected: poller 和 idle-detector 测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/perception/poller.ts src/perception/idle-detector.ts src/perception/poller.test.ts
git commit -m "feat: add window polling and idle detection"
```

---

## Task 11: TS — 黑白名单管理（按目标分组）

**Files:**
- Create: `src/slack/app-profiles.ts`
- Test: `src/slack/app-profiles.test.ts`

- [ ] **Step 1: 写 `src/slack/app-profiles.ts`**

```typescript
import type { AppProfile, ListKind } from '../types'
import { getAppProfiles, upsertAppProfile } from '../tauri-bridge'

/// 内存缓存：按 goalTopic 分组的 profile map
type ProfileCache = Map<string, Map<string, AppProfile>> // goalTopic -> processName -> profile

const GLOBAL_KEY = '__global__'

export class AppProfileStore {
  private cache: ProfileCache = new Map()
  private loaded = false

  async load(goalTopic?: string): Promise<void> {
    const profiles = await getAppProfiles(goalTopic)
    for (const p of profiles) {
      const key = p.goalTopic ?? GLOBAL_KEY
      if (!this.cache.has(key)) {
        this.cache.set(key, new Map())
      }
      this.cache.get(key)!.set(p.processName, p)
    }
    this.loaded = true
  }

  /// 判断某进程在指定目标下属于哪个名单
  lookup(processName: string, goalTopic?: string): ListKind {
    // 先查目标专属名单
    if (goalTopic) {
      const topicProfiles = this.cache.get(goalTopic)
      if (topicProfiles) {
        const p = topicProfiles.get(processName)
        if (p) return p.list
      }
    }
    // 再查全局名单
    const globalProfiles = this.cache.get(GLOBAL_KEY)
    if (globalProfiles) {
      const p = globalProfiles.get(processName)
      if (p) return p.list
    }
    return 'unknown'
  }

  async addToList(
    processName: string,
    list: 'whitelist' | 'blacklist',
    goalTopic?: string,
    learned = false,
  ): Promise<void> {
    const profile: AppProfile = {
      processName,
      list,
      goalTopic,
      learnedAt: learned ? Date.now() : undefined,
      pendingSuggest: false,
    }
    const key = goalTopic ?? GLOBAL_KEY
    if (!this.cache.has(key)) {
      this.cache.set(key, new Map())
    }
    this.cache.get(key)!.set(processName, profile)
    await upsertAppProfile(profile)
  }

  /// 获取待确认的自动学习候选
  getPendingSuggestions(goalTopic?: string): AppProfile[] {
    const result: AppProfile[] = []
    const key = goalTopic ?? GLOBAL_KEY
    const profiles = this.cache.get(key)
    if (profiles) {
      for (const p of profiles.values()) {
        if (p.pendingSuggest) result.push(p)
      }
    }
    return result
  }

  async markPendingSuggestion(processName: string, goalTopic?: string): Promise<void> {
    const key = goalTopic ?? GLOBAL_KEY
    const profiles = this.cache.get(key)
    if (profiles) {
      const p = profiles.get(processName)
      if (p) {
        p.pendingSuggest = true
        await upsertAppProfile(p)
      }
    }
  }

  isLoaded(): boolean {
    return this.loaded
  }
}
```

- [ ] **Step 2: 写测试 `src/slack/app-profiles.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  getAppProfiles: vi.fn(),
  upsertAppProfile: vi.fn(),
}))

import { getAppProfiles, upsertAppProfile } from '../tauri-bridge'
import { AppProfileStore } from './app-profiles'

describe('AppProfileStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lookup 未命中返回 unknown', async () => {
    vi.mocked(getAppProfiles).mockResolvedValue([])
    const store = new AppProfileStore()
    await store.load()
    expect(store.lookup('Unknown.exe', 'React')).toBe('unknown')
  })

  it('目标专属名单优先于全局', async () => {
    vi.mocked(getAppProfiles).mockResolvedValue([
      { processName: 'Code.exe', list: 'whitelist', goalTopic: 'React' },
      { processName: 'Code.exe', list: 'blacklist', goalTopic: undefined }, // 全局
    ])
    const store = new AppProfileStore()
    await store.load()
    // 查 React 目标时，目标专属白名单优先
    expect(store.lookup('Code.exe', 'React')).toBe('whitelist')
    // 无目标时走全局
    expect(store.lookup('Code.exe')).toBe('blacklist')
  })

  it('addToList 更新缓存和持久层', async () => {
    vi.mocked(getAppProfiles).mockResolvedValue([])
    vi.mocked(upsertAppProfile).mockResolvedValue(undefined)
    const store = new AppProfileStore()
    await store.load()
    await store.addToList('Bilibili.exe', 'blacklist', 'React')
    expect(store.lookup('Bilibili.exe', 'React')).toBe('blacklist')
    expect(upsertAppProfile).toHaveBeenCalled()
  })

  it('待确认候选可查询', async () => {
    vi.mocked(getAppProfiles).mockResolvedValue([])
    vi.mocked(upsertAppProfile).mockResolvedValue(undefined)
    const store = new AppProfileStore()
    await store.load()
    await store.addToList('NewApp.exe', 'whitelist', 'React')
    await store.markPendingSuggestion('NewApp.exe', 'React')
    const pending = store.getPendingSuggestions('React')
    expect(pending).toHaveLength(1)
    expect(pending[0].processName).toBe('NewApp.exe')
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test`
Expected: app-profiles 测试通过。

- [ ] **Step 4: Commit**

```bash
git add src/slack/app-profiles.ts src/slack/app-profiles.test.ts
git commit -m "feat: add app profile store with per-goal blacklist/whitelist lookup"
```

---

## Task 12: TS — LLM 客户端与 prompt 构建

**Files:**
- Create: `src/llm/client.ts`
- Create: `src/llm/prompts.ts`
- Test: `src/llm/client.test.ts`
- Test: `src/llm/prompts.test.ts`

- [ ] **Step 1: 写 `src/llm/prompts.ts`**

```typescript
import type { Goal, Mode, ReminderLevel, ForegroundWindow } from '../types'
import { DEFAULT_PERSONALITY_PROMPT } from '../config'
import type { PersonaConfig } from '../types'

export function buildSystemPrompt(persona: PersonaConfig, mode: Mode, goal: Goal | null): string {
  const parts: string[] = [
    DEFAULT_PERSONALITY_PROMPT,
    `你的名字是「${persona.characterName}」，这个软件叫「${persona.appName}」。`,
  ]
  if (goal) {
    parts.push(`用户当前正在${goal.mode === 'study' ? '学习' : '工作'}：${goal.topic}。`)
    if (goal.plannedMinutes) {
      const elapsed = Math.floor((Date.now() - goal.startedAt) / 60000)
      parts.push(`计划 ${goal.plannedMinutes} 分钟，已进行 ${elapsed} 分钟。`)
    }
    parts.push('如果用户在摸鱼（与目标无关），你应该调侃后提醒他回到正事。')
  } else if (mode === 'companion') {
    parts.push('用户当前在陪伴模式，没有特定目标。自然闲聊即可，简短不啰嗦。')
  }
  return parts.join('\n')
}

/// 摸鱼 fallback 判断 prompt
export function buildSlackJudgePrompt(goal: Goal, win: ForegroundWindow): { system: string; user: string } {
  return {
    system: '你是一个应用分类助手。判断给定应用是否与用户的学习/工作目标相关。只返回 JSON。',
    user: JSON.stringify({
      instruction: '判断这个应用是否与目标相关，返回 {"related": true/false, "reason": "简短理由"}',
      goal: `${goal.mode === 'study' ? '学习' : '工作'}：${goal.topic}`,
      processName: win.processName,
      windowTitle: win.windowTitle,
    }),
  }
}

/// 提醒话术 prompt
export function buildReminderPrompt(level: ReminderLevel, goal: Goal): { system: string; user: string } {
  const toneMap: Record<ReminderLevel, string> = {
    1: '轻调侃，像朋友开玩笑，一句话',
    2: '正经提醒，认真但友好，一句话',
    3: '严肃但关心，强调该回来了，一到两句话',
  }
  return {
    system: `你是一个监督伙伴。用户在${goal.mode === 'study' ? '学习' : '工作'}${goal.topic}时摸鱼了。当前是第${level}级提醒，语气：${toneMap[level]}。只输出要说的话，不要加引号或前缀。`,
    user: '生成提醒话术。',
  }
}

/// 陪伴主动说话 prompt
export function buildCompanionPrompt(context: {
  windowTitle?: string
  processName?: string
  isIdle: boolean
  idleMinutes?: number
}): { system: string; user: string } {
  let userMsg = ''
  if (context.isIdle) {
    userMsg = `用户已经空闲 ${context.idleMinutes} 分钟了，自然地说句话（比如关心或调侃）。`
  } else if (context.processName) {
    userMsg = `用户当前在用 ${context.processName}（标题：${context.windowTitle}），自然地说句话。`
  } else {
    userMsg = '自然地说一句闲聊的话。'
  }
  return {
    system: '你是用户的桌面陪伴。主动开口说一句简短自然的话，不要超过两句。不要用敬语。',
    user: userMsg,
  }
}

/// 用户对话 prompt（含意图识别）
export function buildChatPrompt(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
): { system: string; user: string } {
  const system = `你是一个桌面陪伴监督助手。用户跟你说话，你要回复。
同时分析用户的话是否包含以下意图之一：
- switch_mode: 用户想切换模式（学习/工作/陪伴/休息），可能带 topic 和 plannedMinutes
- sokai_yila: 用户在赖账（如"再看5分钟"），提取 minutes
- end_goal: 用户说结束/学完了
- summary: 用户想看总结（daily/weekly）

返回 JSON：{"reply": "你的回复", "intent": {...} | null}
intent 格式示例：{"type":"switch_mode","mode":"study","topic":"React","plannedMinutes":120}
或 {"type":"sokai_yila","minutes":5}
或 {"type":"end_goal"}
或 {"type":"summary","range":"daily"}
如果无意图，intent 为 null。`

  const historyText = history
    .slice(-8)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')
  const user = historyText ? `${historyText}\nuser: ${userMessage}` : userMessage

  return { system, user }
}

/// 每日总结 prompt
export function buildDailySummaryPrompt(
  date: string,
  aggregated: {
    appTimeDistribution: Record<string, number>
    slackCount: number
    sokaiCount: number
    sokaiTotalMinutes: number
    goals: Array<{ topic: string; mode: string; completed: boolean; minutes: number }>
  },
): { system: string; user: string } {
  return {
    system: '你是一个桌面活动总结助手。根据用户今天的活动数据，生成一段纯文字总结报告，最后加一句简短点评。报告包含：各应用使用时长、摸鱼次数（含赖账）、目标完成情况。',
    user: `日期：${date}\n活动数据：\n${JSON.stringify(aggregated, null, 2)}`,
  }
}
```

- [ ] **Step 2: 写 `src/llm/prompts.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildSlackJudgePrompt, buildReminderPrompt, buildCompanionPrompt } from './prompts'
import type { PersonaConfig, Goal } from '../types'

const persona: PersonaConfig = { characterName: '小时', appName: 'toki-musume' }
const goal: Goal = {
  id: 'g1', mode: 'study', topic: 'React', plannedMinutes: 120,
  startedAt: Date.now() - 40 * 60000, status: 'active',
}

describe('prompts', () => {
  it('system prompt 含角色名', () => {
    const p = buildSystemPrompt(persona, 'study', goal)
    expect(p).toContain('小时')
    expect(p).toContain('toki-musume')
    expect(p).toContain('React')
  })

  it('slack judge prompt 要求 JSON 返回', () => {
    const p = buildSlackJudgePrompt(goal, { processName: 'Bili.exe', windowTitle: 'B站', pid: 1 })
    expect(p.system).toContain('JSON')
    expect(p.user).toContain('Bili.exe')
    expect(p.user).toContain('React')
  })

  it('reminder prompt 含等级和语气', () => {
    const p1 = buildReminderPrompt(1, goal)
    expect(p1.system).toContain('第1级')
    expect(p1.system).toContain('调侃')
    const p3 = buildReminderPrompt(3, goal)
    expect(p3.system).toContain('第3级')
    expect(p3.system).toContain('严肃')
  })

  it('companion prompt 空闲场景', () => {
    const p = buildCompanionPrompt({ isIdle: true, idleMinutes: 6 })
    expect(p.user).toContain('空闲')
    expect(p.user).toContain('6')
  })
})
```

- [ ] **Step 3: 写 `src/llm/client.ts`**

```typescript
import type { LLMConfig, LLMModelTier, ChatLLMResponse, SlackJudgeResult } from '../types'

export type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export class LLMClient {
  constructor(private config: LLMConfig) {}

  isConfigured(tier: LLMModelTier): boolean {
    const { model, apiKey } = this.getTierConfig(tier)
    return !!model && !!apiKey
  }

  private getTierConfig(tier: LLMModelTier): { model: string; apiKey: string; apiBase: string } {
    switch (tier) {
      case 'judge': return { model: this.config.judgeModel, apiKey: this.config.judgeApiKey, apiBase: this.config.judgeApiBase }
      case 'generate': return { model: this.config.generateModel, apiKey: this.config.generateApiKey, apiBase: this.config.generateApiBase }
      case 'summary': return { model: this.config.summaryModel, apiKey: this.config.summaryApiKey, apiBase: this.config.summaryApiBase }
    }
  }

  async chat(messages: LLMMessage[], tier: LLMModelTier): Promise<string> {
    const { model, apiKey, apiBase } = this.getTierConfig(tier)
    if (!this.isConfigured(tier)) {
      throw new Error(`LLM ${tier} 档未配置`)
    }
    const resp = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.8 }),
    })
    if (!resp.ok) {
      throw new Error(`LLM 请求失败: ${resp.status} ${resp.statusText}`)
    }
    const data = await resp.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  /// 对话场景：返回 reply + intent
  async chatWithIntent(messages: LLMMessage[], tier: LLMModelTier = 'generate'): Promise<ChatLLMResponse> {
    const raw = await this.chat(messages, tier)
    try {
      const parsed = JSON.parse(raw) as ChatLLMResponse
      return { reply: parsed.reply ?? raw, intent: parsed.intent ?? null }
    } catch {
      // LLM 没返回合法 JSON，降级为纯回复
      return { reply: raw, intent: null }
    }
  }

  /// 摸鱼判断：返回 related + reason
  async judgeSlack(system: string, user: string, tier: LLMModelTier = 'judge'): Promise<SlackJudgeResult> {
    const raw = await this.chat(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      tier,
    )
    try {
      const parsed = JSON.parse(raw) as SlackJudgeResult
      return { related: !!parsed.related, reason: parsed.reason ?? '' }
    } catch {
      // 解析失败，保守判为未知（不误判摸鱼）
      return { related: true, reason: '判断失败，保守处理' }
    }
  }
}

/// 本地兜底话术
export const FALLBACK_REPLIES = {
  slackJudgeFail: '判断失败，暂时放过',
  reminderLevel1: '诶？这不是该学习的时间吗？',
  reminderLevel2: '喂，你已经摸鱼一会儿了，回来学习吧。',
  reminderLevel3: '你已经摸鱼很久了！认真点好不好？',
  companionIdle: '发呆呢？',
  companionGeneric: '在忙吗？',
  llmNotConfigured: '（LLM 未配置，只能简单回复）',
}
```

- [ ] **Step 4: 写测试 `src/llm/client.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LLMClient, FALLBACK_REPLIES } from './client'
import type { LLMConfig } from '../types'

const config: LLMConfig = {
  judgeModel: 'gpt-4o-mini', judgeApiKey: 'sk-test', judgeApiBase: 'https://api.test.com/v1',
  generateModel: 'gpt-4o-mini', generateApiKey: 'sk-test', generateApiBase: 'https://api.test.com/v1',
  summaryModel: 'gpt-4o', summaryApiKey: 'sk-test', summaryApiBase: 'https://api.test.com/v1',
}

describe('LLMClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('isConfigured 检测模型和 key', () => {
    const client = new LLMClient(config)
    expect(client.isConfigured('judge')).toBe(true)
    const emptyConfig = { ...config, judgeModel: '', judgeApiKey: '' }
    expect(new LLMClient(emptyConfig).isConfigured('judge')).toBe(false)
  })

  it('chatWithIntent 解析 JSON 响应', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"reply":"好的","intent":null}' } }],
      }),
    } as Response)
    const client = new LLMClient(config)
    const result = await client.chatWithIntent([])
    expect(result.reply).toBe('好的')
    expect(result.intent).toBeNull()
  })

  it('chatWithIntent 降级处理非 JSON', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '就是一句普通回复' } }],
      }),
    } as Response)
    const client = new LLMClient(config)
    const result = await client.chatWithIntent([])
    expect(result.reply).toBe('就是一句普通回复')
    expect(result.intent).toBeNull()
  })

  it('judgeSlack 解析失败时保守判 related=true', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '这不是 JSON' } }],
      }),
    } as Response)
    const client = new LLMClient(config)
    const result = await client.judgeSlack('sys', 'usr')
    expect(result.related).toBe(true)
  })

  it('未配置时抛错', async () => {
    const client = new LLMClient({ ...config, judgeModel: '', judgeApiKey: '' })
    await expect(client.chat([], 'judge')).rejects.toThrow('未配置')
  })

  it('兜底话术存在', () => {
    expect(FALLBACK_REPLIES.reminderLevel1).toBeTruthy()
    expect(FALLBACK_REPLIES.companionIdle).toBeTruthy()
  })
})
```

- [ ] **Step 5: 运行测试**

Run: `pnpm test`
Expected: llm 相关测试通过。

- [ ] **Step 6: Commit**

```bash
git add src/llm/client.ts src/llm/prompts.ts src/llm/client.test.ts src/llm/prompts.test.ts
git commit -m "feat: add LLM client with intent parsing, slack judge, and prompt builders"
```

---

## Task 13: TS — 摸鱼检测流程

**Files:**
- Create: `src/slack/detector.ts`
- Test: `src/slack/detector.test.ts`

- [ ] **Step 1: 写 `src/slack/detector.ts`**

```typescript
import type { ForegroundWindow, Goal, SlackJudgeResult } from '../types'
import { AppProfileStore } from './app-profiles'
import { LLMClient } from '../llm/client'
import { buildSlackJudgePrompt } from '../llm/prompts'
import { getLlmCache, saveLlmCache } from '../tauri-bridge'
import { DEFAULTS } from '../config'

export type SlackJudgeOutcome = 'working' | 'slacking' | 'unknown'

/// 摸鱼检测结果
export type DetectionResult = {
  outcome: SlackJudgeOutcome
  processName: string
  windowTitle: string
  needsReminder: boolean
}

export class SlackDetector {
  private lastJudgeAt: Map<string, number> = new Map() // processName -> 上次判断时间

  constructor(
    private profiles: AppProfileStore,
    private llm: LLMClient,
  ) {}

  async detect(win: ForegroundWindow, goal: Goal): Promise<DetectionResult> {
    const listKind = this.profiles.lookup(win.processName, goal.topic)

    if (listKind === 'whitelist') {
      return { outcome: 'working', processName: win.processName, windowTitle: win.windowTitle, needsReminder: false }
    }
    if (listKind === 'blacklist') {
      return { outcome: 'slacking', processName: win.processName, windowTitle: win.windowTitle, needsReminder: true }
    }

    // unknown -> LLM fallback
    const judgeResult = await this.llmFallbackJudge(win, goal)
    if (judgeResult === null) {
      // LLM 未配置或出错，保守处理
      return { outcome: 'unknown', processName: win.processName, windowTitle: win.windowTitle, needsReminder: false }
    }

    // 缓存结果并标记待确认
    const list: 'whitelist' | 'blacklist' = judgeResult.related ? 'whitelist' : 'blacklist'
    await this.profiles.addToList(win.processName, list, goal.topic, true)
    await this.profiles.markPendingSuggestion(win.processName, goal.topic)

    return {
      outcome: judgeResult.related ? 'working' : 'slacking',
      processName: win.processName,
      windowTitle: win.windowTitle,
      needsReminder: !judgeResult.related,
    }
  }

  private async llmFallbackJudge(win: ForegroundWindow, goal: Goal): Promise<SlackJudgeResult | null> {
    // 冷却检查
    const last = this.lastJudgeAt.get(win.processName) ?? 0
    const cooldownMs = DEFAULTS.llmFallbackCooldownMin * 60 * 1000
    if (Date.now() - last < cooldownMs) {
      // 冷却中，查持久化缓存
      const cached = await getLlmCache(win.processName, goal.topic)
      if (cached) return cached
      return null // 冷却中且无缓存，放过
    }

    if (!this.llm.isConfigured('judge')) {
      return null
    }

    const { system, user } = buildSlackJudgePrompt(goal, win)
    const result = await this.llm.judgeSlack(system, user)
    this.lastJudgeAt.set(win.processName, Date.now())
    await saveLlmCache(win.processName, goal.topic, result)
    return result
  }
}
```

- [ ] **Step 2: 写测试 `src/slack/detector.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  getLlmCache: vi.fn(),
  saveLlmCache: vi.fn(),
  getAppProfiles: vi.fn(),
  upsertAppProfile: vi.fn(),
}))

import { AppProfileStore } from './app-profiles'
import { SlackDetector } from './detector'
import { LLMClient, FALLBACK_REPLIES } from '../llm/client'
import type { Goal, LLMConfig } from '../types'

const goal: Goal = {
  id: 'g1', mode: 'study', topic: 'React', startedAt: Date.now(), status: 'active',
}
const config: LLMConfig = {
  judgeModel: 'm', judgeApiKey: 'k', judgeApiBase: 'https://a.com/v1',
  generateModel: 'm', generateApiKey: 'k', generateApiBase: 'https://a.com/v1',
  summaryModel: 'm', summaryApiKey: 'k', summaryApiBase: 'https://a.com/v1',
}

describe('SlackDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('白名单应用判为 working', async () => {
    const { getAppProfiles } = await import('../tauri-bridge')
    vi.mocked(getAppProfiles).mockResolvedValue([
      { processName: 'Code.exe', list: 'whitelist', goalTopic: 'React' },
    ])
    const store = new AppProfileStore()
    await store.load()
    const llm = new LLMClient(config)
    const detector = new SlackDetector(store, llm)
    const result = await detector.detect(
      { processName: 'Code.exe', windowTitle: 'main.ts', pid: 1 },
      goal,
    )
    expect(result.outcome).toBe('working')
    expect(result.needsReminder).toBe(false)
  })

  it('黑名单应用判为 slacking', async () => {
    const { getAppProfiles } = await import('../tauri-bridge')
    vi.mocked(getAppProfiles).mockResolvedValue([
      { processName: 'Bili.exe', list: 'blacklist', goalTopic: 'React' },
    ])
    const store = new AppProfileStore()
    await store.load()
    const llm = new LLMClient(config)
    const detector = new SlackDetector(store, llm)
    const result = await detector.detect(
      { processName: 'Bili.exe', windowTitle: 'B站', pid: 2 },
      goal,
    )
    expect(result.outcome).toBe('slacking')
    expect(result.needsReminder).toBe(true)
  })

  it('unknown 应用走 LLM fallback', async () => {
    const { getAppProfiles, getLlmCache, saveLlmCache, upsertAppProfile } = await import('../tauri-bridge')
    vi.mocked(getAppProfiles).mockResolvedValue([])
    vi.mocked(getLlmCache).mockResolvedValue(null)
    vi.mocked(saveLlmCache).mockResolvedValue(undefined)
    vi.mocked(upsertAppProfile).mockResolvedValue(undefined)

    const store = new AppProfileStore()
    await store.load()
    const llm = new LLMClient(config)
    vi.spyOn(llm, 'judgeSlack').mockResolvedValue({ related: false, reason: '视频网站' })
    const detector = new SlackDetector(store, llm)
    const result = await detector.detect(
      { processName: 'Unknown.exe', windowTitle: '某视频', pid: 3 },
      goal,
    )
    expect(result.outcome).toBe('slacking')
    expect(result.needsReminder).toBe(true)
    expect(saveLlmCache).toHaveBeenCalled()
  })

  it('LLM 未配置时返回 unknown 不误判', async () => {
    const { getAppProfiles, getLlmCache } = await import('../tauri-bridge')
    vi.mocked(getAppProfiles).mockResolvedValue([])
    vi.mocked(getLlmCache).mockResolvedValue(null)
    const store = new AppProfileStore()
    await store.load()
    const llm = new LLMClient({ ...config, judgeModel: '', judgeApiKey: '' })
    const detector = new SlackDetector(store, llm)
    const result = await detector.detect(
      { processName: 'Unknown.exe', windowTitle: 'x', pid: 4 },
      goal,
    )
    expect(result.outcome).toBe('unknown')
    expect(result.needsReminder).toBe(false)
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test`
Expected: detector 测试通过。

- [ ] **Step 4: Commit**

```bash
git add src/slack/detector.ts src/slack/detector.test.ts
git commit -m "feat: add slack detector with whitelist/blacklist/LLM fallback"
```

---

## Task 14: TS — 分级递进提醒 + 赖账处理

**Files:**
- Create: `src/slack/reminder.ts`
- Test: `src/slack/reminder.test.ts`

- [ ] **Step 1: 写 `src/slack/reminder.ts`**

```typescript
import type { Goal, ReminderLevel } from '../types'
import { DEFAULTS } from '../config'
import { LLMClient, FALLBACK_REPLIES } from '../llm/client'
import { buildReminderPrompt } from '../llm/prompts'
import { showNotification } from '../tauri-bridge'

export type ReminderState = {
  /// 当前摸鱼开始时间
  slackStartedAt: number | null
  /// 当前已提醒到第几级（0=未提醒）
  currentLevel: 0 | 1 | 2 | 3
  /// 赖账暂停到何时
  sokaiPausedUntil: number | null
  /// 赖账次数
  sokaiCount: number
}

export function createReminderState(): ReminderState {
  return {
    slackStartedAt: null,
    currentLevel: 0,
    sokaiPausedUntil: null,
    sokaiCount: 0,
  }
}

/// 检查摸鱼是否到达下一个提醒级别
export function checkReminderLevel(state: ReminderState, now: number = Date.now()): ReminderLevel | null {
  // 赖账暂停中不提醒
  if (state.sokaiPausedUntil !== null && now < state.sokaiPausedUntil) {
    return null
  }

  if (state.slackStartedAt === null) return null

  const elapsedSec = (now - state.slackStartedAt) / 1000
  const level1Sec = DEFAULTS.slackLevel1Sec
  const level2Sec = DEFAULTS.slackLevel2Min * 60
  const level3Sec = DEFAULTS.slackLevel3Min * 60

  if (elapsedSec >= level3Sec && state.currentLevel < 3) return 3
  if (elapsedSec >= level2Sec && state.currentLevel < 2) return 2
  if (elapsedSec >= level1Sec && state.currentLevel < 1) return 1
  return null
}

/// 生成提醒话术
export async function generateReminderMessage(
  llm: LLMClient,
  level: ReminderLevel,
  goal: Goal,
): Promise<string> {
  if (!llm.isConfigured('generate')) {
    const fallbacks: Record<ReminderLevel, string> = {
      1: FALLBACK_REPLIES.reminderLevel1,
      2: FALLBACK_REPLIES.reminderLevel2,
      3: FALLBACK_REPLIES.reminderLevel3,
    }
    return fallbacks[level]
  }
  const { system, user } = buildReminderPrompt(level, goal)
  try {
    return await llm.chat(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      'generate',
    )
  } catch {
    const fallbacks: Record<ReminderLevel, string> = {
      1: FALLBACK_REPLIES.reminderLevel1,
      2: FALLBACK_REPLIES.reminderLevel2,
      3: FALLBACK_REPLIES.reminderLevel3,
    }
    return fallbacks[level]
  }
}

/// 执行提醒（生成话术 + 展示）
export async function executeReminder(
  llm: LLMClient,
  level: ReminderLevel,
  goal: Goal,
): Promise<{ message: string; notified: boolean }> {
  const message = await generateReminderMessage(llm, level, goal)
  // 第 3 级才弹系统通知
  if (level === 3) {
    await showNotification('该回来了！', message)
    return { message, notified: true }
  }
  return { message, notified: false }
}

/// 处理赖账
export function handleSokai(state: ReminderState, minutes: number, now: number = Date.now()): ReminderState {
  return {
    ...state,
    sokaiPausedUntil: now + minutes * 60 * 1000,
    sokaiCount: state.sokaiCount + 1,
  }
}

/// 重置摸鱼计时（用户回到正事）
export function resetSlack(state: ReminderState): ReminderState {
  return {
    ...state,
    slackStartedAt: null,
    currentLevel: 0,
    sokaiPausedUntil: null,
  }
}

/// 标记摸鱼开始
export function markSlackStart(state: ReminderState, now: number = Date.now()): ReminderState {
  if (state.slackStartedAt !== null) return state // 已经在计时
  return { ...state, slackStartedAt: now }
}

/// 更新已提醒级别
export function updateLevel(state: ReminderState, level: ReminderLevel): ReminderState {
  return { ...state, currentLevel: level }
}
```

- [ ] **Step 2: 写测试 `src/slack/reminder.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  showNotification: vi.fn(),
  getAppProfiles: vi.fn(),
  upsertAppProfile: vi.fn(),
  getLlmCache: vi.fn(),
  saveLlmCache: vi.fn(),
}))

import {
  createReminderState,
  checkReminderLevel,
  handleSokai,
  resetSlack,
  markSlackStart,
  updateLevel,
  generateReminderMessage,
} from './reminder'
import { LLMClient } from '../llm/client'
import type { Goal, LLMConfig } from '../types'

const goal: Goal = { id: 'g1', mode: 'study', topic: 'React', startedAt: Date.now(), status: 'active' }
const config: LLMConfig = {
  judgeModel: 'm', judgeApiKey: 'k', judgeApiBase: 'https://a.com/v1',
  generateModel: 'm', generateApiKey: 'k', generateApiBase: 'https://a.com/v1',
  summaryModel: 'm', summaryApiKey: 'k', summaryApiBase: 'https://a.com/v1',
}

describe('reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('30 秒触发 1 级', () => {
    const state = markSlackStart(createReminderState(), 1000)
    const level = checkReminderLevel(state, 1000 + 31 * 1000)
    expect(level).toBe(1)
  })

  it('3 分钟触发 2 级', () => {
    const state = updateLevel(markSlackStart(createReminderState(), 1000), 1)
    const level = checkReminderLevel(state, 1000 + 181 * 1000)
    expect(level).toBe(2)
  })

  it('10 分钟触发 3 级', () => {
    const state = updateLevel(updateLevel(markSlackStart(createReminderState(), 1000), 1), 2)
    const level = checkReminderLevel(state, 1000 + 601 * 1000)
    expect(level).toBe(3)
  })

  it('赖账暂停中不提醒', () => {
    let state = markSlackStart(createReminderState(), 1000)
    state = handleSokai(state, 5, 2000) // 赖账 5 分钟，暂停到 302000
    const level = checkReminderLevel(state, 100000) // 在暂停期内
    expect(level).toBeNull()
  })

  it('赖账后到点恢复提醒', () => {
    let state = markSlackStart(createReminderState(), 1000)
    state = handleSokai(state, 5, 2000) // 暂停到 302000
    const level = checkReminderLevel(state, 400000) // 超过暂停期
    expect(level).not.toBeNull()
  })

  it('resetSlack 清空计时', () => {
    const state = resetSlack(markSlackStart(createReminderState()))
    expect(state.slackStartedAt).toBeNull()
    expect(state.currentLevel).toBe(0)
  })

  it('赖账次数累加', () => {
    let state = createReminderState()
    state = handleSokai(state, 5)
    state = handleSokai(state, 3)
    expect(state.sokaiCount).toBe(2)
  })

  it('LLM 未配置时用兜底话术', async () => {
    const llm = new LLMClient({ ...config, generateModel: '', generateApiKey: '' })
    const msg = await generateReminderMessage(llm, 1, goal)
    expect(msg).toBeTruthy()
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test`
Expected: reminder 测试通过。

- [ ] **Step 4: Commit**

```bash
git add src/slack/reminder.ts src/slack/reminder.test.ts
git commit -m "feat: add tiered reminder system with sokai (excuse) handling"
```

---

## Task 15: TS — 陪伴触发器与仲裁器

**Files:**
- Create: `src/companion/triggers.ts`
- Create: `src/companion/arbiter.ts`
- Test: `src/companion/arbiter.test.ts`

- [ ] **Step 1: 写 `src/companion/triggers.ts`**

```typescript
import type { Mode, ForegroundWindow } from '../types'
import { DEFAULTS } from '../config'
import { AppProfileStore } from '../slack/app-profiles'

export type CompanionEvent =
  | { type: 'window_switch_interesting'; window: ForegroundWindow }
  | { type: 'idle_started'; idleMinutes: number }
  | { type: 'idle_ended' }
  | { type: 'long_same_activity'; processName: string; minutes: number }
  | { type: 'fallback_timer' }

export class CompanionTriggerEngine {
  private fallbackIntervalId: number | null = null
  private activityStartAt: Map<string, number> = new Map() // processName -> 开始时间

  constructor(
    private profiles: AppProfileStore,
    private onEvent: (event: CompanionEvent) => void,
  ) {}

  /// 处理窗口切换事件
  handleWindowSwitch(win: ForegroundWindow, mode: Mode): void {
    if (mode !== 'companion' && mode !== 'idle') return

    // 检查长时活动（前一个应用用了多久）
    const now = Date.now()
    for (const [proc, start] of this.activityStartAt) {
      const minutes = (now - start) / 60000
      if (minutes >= DEFAULTS.longActivityThresholdMin) {
        this.onEvent({ type: 'long_same_activity', processName: proc, minutes })
      }
    }
    this.activityStartAt.set(win.processName, now)

    // 检查是否切到"有趣"的应用（全局黑名单）
    const list = this.profiles.lookup(win.processName)
    if (list === 'blacklist') {
      this.onEvent({ type: 'window_switch_interesting', window: win })
    }
  }

  /// 处理空闲状态转换
  handleIdleTransition(transition: 'idle_started' | 'idle_ended', idleMinutes?: number): void {
    if (transition === 'idle_started') {
      this.onEvent({ type: 'idle_started', idleMinutes: idleMinutes ?? 0 })
    } else {
      this.onEvent({ type: 'idle_ended' })
    }
  }

  /// 启动定时兜底触发器
  startFallbackTimer(intervalMin: number = DEFAULTS.pollIntervalSec * 12): void {
    // 默认兜底间隔由 CompanionConfig 提供，这里用传入值
    this.stopFallbackTimer()
    this.fallbackIntervalId = window.setInterval(() => {
      this.onEvent({ type: 'fallback_timer' })
    }, intervalMin * 60 * 1000)
  }

  stopFallbackTimer(): void {
    if (this.fallbackIntervalId !== null) {
      clearInterval(this.fallbackIntervalId)
      this.fallbackIntervalId = null
    }
  }
}
```

- [ ] **Step 2: 写 `src/companion/arbiter.ts`**

```typescript
import type { CompanionConfig, Mode, ForegroundWindow } from '../types'
import type { CompanionEvent } from './triggers'
import { LLMClient, FALLBACK_REPLIES } from '../llm/client'
import { buildCompanionPrompt } from '../llm/prompts'

export type ArbiterContext = {
  mode: Mode
  lastSpokeAt: number
  cooldownUntil: number
  config: CompanionConfig
  currentWindow?: ForegroundWindow
  isIdle: boolean
  idleMinutes?: number
}

export type ArbiterDecision =
  | { shouldSpeak: true; prompt: { system: string; user: string } }
  | { shouldSpeak: false; reason: string }

/// 仲裁：决定是否说话
export function arbitrate(event: CompanionEvent, ctx: ArbiterContext): ArbiterDecision {
  // 1. 模式检查：只在陪伴/空闲模式说话
  if (ctx.mode !== 'companion' && ctx.mode !== 'idle') {
    return { shouldSpeak: false, reason: '当前模式不触发陪伴说话' }
  }

  // 2. 配置开关
  if (!ctx.config.enabled) {
    return { shouldSpeak: false, reason: '陪伴说话已关闭' }
  }

  // 3. 冷却检查
  const now = Date.now()
  if (now < ctx.cooldownUntil) {
    return { shouldSpeak: false, reason: '冷却中' }
  }

  // 4. 概率检查（fallback_timer 用较低概率，事件驱动用配置概率）
  const probability = event.type === 'fallback_timer' ? ctx.config.triggerProbability * 0.5 : ctx.config.triggerProbability
  if (Math.random() > probability) {
    return { shouldSpeak: false, reason: '概率未通过' }
  }

  // 5. 构建 prompt
  const prompt = buildCompanionPrompt({
    windowTitle: ctx.currentWindow?.windowTitle,
    processName: ctx.currentWindow?.processName,
    isIdle: ctx.isIdle,
    idleMinutes: ctx.idleMinutes,
  })

  return { shouldSpeak: true, prompt }
}

/// 生成陪伴话语
export async function generateCompanionMessage(
  llm: LLMClient,
  prompt: { system: string; user: string },
): Promise<string> {
  if (!llm.isConfigured('generate')) {
    return FALLBACK_REPLIES.companionGeneric
  }
  try {
    return await llm.chat(
      [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      'generate',
    )
  } catch {
    return FALLBACK_REPLIES.companionGeneric
  }
}

/// 计算新的冷却截止时间
export function computeNewCooldown(config: CompanionConfig): number {
  return Date.now() + config.cooldownMinutes * 60 * 1000
}
```

- [ ] **Step 3: 写测试 `src/companion/arbiter.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  getAppProfiles: vi.fn(),
  upsertAppProfile: vi.fn(),
  getLlmCache: vi.fn(),
  saveLlmCache: vi.fn(),
}))

import { arbitrate, generateCompanionMessage, computeNewCooldown } from './arbiter'
import { LLMClient } from '../llm/client'
import type { CompanionConfig, LLMConfig } from '../types'

const config: CompanionConfig = {
  enabled: true,
  frequency: 'normal',
  cooldownMinutes: 15,
  triggerProbability: 1, // 测试中 100% 触发
  fallbackIntervalMinutes: 45,
}
const llmConfig: LLMConfig = {
  judgeModel: 'm', judgeApiKey: 'k', judgeApiBase: 'https://a.com/v1',
  generateModel: 'm', generateApiKey: 'k', generateApiBase: 'https://a.com/v1',
  summaryModel: 'm', summaryApiKey: 'k', summaryApiBase: 'https://a.com/v1',
}

describe('arbiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('非陪伴模式不说话', () => {
    const decision = arbitrate(
      { type: 'idle_started', idleMinutes: 5 },
      { mode: 'study', lastSpokeAt: 0, cooldownUntil: 0, config, isIdle: false },
    )
    expect(decision.shouldSpeak).toBe(false)
  })

  it('冷却中不说话', () => {
    const decision = arbitrate(
      { type: 'idle_started', idleMinutes: 5 },
      { mode: 'companion', lastSpokeAt: 0, cooldownUntil: Date.now() + 60000, config, isIdle: false },
    )
    expect(decision.shouldSpeak).toBe(false)
  })

  it('陪伴模式 + 概率通过 → 说话', () => {
    const decision = arbitrate(
      { type: 'idle_started', idleMinutes: 5 },
      { mode: 'companion', lastSpokeAt: 0, cooldownUntil: 0, config, isIdle: true, idleMinutes: 5 },
    )
    expect(decision.shouldSpeak).toBe(true)
  })

  it('disabled 时不说话', () => {
    const decision = arbitrate(
      { type: 'idle_started', idleMinutes: 5 },
      { mode: 'companion', lastSpokeAt: 0, cooldownUntil: 0, config: { ...config, enabled: false }, isIdle: false },
    )
    expect(decision.shouldSpeak).toBe(false)
  })

  it('computeNewCooldown 正确计算', () => {
    const before = Date.now()
    const cd = computeNewCooldown(config)
    expect(cd).toBeGreaterThanOrEqual(before + 14 * 60000)
    expect(cd).toBeLessThanOrEqual(before + 16 * 60000)
  })

  it('LLM 未配置用兜底话术', async () => {
    const llm = new LLMClient({ ...llmConfig, generateModel: '', generateApiKey: '' })
    const msg = await generateCompanionMessage(llm, { system: 's', user: 'u' })
    expect(msg).toBeTruthy()
  })
})
```

- [ ] **Step 4: 运行测试**

Run: `pnpm test`
Expected: arbiter 测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/companion/triggers.ts src/companion/arbiter.ts src/companion/arbiter.test.ts
git commit -m "feat: add companion triggers and anti-spam arbiter"
```

---

## Task 16: TS — 日志聚合与总结生成

**Files:**
- Create: `src/storage/log-aggregator.ts`
- Create: `src/summary/daily.ts`
- Create: `src/summary/weekly.ts`
- Test: `src/storage/log-aggregator.test.ts`

- [ ] **Step 1: 写 `src/storage/log-aggregator.ts`**

```typescript
import type { LogEvent } from '../types'

export type AggregatedDay = {
  date: string
  appTimeDistribution: Record<string, number> // processName -> minutes
  slackCount: number
  sokaiCount: number
  sokaiTotalMinutes: number
  goals: Array<{ topic: string; mode: string; completed: boolean; minutes: number }>
}

/// 聚合一天的事件为结构化数据
export function aggregateDay(events: LogEvent[], date: string): AggregatedDay {
  const appTime: Record<string, number> = {}
  let slackCount = 0
  let sokaiCount = 0
  let sokaiTotalMinutes = 0
  const goalMap = new Map<string, { topic: string; mode: string; startedAt: number; endedAt?: number; completed: boolean }>()

  // 按时间排序
  const sorted = [...events].sort((a, b) => a.ts - b.ts)

  for (const evt of sorted) {
    switch (evt.type) {
      case 'window_switch': {
        if (evt.processName) {
          appTime[evt.processName] = (appTime[evt.processName] ?? 0)
        }
        break
      }
      case 'slack_detected':
        slackCount++
        break
      case 'sokai_yila':
        sokaiCount++
        if (evt.data?.minutes) {
          sokaiTotalMinutes += evt.data.minutes as number
        }
        break
      case 'goal_started':
        if (evt.data?.goal) {
          const g = evt.data.goal as { id: string; topic: string; mode: string }
          goalMap.set(g.id, { topic: g.topic, mode: g.mode, startedAt: evt.ts, completed: false })
        }
        break
      case 'goal_ended':
        if (evt.data?.goal) {
          const g = evt.data.goal as { id: string }
          const existing = goalMap.get(g.id)
          if (existing) {
            existing.endedAt = evt.ts
            existing.completed = true
          }
        }
        break
    }
  }

  // 计算应用时长：用 window_switch 事件间隔估算
  const windowEvents = sorted.filter((e) => e.type === 'window_switch')
  for (let i = 0; i < windowEvents.length; i++) {
    const curr = windowEvents[i]
    const next = windowEvents[i + 1]
    const endTime = next ? next.ts : curr.ts + 60000 // 最后一个算 1 分钟
    const minutes = Math.max(1, Math.round((endTime - curr.ts) / 60000))
    if (curr.processName) {
      appTime[curr.processName] = (appTime[curr.processName] ?? 0) + minutes
    }
  }

  // 计算目标时长
  const goals = Array.from(goalMap.values()).map((g) => ({
    topic: g.topic,
    mode: g.mode,
    completed: g.completed,
    minutes: g.endedAt ? Math.round((g.endedAt - g.startedAt) / 60000) : Math.round((Date.now() - g.startedAt) / 60000),
  }))

  return {
    date,
    appTimeDistribution: appTime,
    slackCount,
    sokaiCount,
    sokaiTotalMinutes,
    goals,
  }
}

/// 获取本周起始日（周日为一周开始）
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}
```

- [ ] **Step 2: 写测试 `src/storage/log-aggregator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { aggregateDay, getWeekStart } from './log-aggregator'
import type { LogEvent } from '../types'

describe('log-aggregator', () => {
  it('统计摸鱼次数', () => {
    const events: LogEvent[] = [
      { ts: 1000, type: 'slack_detected', mode: 'study' },
      { ts: 2000, type: 'slack_detected', mode: 'study' },
    ]
    const result = aggregateDay(events, '2026-07-09')
    expect(result.slackCount).toBe(2)
  })

  it('统计赖账次数和时长', () => {
    const events: LogEvent[] = [
      { ts: 1000, type: 'sokai_yila', mode: 'study', data: { minutes: 5 } },
      { ts: 2000, type: 'sokai_yila', mode: 'study', data: { minutes: 3 } },
    ]
    const result = aggregateDay(events, '2026-07-09')
    expect(result.sokaiCount).toBe(2)
    expect(result.sokaiTotalMinutes).toBe(8)
  })

  it('统计目标', () => {
    const events: LogEvent[] = [
      { ts: 1000, type: 'goal_started', mode: 'study', data: { goal: { id: 'g1', topic: 'React', mode: 'study' } } },
      { ts: 61000, type: 'goal_ended', mode: 'study', data: { goal: { id: 'g1' } } },
    ]
    const result = aggregateDay(events, '2026-07-09')
    expect(result.goals).toHaveLength(1)
    expect(result.goals[0].topic).toBe('React')
    expect(result.goals[0].completed).toBe(true)
    expect(result.goals[0].minutes).toBe(1)
  })

  it('统计应用时长', () => {
    const events: LogEvent[] = [
      { ts: 1000, type: 'window_switch', mode: 'study', processName: 'Code.exe' },
      { ts: 61000, type: 'window_switch', mode: 'study', processName: 'Bili.exe' },
      { ts: 121000, type: 'window_switch', mode: 'study', processName: 'Code.exe' },
    ]
    const result = aggregateDay(events, '2026-07-09')
    expect(result.appTimeDistribution['Code.exe']).toBeGreaterThanOrEqual(1)
    expect(result.appTimeDistribution['Bili.exe']).toBe(1)
  })

  it('getWeekStart 返回周日日期', () => {
    // 2026-07-09 是周四
    const weekStart = getWeekStart(new Date('2026-07-09T12:00:00'))
    expect(weekStart).toBe('2026-07-05') // 周日
  })
})
```

- [ ] **Step 3: 写 `src/summary/daily.ts`**

```typescript
import type { LLMClient } from '../llm/client'
import { buildDailySummaryPrompt } from '../llm/prompts'
import { readLogs, saveDailySummary, getDailySummary } from '../tauri-bridge'
import { aggregateDay } from '../storage/log-aggregator'
import type { DailySummary } from '../types'

/// 生成每日总结
export async function generateDailySummary(
  llm: LLMClient,
  date: string,
): Promise<DailySummary> {
  const events = await readLogs(date, date)
  const aggregated = aggregateDay(events, date)

  let comment = '（无活动数据）'
  if (llm.isConfigured('summary') && events.length > 0) {
    const { system, user } = buildDailySummaryPrompt(date, aggregated)
    try {
      comment = await llm.chat(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        'summary',
      )
    } catch {
      comment = '总结生成失败'
    }
  } else if (events.length > 0) {
    comment = `今天用了 ${Object.keys(aggregated.appTimeDistribution).length} 个应用，摸鱼 ${aggregated.slackCount} 次。`
  }

  const summary: DailySummary = {
    date,
    appTimeDistribution: aggregated.appTimeDistribution,
    slackCount: aggregated.slackCount,
    sokaiCount: aggregated.sokaiCount,
    sokaiTotalMinutes: aggregated.sokaiTotalMinutes,
    goals: aggregated.goals,
    comment,
    generatedAt: Date.now(),
  }

  await saveDailySummary(date, JSON.stringify(summary))
  return summary
}

/// 读取已存的每日总结
export async function loadDailySummary(date: string): Promise<DailySummary | null> {
  const data = await getDailySummary(date)
  if (!data) return null
  return JSON.parse(data) as DailySummary
}
```

- [ ] **Step 4: 写 `src/summary/weekly.ts`**

```typescript
import type { LLMClient } from '../llm/client'
import { saveWeeklySummary } from '../tauri-bridge'
import { getWeekStart } from '../storage/log-aggregator'
import { generateDailySummary, loadDailySummary } from './daily'
import type { WeeklySummary, DailySummary } from '../types'

/// 生成每周总结
export async function generateWeeklySummary(
  llm: LLMClient,
  weekStartDate: string,
): Promise<WeeklySummary> {
  const start = new Date(weekStartDate)
  const dailySummaries: DailySummary[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    let summary = await loadDailySummary(dateStr)
    if (!summary) {
      summary = await generateDailySummary(llm, dateStr)
    }
    dailySummaries.push(summary)
  }

  // 聚合周数据生成点评
  const totalSlack = dailySummaries.reduce((sum, d) => sum + d.slackCount, 0)
  const totalSokai = dailySummaries.reduce((sum, d) => sum + d.sokaiCount, 0)
  const completedGoals = dailySummaries.reduce((sum, d) => sum + d.goals.filter((g) => g.completed).length, 0)

  let comment = `本周摸鱼 ${totalSlack} 次，赖账 ${totalSokai} 次，完成目标 ${completedGoals} 个。`
  if (llm.isConfigured('summary')) {
    try {
      comment = await llm.chat(
        [{
          role: 'system',
          content: '你是一个周报总结助手。根据本周每日数据生成一段简短周报点评。',
        }, {
          role: 'user',
          content: JSON.stringify({ totalSlack, totalSokai, completedGoals, dailySummaries: dailySummaries.map((d) => ({ date: d.date, slackCount: d.slackCount, goals: d.goals })) }),
        }],
        'summary',
      )
    } catch {
      // 保留默认 comment
    }
  }

  const summary: WeeklySummary = {
    weekStart: weekStartDate,
    dailySummaries,
    comment,
    generatedAt: Date.now(),
  }

  await saveWeeklySummary(weekStartDate, JSON.stringify(summary))
  return summary
}

/// 获取本周起始日
export function getCurrentWeekStart(): string {
  return getWeekStart(new Date())
}
```

- [ ] **Step 5: 运行测试**

Run: `pnpm test`
Expected: log-aggregator 测试通过。

- [ ] **Step 6: Commit**

```bash
git add src/storage/log-aggregator.ts src/storage/log-aggregator.test.ts src/summary/daily.ts src/summary/weekly.ts
git commit -m "feat: add log aggregation and daily/weekly summary generation"
```

---

## Task 17: TS — 启动恢复

**Files:**
- Create: `src/recovery/runtime-state.ts`
- Test: `src/recovery/runtime-state.test.ts`

- [ ] **Step 1: 写 `src/recovery/runtime-state.ts`**

```typescript
import { getRuntimeState, getActiveGoal, initDatabase, getAppProfiles } from '../tauri-bridge'
import { AppProfileStore } from '../slack/app-profiles'
import type { ModeMachineState } from '../state/mode-machine'
import { createInitialState } from '../state/mode-machine'
import type { CompanionConfig, Goal, PersonaConfig, LLMConfig } from '../types'
import { DEFAULT_COMPANION_CONFIG, DEFAULT_PERSONA, DEFAULT_LLM_CONFIG } from '../config'

export type RecoveredState = {
  modeMachine: ModeMachineState
  activeGoal: Goal | null
  profiles: AppProfileStore
  companionConfig: CompanionConfig
  persona: PersonaConfig
  llmConfig: LLMConfig
  needsGoalTimeoutPrompt: boolean
}

/// 启动时恢复状态
export async function recoverState(): Promise<RecoveredState> {
  // 1. 初始化数据库
  await initDatabase()

  // 2. 读取 runtime_state
  const runtimeState = await getRuntimeState()

  // 3. 读取活跃目标
  let activeGoal: Goal | null = null
  let needsGoalTimeoutPrompt = false
  if (runtimeState.activeGoalId) {
    activeGoal = await getActiveGoal(runtimeState.activeGoalId)
    if (activeGoal && activeGoal.plannedMinutes) {
      const elapsed = (Date.now() - activeGoal.startedAt) / 60000
      if (elapsed > activeGoal.plannedMinutes) {
        needsGoalTimeoutPrompt = true
      }
    }
  }

  // 4. 加载应用画像
  const profiles = new AppProfileStore()
  await profiles.load(activeGoal?.topic)

  // 5. 构建 mode machine 状态
  const modeMachine: ModeMachineState = {
    ...createInitialState(),
    mode: runtimeState.mode,
    activeGoal,
    restReturnMode: null,
    restUntil: null,
  }

  return {
    modeMachine,
    activeGoal,
    profiles,
    companionConfig: DEFAULT_COMPANION_CONFIG,
    persona: DEFAULT_PERSONA,
    llmConfig: DEFAULT_LLM_CONFIG,
    needsGoalTimeoutPrompt,
  }
}
```

- [ ] **Step 2: 写测试 `src/recovery/runtime-state.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../tauri-bridge', () => ({
  initDatabase: vi.fn(),
  getRuntimeState: vi.fn(),
  getActiveGoal: vi.fn(),
  getAppProfiles: vi.fn(),
  upsertAppProfile: vi.fn(),
  getLlmCache: vi.fn(),
  saveLlmCache: vi.fn(),
}))

import { recoverState } from './runtime-state'
import { initDatabase, getRuntimeState, getActiveGoal, getAppProfiles } from '../tauri-bridge'

describe('recoverState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常恢复 idle 状态', async () => {
    vi.mocked(initDatabase).mockResolvedValue('')
    vi.mocked(getRuntimeState).mockResolvedValue({
      mode: 'idle', activeGoalId: undefined,
      companionCooldownUntil: 0, lastSpokeAt: undefined,
    })
    vi.mocked(getAppProfiles).mockResolvedValue([])
    const result = await recoverState()
    expect(result.modeMachine.mode).toBe('idle')
    expect(result.activeGoal).toBeNull()
    expect(result.needsGoalTimeoutPrompt).toBe(false)
  })

  it('有超时目标时提示', async () => {
    vi.mocked(initDatabase).mockResolvedValue('')
    vi.mocked(getRuntimeState).mockResolvedValue({
      mode: 'study', activeGoalId: 'g1',
      companionCooldownUntil: 0, lastSpokeAt: undefined,
    })
    vi.mocked(getActiveGoal).mockResolvedValue({
      id: 'g1', mode: 'study', topic: 'React', plannedMinutes: 30,
      startedAt: Date.now() - 60 * 60000, status: 'active', // 1 小时前开始，超时了
    })
    vi.mocked(getAppProfiles).mockResolvedValue([])
    const result = await recoverState()
    expect(result.needsGoalTimeoutPrompt).toBe(true)
    expect(result.activeGoal?.topic).toBe('React')
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test`
Expected: recovery 测试通过。

- [ ] **Step 4: Commit**

```bash
git add src/recovery/runtime-state.ts src/recovery/runtime-state.test.ts
git commit -m "feat: add startup state recovery from SQLite"
```

---

## Task 18: UI — 主界面与核心组件

**Files:**
- Create: `src/App.vue`（重写）
- Create: `src/components/ChatPanel.vue`
- Create: `src/components/MessageInput.vue`
- Create: `src/components/StatusBar.vue`
- Create: `src/components/TodaySummary.vue`
- Create: `src/components/SettingsPanel.vue`

> 注：UI 组件测试在 Task 19。本 task 先实现组件，确保能渲染和交互。

- [ ] **Step 1: 写 `src/components/ChatPanel.vue`**

```vue
<script setup lang="ts">
import type { LogEvent } from '../types'

defineProps<{
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; ts: number }>
}>()
</script>

<template>
  <div class="chat-panel">
    <div v-for="(msg, i) in messages" :key="i" :class="['message', msg.role]">
      <span v-if="msg.role === 'system'" class="system-text">{{ msg.content }}</span>
      <div v-else :class="['bubble', msg.role]">{{ msg.content }}</div>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  height: 300px;
  overflow-y: auto;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
}
.message { margin-bottom: 8px; }
.message.user { text-align: right; }
.message.assistant { text-align: left; }
.bubble {
  display: inline-block;
  padding: 8px 12px;
  border-radius: 12px;
  max-width: 70%;
}
.bubble.user { background: #4a90d9; color: white; }
.bubble.assistant { background: #f0f0f0; color: #333; }
.system-text { color: #999; font-size: 0.85em; font-style: italic; }
</style>
```

- [ ] **Step 2: 写 `src/components/MessageInput.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ send: [text: string] }>()
const text = ref('')

function handleSend() {
  const t = text.value.trim()
  if (!t) return
  emit('send', t)
  text.value = ''
}
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="message-input">
    <input
      v-model="text"
      @keydown="handleKeydown"
      placeholder="说点什么…"
    />
    <button @click="handleSend">发送</button>
  </div>
</template>

<style scoped>
.message-input { display: flex; gap: 8px; padding: 8px 0; }
input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
button { padding: 8px 16px; background: #4a90d9; color: white; border: none; border-radius: 4px; cursor: pointer; }
</style>
```

- [ ] **Step 3: 写 `src/components/StatusBar.vue`**

```vue
<script setup lang="ts">
import type { Mode, Goal } from '../types'

defineProps<{
  mode: Mode
  activeGoal: Goal | null
}>()

const emit = defineEmits<{
  switchMode: [mode: 'companion' | 'study' | 'work' | 'rest']
  endGoal: []
}>()
</script>

<template>
  <div class="status-bar">
    <span class="mode-label">模式: {{ mode }}</span>
    <span v-if="activeGoal" class="goal-label">
      | 目标: {{ activeGoal.topic }}
      ({{ Math.floor((Date.now() - activeGoal.startedAt) / 60000) }}m
      <template v-if="activeGoal.plannedMinutes">/ {{ activeGoal.plannedMinutes }}m</template>)
    </span>
    <div class="mode-buttons">
      <button @click="emit('switchMode', 'companion')" :class="{ active: mode === 'companion' }">陪伴</button>
      <button @click="emit('switchMode', 'study')" :class="{ active: mode === 'study' }">学习</button>
      <button @click="emit('switchMode', 'work')" :class="{ active: mode === 'work' }">工作</button>
      <button @click="emit('switchMode', 'rest')" :class="{ active: mode === 'rest' }">休息</button>
      <button v-if="activeGoal" @click="emit('endGoal')" class="end-btn">结束</button>
    </div>
  </div>
</template>

<style scoped>
.status-bar { display: flex; align-items: center; gap: 12px; padding: 8px; border-top: 1px solid #ddd; }
.mode-label { font-weight: bold; }
.goal-label { color: #666; }
.mode-buttons { margin-left: auto; display: flex; gap: 4px; }
button { padding: 4px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: white; }
button.active { background: #4a90d9; color: white; }
.end-btn { color: #d94a4a; }
</style>
```

- [ ] **Step 4: 写 `src/components/TodaySummary.vue`**

```vue
<script setup lang="ts">
import type { DailySummary } from '../types'

defineProps<{
  summary: DailySummary | null
  slackCount: number
  workMinutes: number
  goalProgress: number | null
}>()
</script>

<template>
  <div class="today-summary" @click="$emit('viewFull')">
    <span>摸鱼 {{ slackCount }} 次</span>
    <span>| {{ workMinutes }}m</span>
    <span v-if="goalProgress !== null">| 目标进度 {{ Math.round(goalProgress * 100) }}%</span>
  </div>
</template>

<style scoped>
.today-summary { padding: 8px; color: #666; font-size: 0.9em; cursor: pointer; }
.today-summary span { margin-right: 8px; }
</style>
```

- [ ] **Step 5: 写 `src/components/SettingsPanel.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { PersonaConfig, LLMConfig, CompanionConfig, CompanionFrequency } from '../types'

const props = defineProps<{
  persona: PersonaConfig
  llmConfig: LLMConfig
  companionConfig: CompanionConfig
}>()

const emit = defineEmits<{
  save: [{ persona: PersonaConfig; llmConfig: LLMConfig; companionConfig: CompanionConfig }]
}>()

const localPersona = ref({ ...props.persona })
const localLLM = ref({ ...props.llmConfig })
const localCompanion = ref({ ...props.companionConfig })

function save() {
  emit('save', {
    persona: { ...localPersona.value },
    llmConfig: { ...localLLM.value },
    companionConfig: { ...localCompanion.value },
  })
}
</script>

<template>
  <div class="settings-panel">
    <h3>设置</h3>

    <section>
      <h4>角色</h4>
      <label>角色名 <input v-model="localPersona.characterName" /></label>
      <label>软件名 <input v-model="localPersona.appName" /></label>
    </section>

    <section>
      <h4>LLM 配置</h4>
      <label>判断模型 <input v-model="localLLM.judgeModel" placeholder="gpt-4o-mini" /></label>
      <label>API Key <input v-model="localLLM.judgeApiKey" type="password" /></label>
      <label>API Base <input v-model="localLLM.judgeApiBase" /></label>
      <label>生成模型 <input v-model="localLLM.generateModel" placeholder="gpt-4o-mini" /></label>
      <label>API Key <input v-model="localLLM.generateApiKey" type="password" /></label>
      <label>API Base <input v-model="localLLM.generateApiBase" /></label>
      <label>总结模型 <input v-model="localLLM.summaryModel" placeholder="gpt-4o" /></label>
      <label>API Key <input v-model="localLLM.summaryApiKey" type="password" /></label>
      <label>API Base <input v-model="localLLM.summaryApiBase" /></label>
    </section>

    <section>
      <h4>陪伴</h4>
      <label>
        频率
        <select v-model="localCompanion.frequency">
          <option value="quiet">安静</option>
          <option value="normal">普通</option>
          <option value="chatty">话痨</option>
        </select>
      </label>
      <label>冷却(分钟) <input v-model.number="localCompanion.cooldownMinutes" type="number" /></label>
      <label>触发概率 <input v-model.number="localCompanion.triggerProbability" type="number" step="0.1" min="0" max="1" /></label>
    </section>

    <button @click="save">保存</button>
  </div>
</template>

<style scoped>
.settings-panel { padding: 16px; max-width: 500px; }
section { margin-bottom: 16px; }
label { display: block; margin-bottom: 4px; }
input, select { width: 100%; padding: 4px; margin-top: 2px; }
button { padding: 8px 16px; background: #4a90d9; color: white; border: none; border-radius: 4px; cursor: pointer; }
</style>
```

- [ ] **Step 6: 重写 `src/App.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ChatPanel from './components/ChatPanel.vue'
import MessageInput from './components/MessageInput.vue'
import StatusBar from './components/StatusBar.vue'
import TodaySummary from './components/TodaySummary.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import type { Mode, Goal, LogEvent, ChatLLMResponse, PersonaConfig, LLMConfig, CompanionConfig } from './types'
import { DEFAULT_PERSONA, DEFAULT_LLM_CONFIG, DEFAULT_COMPANION_CONFIG } from './config'

// 状态（后续 task 连接真实逻辑，先用占位）
const mode = ref<Mode>('idle')
const activeGoal = ref<Goal | null>(null)
const messages = ref<Array<{ role: 'user' | 'assistant' | 'system'; content: string; ts: number }>>([])
const showSettings = ref(false)
const persona = ref<PersonaConfig>({ ...DEFAULT_PERSONA })
const llmConfig = ref<LLMConfig>({ ...DEFAULT_LLM_CONFIG })
const companionConfig = ref<CompanionConfig>({ ...DEFAULT_COMPANION_CONFIG })
const slackCount = ref(0)
const workMinutes = ref(0)
const goalProgress = ref<number | null>(null)

const charName = computed(() => persona.value.characterName)

onMounted(async () => {
  messages.value.push({ role: 'system', content: `${charName.value} 已启动`, ts: Date.now() })
})

function handleSend(text: string) {
  messages.value.push({ role: 'user', content: text, ts: Date.now() })
  // TODO: 连接 LLM 和意图处理（后续 task）
}

function handleSwitchMode(m: 'companion' | 'study' | 'work' | 'rest') {
  // TODO: 连接状态机（后续 task）
  mode.value = m
  messages.value.push({ role: 'system', content: `切换到 ${m} 模式`, ts: Date.now() })
}

function handleEndGoal() {
  activeGoal.value = null
  mode.value = 'idle'
  messages.value.push({ role: 'system', content: '目标已结束', ts: Date.now() })
}

function handleSaveSettings(s: { persona: PersonaConfig; llmConfig: LLMConfig; companionConfig: CompanionConfig }) {
  persona.value = s.persona
  llmConfig.value = s.llmConfig
  companionConfig.value = s.companionConfig
  showSettings.value = false
}
</script>

<template>
  <div class="app">
    <header>
      <span class="char-name">{{ charName }}</span>
      <button class="settings-btn" @click="showSettings = !showSettings">⚙</button>
    </header>

    <SettingsPanel
      v-if="showSettings"
      :persona="persona"
      :llm-config="llmConfig"
      :companion-config="companionConfig"
      @save="handleSaveSettings"
    />

    <ChatPanel :messages="messages" />

    <MessageInput @send="handleSend" />

    <StatusBar
      :mode="mode"
      :active-goal="activeGoal"
      @switch-mode="handleSwitchMode"
      @end-goal="handleEndGoal"
    />

    <TodaySummary
      :summary="null"
      :slack-count="slackCount"
      :work-minutes="workMinutes"
      :goal-progress="goalProgress"
    />
  </div>
</template>

<style scoped>
.app { max-width: 600px; margin: 0 auto; padding: 16px; font-family: sans-serif; }
header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
.char-name { font-size: 1.2em; font-weight: bold; }
.settings-btn { background: none; border: none; font-size: 1.2em; cursor: pointer; }
</style>
```

- [ ] **Step 7: 验证应用能启动**

Run: `pnpm tauri dev`
Expected: 窗口打开，显示角色名、对话区、输入框、状态条、今日小结。设置面板可开关。

- [ ] **Step 8: Commit**

```bash
git add src/App.vue src/components/
git commit -m "feat: implement main UI with chat, status bar, settings panel"
```

---

## Task 19: 集成 — 连接所有组件的主控制器

**Files:**
- Create: `src/controller.ts`
- Modify: `src/App.vue`（连接 controller）

- [ ] **Step 1: 写 `src/controller.ts`（主控制器，连接所有子系统）**

```typescript
import type {
  Mode, Goal, LogEvent, ForegroundWindow,
  PersonaConfig, LLMConfig, CompanionConfig, ChatLLMResponse,
} from './types'
import { DEFAULT_PERSONA, DEFAULT_LLM_CONFIG, DEFAULT_COMPANION_CONFIG } from './config'
import {
  createInitialState, startGoal, endGoal, startRest, endRest,
  enterCompanion, backToIdle, checkRestTimeout,
  type ModeMachineState,
} from './state/mode-machine'
import { WindowPoller } from './perception/poller'
import { checkIdle, createIdleDetectorState, type IdleDetectorState } from './perception/idle-detector'
import { AppProfileStore } from './slack/app-profiles'
import { SlackDetector } from './slack/detector'
import {
  createReminderState, checkReminderLevel, executeReminder,
  handleSokai, resetSlack, markSlackStart, updateLevel,
  type ReminderState,
} from './slack/reminder'
import { CompanionTriggerEngine, type CompanionEvent } from './companion/triggers'
import { arbitrate, generateCompanionMessage, computeNewCooldown } from './companion/arbiter'
import { LLMClient } from './llm/client'
import { buildSystemPrompt, buildChatPrompt } from './llm/prompts'
import { appendLog, saveRuntimeState, saveGoal } from './tauri-bridge'
import { recoverState } from './recovery/runtime-state'
import { generateDailySummary } from './summary/daily'

export type UIMessage = { role: 'user' | 'assistant' | 'system'; content: string; ts: number }

export type ControllerState = {
  mode: Mode
  activeGoal: Goal | null
  messages: UIMessage[]
  slackCount: number
  workMinutes: number
}

export class AppController {
  private modeMachine: ModeMachineState = createInitialState()
  private poller = new WindowPoller()
  private idleState: IdleDetectorState = createIdleDetectorState()
  private reminderState: ReminderState = createReminderState()
  private profiles!: AppProfileStore
  private detector!: SlackDetector
  private triggerEngine!: CompanionTriggerEngine
  private llm!: LLMClient
  private persona: PersonaConfig = { ...DEFAULT_PERSONA }
  private llmConfig: LLMConfig = { ...DEFAULT_LLM_CONFIG }
  private companionConfig: CompanionConfig = { ...DEFAULT_COMPANION_CONFIG }
  private lastSpokeAt = 0
  private cooldownUntil = 0
  private chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

  // UI 回调
  public onStateChange: ((state: ControllerState) => void) | null = null

  async init(): Promise<{ needsGoalTimeoutPrompt: boolean }> {
    const recovered = await recoverState()
    this.modeMachine = recovered.modeMachine
    this.profiles = recovered.profiles
    this.persona = recovered.persona
    this.llmConfig = recovered.llmConfig
    this.companionConfig = recovered.companionConfig
    this.lastSpokeAt = recovered.modeMachine.mode ? 0 : 0 // 简化
    this.llm = new LLMClient(this.llmConfig)
    this.detector = new SlackDetector(this.profiles, this.llm)
    this.triggerEngine = new CompanionTriggerEngine(this.profiles, (e) => this.handleCompanionEvent(e))

    this.pushSystem(`${this.persona.characterName} 已启动`)
    this.emitState()

    // 启动轮询
    this.poller.start((win) => this.handleWindowChange(win))
    this.triggerEngine.startFallbackTimer(this.companionConfig.fallbackIntervalMinutes)

    return { needsGoalTimeoutPrompt: recovered.needsGoalTimeoutPrompt }
  }

  // ===== 窗口变化处理 =====
  private async handleWindowChange(win: ForegroundWindow): Promise<void> {
    const mode = this.modeMachine.mode
    const goal = this.modeMachine.activeGoal

    // 记录日志
    await this.log({
      ts: Date.now(), type: 'window_switch', mode,
      goalId: goal?.id, processName: win.processName, windowTitle: win.windowTitle,
    })

    // 空闲检测
    const idleResult = await checkIdle(this.idleState)
    this.idleState = idleResult.state
    if (idleResult.transition) {
      await this.log({
        ts: Date.now(), type: idleResult.transition, mode,
        goalId: goal?.id,
        data: idleResult.transition === 'idle_started' ? { idleMinutes: 5 } : undefined,
      })
      this.triggerEngine.handleIdleTransition(
        idleResult.transition,
        idleResult.transition === 'idle_started' ? 5 : undefined,
      )
    }

    // 休息超时检查
    const restTimeout = checkRestTimeout(this.modeMachine, Date.now())
    if (restTimeout && restTimeout.ok) {
      this.modeMachine = restTimeout.state
      this.pushSystem('休息结束')
      await this.persistRuntimeState()
    }

    // 监督模式：摸鱼检测
    if ((mode === 'study' || mode === 'work') && goal) {
      const detection = await this.detector.detect(win, goal)
      if (detection.outcome === 'slacking') {
        this.reminderState = markSlackStart(this.reminderState)
        await this.log({
          ts: Date.now(), type: 'slack_detected', mode, goalId: goal.id,
          processName: win.processName, note: `摸鱼：${win.windowTitle}`,
        })
      } else if (detection.outcome === 'working') {
        // 回到正事，重置摸鱼计时
        if (this.reminderState.slackStartedAt !== null) {
          this.reminderState = resetSlack(this.reminderState)
        }
      }

      // 检查是否需要提醒
      const nextLevel = checkReminderLevel(this.reminderState)
      if (nextLevel && detection.needsReminder) {
        this.reminderState = updateLevel(this.reminderState, nextLevel)
        const { message, notified } = await executeReminder(this.llm, nextLevel, goal)
        this.pushAssistant(message)
        await this.log({
          ts: Date.now(), type: 'reminder', mode, goalId: goal.id,
          note: `第${nextLevel}级提醒${notified ? '（系统通知）' : ''}`,
          data: { level: nextLevel, message },
        })
      }
    }

    // 陪伴模式：触发事件
    this.triggerEngine.handleWindowSwitch(win, mode)

    this.emitState()
  }

  // ===== 陪伴事件处理 =====
  private async handleCompanionEvent(event: CompanionEvent): Promise<void> {
    const ctx = {
      mode: this.modeMachine.mode,
      lastSpokeAt: this.lastSpokeAt,
      cooldownUntil: this.cooldownUntil,
      config: this.companionConfig,
      currentWindow: this.poller.getLastWindow() ?? undefined,
      isIdle: this.idleState.isIdle,
      idleMinutes: this.idleState.idleStartedAt
        ? Math.floor((Date.now() - this.idleState.idleStartedAt) / 60000)
        : undefined,
    }

    const decision = arbitrate(event, ctx)
    if (!decision.shouldSpeak) return

    const message = await generateCompanionMessage(this.llm, decision.prompt)
    this.pushAssistant(message)
    this.lastSpokeAt = Date.now()
    this.cooldownUntil = computeNewCooldown(this.companionConfig)
    await this.log({
      ts: Date.now(), type: 'companion_speak', mode: this.modeMachine.mode,
      note: message, data: { eventType: event.type },
    })
    await this.persistRuntimeState()
    this.emitState()
  }

  // ===== 用户对话处理 =====
  async handleUserMessage(text: string): Promise<void> {
    this.pushUser(text)
    this.chatHistory.push({ role: 'user', content: text })
    await this.log({
      ts: Date.now(), type: 'user_chat', mode: this.modeMachine.mode,
      goalId: this.modeMachine.activeGoal?.id, note: text,
    })

    // LLM 对话 + 意图识别
    if (this.llm.isConfigured('generate')) {
      const system = buildSystemPrompt(this.persona, this.modeMachine.mode, this.modeMachine.activeGoal)
      const { user } = buildChatPrompt(this.chatHistory, text)
      try {
        const result = await this.llm.chatWithIntent(
          [{ role: 'system', content: system }, { role: 'user', content: user }],
          'generate',
        )
        this.pushAssistant(result.reply)
        this.chatHistory.push({ role: 'assistant', content: result.reply })
        await this.handleIntent(result)
      } catch {
        this.pushSystem('回复生成失败')
      }
    } else {
      this.pushSystem('（LLM 未配置，无法对话）')
    }
    this.emitState()
  }

  // ===== 意图处理 =====
  private async handleIntent(result: ChatLLMResponse): Promise<void> {
    if (!result.intent) return
    const intent = result.intent
    switch (intent.type) {
      case 'switch_mode':
        if (intent.mode === 'companion') {
          const r = enterCompanion(this.modeMachine)
          if (r.ok) { this.modeMachine = r.state; await this.persistRuntimeState() }
        } else if (intent.mode === 'study' || intent.mode === 'work') {
          if (intent.topic) {
            const r = startGoal(this.modeMachine, intent.mode, intent.topic, intent.plannedMinutes)
            if (r.ok) {
              this.modeMachine = r.state
              await saveGoal(r.state.activeGoal!)
              await this.log({
                ts: Date.now(), type: 'goal_started', mode: this.modeMachine.mode,
                goalId: r.state.activeGoal!.id, data: { goal: r.state.activeGoal },
              })
              await this.persistRuntimeState()
            }
          }
        } else if (intent.mode === 'rest') {
          const r = startRest(this.modeMachine, intent.plannedMinutes ?? 15)
          if (r.ok) { this.modeMachine = r.state; await this.persistRuntimeState() }
        }
        break
      case 'sokai_yila':
        this.reminderState = handleSokai(this.reminderState, intent.minutes)
        await this.log({
          ts: Date.now(), type: 'sokai_yila', mode: this.modeMachine.mode,
          goalId: this.modeMachine.activeGoal?.id,
          note: `赖账 ${intent.minutes} 分钟`, data: { minutes: intent.minutes },
        })
        break
      case 'end_goal':
        if (this.modeMachine.activeGoal) {
          const r = endGoal(this.modeMachine)
          if (r.ok) {
            this.modeMachine = r.state
            await saveGoal((r.event as { goal: Goal }).goal)
            await this.persistRuntimeState()
          }
        }
        break
      case 'summary':
        if (result.intent && result.intent.type === 'summary') {
          const date = new Date().toISOString().slice(0, 10)
          const summary = await generateDailySummary(this.llm, date)
          this.pushSystem(summary.comment)
        }
        break
    }
  }

  // ===== 按钮切换模式 =====
  async switchMode(m: 'companion' | 'study' | 'work' | 'rest'): Promise<void> {
    if (m === 'companion') {
      const r = enterCompanion(this.modeMachine)
      if (r.ok) this.modeMachine = r.state
    } else if (m === 'rest') {
      const r = startRest(this.modeMachine, 15)
      if (r.ok) this.modeMachine = r.state
    } else {
      // study/work 需要目标，按钮切换时提示用户输入主题
      // 这里简化：用默认主题，实际应弹窗让用户输入
      const r = startGoal(this.modeMachine, m, '未命名目标')
      if (r.ok) {
        this.modeMachine = r.state
        await saveGoal(r.state.activeGoal!)
      }
    }
    await this.persistRuntimeState()
    this.pushSystem(`切换到 ${m} 模式`)
    this.emitState()
  }

  // ===== 结束目标 =====
  async endActiveGoal(): Promise<void> {
    const r = endGoal(this.modeMachine)
    if (r.ok) {
      this.modeMachine = r.state
      await saveGoal((r.event as { goal: Goal }).goal)
      await this.persistRuntimeState()
      this.pushSystem('目标已结束')
      this.emitState()
    }
  }

  // ===== 辅助方法 =====
  private pushUser(content: string) {
    this.onStateChange?.(this.getState({ userMsg: content, userRole: 'user' }))
  }
  private pushAssistant(content: string) {
    this.onStateChange?.(this.getState({ userMsg: content, userRole: 'assistant' }))
  }
  private pushSystem(content: string) {
    this.onStateChange?.(this.getState({ userMsg: content, userRole: 'system' }))
  }

  private getState(msg?: { userMsg: string; userRole: 'user' | 'assistant' | 'system' }): ControllerState {
    if (msg) {
      // messages 由 App.vue 维护，这里只触发更新
    }
    return {
      mode: this.modeMachine.mode,
      activeGoal: this.modeMachine.activeGoal,
      messages: [], // App.vue 自行追加
      slackCount: 0, // TODO: 从日志聚合
      workMinutes: 0,
    }
  }

  private emitState() {
    this.onStateChange?.({
      mode: this.modeMachine.mode,
      activeGoal: this.modeMachine.activeGoal,
      messages: [],
      slackCount: 0,
      workMinutes: 0,
    })
  }

  private async log(event: LogEvent): Promise<void> {
    try {
      await appendLog(event)
    } catch (e) {
      console.error('日志写入失败', e)
    }
  }

  private async persistRuntimeState(): Promise<void> {
    await saveRuntimeState({
      mode: this.modeMachine.mode,
      activeGoalId: this.modeMachine.activeGoal?.id,
      companionCooldownUntil: this.cooldownUntil,
      lastSpokeAt: this.lastSpokeAt,
    })
  }

  destroy() {
    this.poller.stop()
    this.triggerEngine.stopFallbackTimer()
  }
}
```

- [ ] **Step 2: 更新 `src/App.vue` 连接 controller**

将 `src/App.vue` 的 `<script setup>` 替换为：

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import ChatPanel from './components/ChatPanel.vue'
import MessageInput from './components/MessageInput.vue'
import StatusBar from './components/StatusBar.vue'
import TodaySummary from './components/TodaySummary.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { AppController } from './controller'
import type { Mode, Goal, PersonaConfig, LLMConfig, CompanionConfig } from './types'
import { DEFAULT_PERSONA, DEFAULT_LLM_CONFIG, DEFAULT_COMPANION_CONFIG } from './config'

const mode = ref<Mode>('idle')
const activeGoal = ref<Goal | null>(null)
const messages = ref<Array<{ role: 'user' | 'assistant' | 'system'; content: string; ts: number }>>([])
const showSettings = ref(false)
const persona = ref<PersonaConfig>({ ...DEFAULT_PERSONA })
const llmConfig = ref<LLMConfig>({ ...DEFAULT_LLM_CONFIG })
const companionConfig = ref<CompanionConfig>({ ...DEFAULT_COMPANION_CONFIG })
const slackCount = ref(0)
const workMinutes = ref(0)
const goalProgress = ref<number | null>(null)

const controller = new AppController()

controller.onStateChange = (state) => {
  mode.value = state.mode
  activeGoal.value = state.activeGoal
}

// 拦截 pushUser/pushAssistant/pushSystem，追加到 messages
const originalEmit = controller.onStateChange
// 简化：controller 的 push 方法需要通过回调追加消息
// 实际实现中 controller 应暴露 onMessage 回调

onMounted(async () => {
  const result = await controller.init()
  if (result.needsGoalTimeoutPrompt) {
    messages.value.push({ role: 'system', content: '上次的目标超时了，要继续还是归档？', ts: Date.now() })
  }
})

onUnmounted(() => {
  controller.destroy()
})

function handleSend(text: string) {
  messages.value.push({ role: 'user', content: text, ts: Date.now() })
  controller.handleUserMessage(text)
}

async function handleSwitchMode(m: 'companion' | 'study' | 'work' | 'rest') {
  await controller.switchMode(m)
  messages.value.push({ role: 'system', content: `切换到 ${m} 模式`, ts: Date.now() })
}

async function handleEndGoal() {
  await controller.endActiveGoal()
}

function handleSaveSettings(s: { persona: PersonaConfig; llmConfig: LLMConfig; companionConfig: CompanionConfig }) {
  persona.value = s.persona
  llmConfig.value = s.llmConfig
  companionConfig.value = s.companionConfig
  showSettings.value = false
}
</script>
```

> 注：controller 的消息推送需要额外暴露一个 `onMessage` 回调。在 `controller.ts` 的 `AppController` 类中添加：
> ```typescript
> public onMessage: ((msg: UIMessage) => void) | null = null
> ```
> 并在 `pushUser`/`pushAssistant`/`pushSystem` 中调用 `this.onMessage?.({ role: ..., content, ts: Date.now() })`。
> 在 `App.vue` 中设置 `controller.onMessage = (msg) => messages.value.push(msg)`。

- [ ] **Step 3: 修复 controller 的消息推送**

在 `src/controller.ts` 中添加 `onMessage` 回调并修改 push 方法：

```typescript
public onMessage: ((msg: UIMessage) => void) | null = null

private pushUser(content: string) {
  this.onMessage?.({ role: 'user', content, ts: Date.now() })
}
private pushAssistant(content: string) {
  this.onMessage?.({ role: 'assistant', content, ts: Date.now() })
}
private pushSystem(content: string) {
  this.onMessage?.({ role: 'system', content, ts: Date.now() })
}
```

在 `App.vue` 的 `onMounted` 前添加：
```typescript
controller.onMessage = (msg) => {
  messages.value.push(msg)
}
```

- [ ] **Step 4: 验证应用启动并基本可用**

Run: `pnpm tauri dev`
Expected: 窗口打开，角色启动消息显示。切换模式按钮可用，输入消息能触发（LLM 未配置时显示提示）。

- [ ] **Step 5: Commit**

```bash
git add src/controller.ts src/App.vue
git commit -m "feat: integrate all subsystems via AppController"
```

---

## Task 20: 托盘图标与定时总结

**Files:**
- Modify: `src-tauri/src/lib.rs`（托盘）
- Create: `src/scheduler.ts`（定时总结）
- Modify: `src/controller.ts`（接入定时器）

- [ ] **Step 1: 在 `src-tauri/tauri.conf.json` 添加托盘配置**

在 `tauri.conf.json` 的 `tauri` 节点添加：
```json
"trayIcon": {
  "iconPath": "icons/icon.png",
  "iconAsTemplate": false,
  "menuOnLeftClick": false,
  "title": "toki-musume"
}
```

- [ ] **Step 2: 在 `src-tauri/src/lib.rs` 配置托盘菜单**

在 `run()` 函数中添加托盘设置（Tauri 2 API）：

```rust
use tauri::menu::{Menu, MenuItem};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(DbState(Mutex::new(None)))
        .setup(|app| {
            // 托盘菜单
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
            // ... 已有 commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: 写 `src/scheduler.ts`**

```typescript
import { DEFAULTS } from './config'
import { generateDailySummary } from './summary/daily'
import { generateWeeklySummary, getCurrentWeekStart } from './summary/weekly'
import type { LLMClient } from './llm/client'

/// 定时总结调度器
export class SummaryScheduler {
  private dailyTimerId: number | null = null
  private weeklyTimerId: number | null = null
  private checkIntervalId: number | null = null

  constructor(private llm: LLMClient) {}

  start(): void {
    // 每分钟检查一次是否到总结时间
    this.checkIntervalId = window.setInterval(() => {
      this.checkTimes()
    }, 60 * 1000)
    // 启动时也检查一次
    this.checkTimes()
  }

  stop(): void {
    if (this.checkIntervalId !== null) clearInterval(this.checkIntervalId)
    if (this.dailyTimerId !== null) clearTimeout(this.dailyTimerId)
    if (this.weeklyTimerId !== null) clearTimeout(this.weeklyTimerId)
  }

  private checkTimes(): void {
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = now.toISOString().slice(0, 10)

    // 每日总结
    if (hhmm === DEFAULTS.summaryTime) {
      this.generateDaily(today)
    }

    // 每周总结（周日）
    if (now.getDay() === DEFAULTS.weeklySummaryDay && hhmm === DEFAULTS.weeklySummaryTime) {
      this.generateWeekly()
    }
  }

  private async generateDaily(date: string): Promise<void> {
    try {
      const summary = await generateDailySummary(this.llm, date)
      console.log(`每日总结已生成: ${date}`, summary.comment)
    } catch (e) {
      console.error('每日总结生成失败', e)
    }
  }

  private async generateWeekly(): Promise<void> {
    try {
      const weekStart = getCurrentWeekStart()
      const summary = await generateWeeklySummary(this.llm, weekStart)
      console.log(`每周总结已生成: ${weekStart}`, summary.comment)
    } catch (e) {
      console.error('每周总结生成失败', e)
    }
  }
}
```

- [ ] **Step 4: 在 `controller.ts` 接入调度器**

在 `AppController` 类中添加：
```typescript
import { SummaryScheduler } from './scheduler'

// 在类字段中：
private scheduler!: SummaryScheduler

// 在 init() 方法末尾添加：
this.scheduler = new SummaryScheduler(this.llm)
this.scheduler.start()

// 在 destroy() 方法中添加：
this.scheduler.stop()
```

- [ ] **Step 5: 验证编译和启动**

Run: `pnpm tauri dev`
Expected: 窗口打开，托盘图标出现，右键有"显示主窗口"和"退出"。

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/tauri.conf.json src/scheduler.ts src/controller.ts
git commit -m "feat: add system tray and scheduled daily/weekly summaries"
```

---

## Task 21: 历史总结查看 UI

**Files:**
- Create: `src/components/HistoryView.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: 写 `src/components/HistoryView.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listDailySummaries } from '../tauri-bridge'
import type { DailySummary } from '../types'

const summaries = ref<Array<{ date: string; data: DailySummary }>>([])
const selected = ref<DailySummary | null>(null)

onMounted(async () => {
  const today = new Date()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 30)
  const start = weekAgo.toISOString().slice(0, 10)
  const end = today.toISOString().slice(0, 10)
  const rows = await listDailySummaries(start, end)
  summaries.value = rows.map((r) => ({ date: r.date, data: JSON.parse(r.data) as DailySummary }))
  if (summaries.value.length > 0) {
    selected.value = summaries.value[0].data
  }
})

function selectSummary(date: string) {
  const found = summaries.value.find((s) => s.date === date)
  if (found) selected.value = found.data
}
</script>

<template>
  <div class="history-view">
    <h3>历史总结</h3>
    <div class="history-layout">
      <ul class="date-list">
        <li v-for="s in summaries" :key="s.date" @click="selectSummary(s.date)">
          {{ s.date }}
        </li>
      </ul>
      <div v-if="selected" class="summary-detail">
        <h4>{{ selected.date }}</h4>
        <p>摸鱼 {{ selected.slackCount }} 次 | 赖账 {{ selected.sokaiCount }} 次 ({{ selected.sokaiTotalMinutes }}m)</p>
        <h5>应用时长</h5>
        <ul>
          <li v-for="(min, app) in selected.appTimeDistribution" :key="app">
            {{ app }}: {{ min }}m
          </li>
        </ul>
        <h5>目标</h5>
        <ul>
          <li v-for="g in selected.goals" :key="g.topic">
            {{ g.topic }} ({{ g.mode }}) - {{ g.completed ? '✓' : '✗' }} {{ g.minutes }}m
          </li>
        </ul>
        <p class="comment">{{ selected.comment }}</p>
      </div>
      <div v-else class="empty">暂无历史总结</div>
    </div>
  </div>
</template>

<style scoped>
.history-view { padding: 16px; }
.history-layout { display: flex; gap: 16px; }
.date-list { list-style: none; padding: 0; min-width: 120px; cursor: pointer; }
.date-list li { padding: 4px 8px; border-radius: 4px; }
.date-list li:hover { background: #f0f0f0; }
.summary-detail { flex: 1; }
.comment { margin-top: 12px; padding: 8px; background: #f9f9f9; border-radius: 4px; font-style: italic; }
</style>
```

- [ ] **Step 2: 在 `App.vue` 添加历史查看入口**

在 `App.vue` 的 `<template>` 中，在 `TodaySummary` 下方添加：
```vue
<TodaySummary
  :summary="null"
  :slack-count="slackCount"
  :work-minutes="workMinutes"
  :goal-progress="goalProgress"
  @view-full="showHistory = !showHistory"
/>
<HistoryView v-if="showHistory" />
```

在 `<script setup>` 中添加：
```typescript
import HistoryView from './components/HistoryView.vue'
const showHistory = ref(false)
```

- [ ] **Step 3: 验证启动**

Run: `pnpm tauri dev`
Expected: 点击今日小结条可展开历史总结视图。

- [ ] **Step 4: Commit**

```bash
git add src/components/HistoryView.vue src/App.vue
git commit -m "feat: add history view for browsing past daily summaries"
```

---

## Task 22: 端到端集成验证与最终 commit

- [ ] **Step 1: 运行全部测试**

Run: `pnpm test`
Expected: 所有测试通过。

- [ ] **Step 2: 启动应用做手动端到端验证**

Run: `pnpm tauri dev`

验证清单：
1. ✅ 窗口打开，角色启动消息显示
2. ✅ 托盘图标存在，右键有菜单
3. ✅ 点"陪伴"按钮 → 模式切换
4. ✅ 点"学习"按钮 → 进入学习模式（带默认目标）
5. ✅ 切到黑名单应用（需先在设置里加一个） → 触发提醒
6. ✅ 输入"我要学 React，2 小时" → LLM 识别意图切换模式（需配 LLM key）
7. ✅ 输入"再看 5 分钟" → 赖账处理
8. ✅ 设置面板可开关、保存
9. ✅ 最小化到托盘后后台继续运行

- [ ] **Step 3: 修复发现的问题**

（根据手动验证结果修复）

- [ ] **Step 4: 最终 commit**

```bash
git add -A
git commit -m "feat: toki-musume phase 1 complete - desktop companion and supervisor agent"
```

---

## 自检结果

### Spec 覆盖检查

| Spec 章节 | 对应 Task |
|-----------|-----------|
| §4 架构 | Task 1, 4, 5, 6, 7, 8 |
| §5 状态机 | Task 9, 19 |
| §6 感知与摸鱼检测 | Task 10, 11, 13, 14 |
| §7 LLM 调用 | Task 12 |
| §8 陪伴触发器 | Task 15 |
| §9 数据存储 | Task 5, 6, 8, 16 |
| §10 总结 | Task 16, 20 |
| §11 UI | Task 18, 21 |
| §12 性格 | Task 3（最小版，prompt 内嵌） |
| §4.3 启动恢复 | Task 17 |

### 已知简化点（实现中需注意）

1. **按钮切换学习/工作模式**：Task 19 中用默认主题"未命名目标"，实际应弹窗让用户输入主题。可在 UI 迭代中补充。
2. **今日小结的实时数据**（slackCount、workMinutes）：Task 19 中标记为 TODO，需从日志聚合实时计算。可在 Task 22 手动验证阶段补充。
3. **通知插件**：`showNotification` 在 Task 8 中用 Web Notification 降级，如需原生通知需安装 `tauri-plugin-notification`。
4. **controller 的 getState 方法**：消息推送改为 `onMessage` 回调后，`getState` 中的 messages 字段实际未用，可清理。
