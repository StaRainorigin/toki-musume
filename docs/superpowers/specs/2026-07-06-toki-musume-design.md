# TokiMusume (時娘) — 设计文档

> 時を守る娘 — 你的时间管理伙伴

## 概述

TokiMusume 是一个 Windows 桌面应用，以二次元管家娘形象陪伴用户，核心能力：

1. **感知** — 定时识别用户在做什么（窗口标题、进程名、OCR）
2. **监督** — 用户设定目标时，严格监督，摸鱼提醒
3. **陪伴** — 无目标时轻松互动，调侃聊天，游戏时鼓励
4. **总结** — 自动生成每日/每周报告，LLM 点评

### 核心理念

不是冷冰冰的计时器，而是一个**会看、会关心、会调侃、会陪你**的伙伴。

## 技术选型

| 维度 | 选择 | 理由 |
|------|------|------|
| 平台 | Windows 桌面应用 | 目标用户场景 |
| 语言 | Python | 快速迭代，AI 生态丰富 |
| UI | PyQt6 + 系统托盘 | 轻量不打扰，需要时展开 |
| 数据库 | SQLite | 单文件，零配置，Python 内置 |
| AI | 云端 LLM API (OpenAI/Anthropic) | 智能分类、拟人互动、报告生成 |
| 截图/OCR | Win32 API + PaddleOCR/Tesseract | 经济性价比方案 |

## 架构

单体模块化应用，单进程运行，模块间通过 Core Engine 协调。

```
┌──────────────────────────────────────────────┐
│              TokiMusume (時娘)                │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │           Config (YAML)                │  │
│  │  persona / monitor / llm / reminders   │  │
│  └──────────────────┬─────────────────────┘  │
│                     │                         │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Monitor  │ │  Reminder  │ │  Reporter   │  │
│  │ Engine   │ │  Engine    │ │  Engine     │  │
│  │          │ │            │ │             │  │
│  │ L1:窗口  │ │ 规则匹配   │ │ 日报/周报   │  │
│  │ L2:标签  │ │ 冷却控制   │ │ LLM 总结    │  │
│  │ L3:OCR   │ │ LLM 润色   │ │ 可视化      │  │
│  └────┬─────┘ └─────┬──────┘ └──────┬──────┘  │
│       │             │               │          │
│  ┌────┴─────────────┴───────────────┴──────┐  │
│  │              Core Engine                │  │
│  │   活动分类 (规则优先 → LLM 补充)         │  │
│  │   活动合并 (相同活动持续 → 合并记录)      │  │
│  │   模式管理 (监督/陪伴切换)               │  │
│  │   调度器 (定时任务管理)                   │  │
│  └──────────────────┬─────────────────────┘  │
│                     │                         │
│  ┌──────────────────┴─────────────────────┐  │
│  │              SQLite DB                  │  │
│  │  activities / summaries / rules / goals │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │          System Tray UI                │  │
│  │  托盘图标 + 气泡通知 + 报告窗口         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  🔮 预留扩展：Live2D / Agent / 语音         │
└──────────────────────────────────────────────┘
```

## 模块详细设计

### 1. 活动监控引擎 (Monitor Engine)

#### 分层采集策略

| 层级 | 方法 | 成本 | 信息量 | 采样频率 |
|------|------|------|--------|----------|
| L1 | 前台窗口标题 + 进程名 | 几乎为零 | 中 | 每 5 秒 |
| L2 | 浏览器标签页标题（Accessibility API） | 低 | 高 | 每 10 秒 |
| L3 | 屏幕截图 + OCR | 中（CPU/GPU） | 很高 | 每 30-60 秒 |

核心思路：L1 为主力，L3 为补充。大部分场景窗口标题+进程名足够判断活动。仅在窗口标题信息不足（如浏览器）时启用 OCR。

L3 的区域化 OCR：当检测到特定应用（如游戏）时，仅截取配置的屏幕区域，降低资源消耗并提高识别精度。

#### 活动分类流程

```
原始数据(窗口标题+进程名)
    → 本地规则预分类（正则匹配 category_rules 表）
        → 命中 → 直接分类，置信度 1.0，method="rule"
        → 未命中 → 调用 LLM API 分类
            → 带上下文（最近 5 分钟活动序列 + 性格设定）
            → 返回 category, sub_category, confidence
    → 存入 SQLite（带分类标签 + 置信度 + 分类方式）
```

规则预分类覆盖 80% 场景，省钱省时。LLM 仅处理模糊情况。

#### 活动合并

连续相同分类的活动记录合并为一条，更新 duration_seconds，避免数据库膨胀。当分类变化或空闲超过阈值（如 5 分钟无活动）时，结束当前记录，开始新记录。

### 2. 提醒引擎 (Reminder Engine)

#### 双模式系统

時娘根据用户状态自动切换行为模式：

| 模式 | 触发方式 | 時娘行为 |
|------|----------|----------|
| 🎯 监督模式 | 用户设定目标："我要学习了"/"我要写代码了" | 严格监督，摸鱼立刻提醒，定期播报进度 |
| 🏠 陪伴模式 | 未设定目标，或用户说"休息一下" | 轻松陪伴，偶尔调侃、聊天、关心，不催促 |

用户可通过托盘菜单或自然语言输入切换模式。LLM 解析自然语言意图：
- "我要学习两小时" → 监督模式, type=study, duration=2h
- "今晚赶个项目" → 监督模式, type=work, deadline=tonight
- "随便" / 不说话 → 陪伴模式

#### 提醒类型

| 类型 | 触发条件 | 监督模式 | 陪伴模式 |
|------|----------|----------|----------|
| 休息提醒 | 连续工作 N 分钟 | "该休息了！" | "辛苦啦，要不要歇会？" |
| 摸鱼提醒 | 摸鱼类活动超阈值 | 严厉提醒 | "在看什么呀~有趣吗？" |
| 学习提醒 | 设定学习时段但未在学 | "该学习了！" | — |
| 游戏互动 | 游戏结束，OCR 识别战绩 | — | 根据战绩调侃/鼓励 |
| 久坐提醒 | 长时间无活动 | "还在吗？别睡着啦" | "主人？还在吗~" |
| 凌晨提醒 | 凌晨还在用电脑 | "该睡觉了！" | "还不睡呀...注意身体哦" |
| 早上问候 | 早上打开电脑 | — | "早上好~今天也要加油哦" |

#### 提醒流程

```
活动数据流 → 规则引擎检查 → 匹配提醒规则
    → 冷却期检查（同类型提醒 N 分钟内不重复，N 可配置）
    → 结合当前模式 + 性格设定，LLM 生成拟人化消息
    → 系统托盘气泡通知 + 可选声音提示
```

提醒消息不是固定模板，而是 LLM 基于性格维度动态生成，保证每次表达有变化。

### 3. 应用定制档案 (App Profiles)

为特定应用做区域化 OCR 和定制化互动。

```yaml
# app_profiles.yaml
league_of_legends:
  process: ["LeagueClient.exe", "League of Legends.exe"]
  mode: companion           # 游戏时不打扰，事后互动
  ocr_zones:
    - name: "战绩面板"
      region: [800, 400, 1120, 600]   # [x1, y1, x2, y2]
      trigger: "match_end"
      fields: ["kda", "胜负", "评分"]
  responses:
    win: "赢了！好厉害~"
    lose_good_kda: "虽然输了但KDA不错呢，下次一定赢！"
    lose_bad_kda: "没关系没关系，谁都有状态不好的时候~"
    streak_win: "连胜了！今天是MVP！"

apex_legends:
  process: ["r5apex.exe"]
  mode: companion
  ocr_zones:
    - name: "结算画面"
      region: [600, 300, 1320, 700]
      trigger: "match_end"
      fields: ["排名", "击杀数", "伤害"]
  responses:
    champion: "冠军！！太强了！"
    top3: "前三！差一点点就冠军了~"
    early_out: "落地成盒...再来一把？"
```

检测流程：

```
检测到进程切换 → 查找 app_profiles 匹配
    → 找到 → 进入应用定制模式
        → 监听特定事件（如比赛结束）
            → 检测方式：窗口标题变化（如出现"结算"/"Victory"/"Defeat"）
                        或 OCR 区域内容变化（从无数据变为有数据）
        → 区域 OCR 提取数据
        → LLM 生成个性化反应（性格 + 战绩 + 上下文）
        → 托盘通知
    → 未找到 → 按通用分类处理
```

### 4. 报告引擎 (Report Engine)

#### 每日报告

每天 22:00（可配置）自动生成，也可手动触发。

内容：
- 时间分布（分类统计，可视化柱状图）
- 活动时间轴（当日活动流）
- 時娘点评（LLM 生成，结合性格，自然语言总结）
- 亮点与改进建议

#### 每周报告

每周日 20:00（可配置）自动生成。汇总 7 天数据，LLM 生成趋势分析和建议，对比上周变化。

#### 报告查看

从系统托盘右键菜单 → "查看报告" → PyQt 报告窗口：
- 日历视图选择日期
- 时间轴可视化
- 分类饼图/柱状图
- 周报对比

### 5. 性格系统 (Persona System)

#### 配置

```yaml
persona:
  user_name: "主人"                    # 用户自定义称呼
  companion_name: "時娘"               # 伙伴自定义名字
  personality:
    tsundere: 3        # 傲娇：0=温柔体贴, 10=嘴硬心软
    strictness: 5      # 严厉：0=随和放任, 10=严格监督
    playfulness: 6     # 俏皮：0=严肃正经, 10=爱开玩笑
    caring: 8          # 关心：0=冷淡, 10=无微不至
    chattiness: 5      # 话多：0=惜字如金, 10=话痨
  personality_prompt: |
    你是{companion_name}，{user_name}的时间管理伙伴。
    你性格温柔但有原则，偶尔会傲娇地调侃{user_name}。
    你关心{user_name}的学习和健康，会真诚地夸奖和鼓励。
    在监督模式下你会更严格，在陪伴模式下你更轻松调皮。
```

性格维度影响 LLM 的 prompt，不同维度组合产生不同的表达风格：

| 场景 | 高傲娇 | 低傲娇(温柔) |
|------|--------|-------------|
| 摸鱼提醒 | "哼，又摸鱼了，我才不是在关心你呢..." | "主人，休息够了的话，要不要继续学习呀？" |

| 场景 | 高俏皮 | 低俏皮(正经) |
|------|--------|-------------|
| 游戏胜利 | "哟哟哟~这就是主人的实力吗，有点东西嘛~" | "做得很好，继续加油。" |

| 场景 | 高关心 | 低关心 |
|------|--------|--------|
| 连续工作 | "已经工作很久了...要注意身体哦，我心疼的" | "工作超时了，建议休息。" |

## 数据模型

```sql
-- 活动记录
CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    process_name TEXT NOT NULL,
    window_title TEXT NOT NULL,
    category TEXT,
    sub_category TEXT,
    confidence REAL DEFAULT 0,
    classification_method TEXT,        -- "rule" 或 "llm"
    duration_seconds INTEGER DEFAULT 0,
    ocr_text TEXT,
    screenshot_path TEXT
);

-- 分类规则
CREATE TABLE category_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    field TEXT NOT NULL,               -- "process_name" 或 "window_title"
    category TEXT NOT NULL,
    sub_category TEXT,
    priority INTEGER DEFAULT 0
);

-- 用户目标
CREATE TABLE goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL,
    goal_type TEXT NOT NULL,           -- "study", "work", "rest"
    description TEXT,
    deadline DATETIME,
    duration_minutes INTEGER,
    focus_categories TEXT,             -- JSON array
    status TEXT DEFAULT 'active'       -- "active", "completed", "cancelled"
);

-- 每日汇总
CREATE TABLE daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    category_durations TEXT,           -- JSON
    raw_stats TEXT                     -- JSON
);

-- 每周汇总
CREATE TABLE weekly_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start DATE NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    category_durations TEXT,           -- JSON
    raw_stats TEXT                     -- JSON
);

-- 提醒规则
CREATE TABLE reminder_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_type TEXT NOT NULL,           -- "rest", "study", "anti_slack", "custom"
    category TEXT,
    threshold_minutes INTEGER,
    message_template TEXT,
    cooldown_minutes INTEGER DEFAULT 30,
    enabled BOOLEAN DEFAULT TRUE
);

-- 提醒历史（冷却控制）
CREATE TABLE reminder_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_type TEXT NOT NULL,
    triggered_at DATETIME NOT NULL,
    message TEXT
);
```

## 项目结构

```
toki-musume/
├── src/
│   └── toki_musume/
│       ├── __init__.py
│       ├── main.py                 # 入口：启动托盘 + 引擎
│       ├── config.py               # 配置加载与管理
│       ├── core/
│       │   ├── __init__.py
│       │   ├── engine.py           # 核心调度引擎
│       │   ├── classifier.py       # 活动分类（规则优先 → LLM 补充）
│       │   ├── merger.py           # 活动合并
│       │   └── mode_manager.py     # 监督/陪伴模式管理
│       ├── monitor/
│       │   ├── __init__.py
│       │   ├── collector.py        # 采集调度（L1/L2/L3）
│       │   ├── window.py           # Win32 窗口信息获取
│       │   └── ocr.py              # OCR 识别（全屏 + 区域）
│       ├── reminder/
│       │   ├── __init__.py
│       │   ├── engine.py           # 提醒引擎
│       │   └── rules.py            # 提醒规则管理
│       ├── report/
│       │   ├── __init__.py
│       │   ├── generator.py        # 报告生成（日报/周报）
│       │   └── viewer.py           # 报告查看 UI
│       ├── llm/
│       │   ├── __init__.py
│       │   ├── client.py           # LLM API 客户端（多 provider）
│       │   └── prompts.py          # 提示词模板
│       ├── storage/
│       │   ├── __init__.py
│       │   ├── database.py         # SQLite 操作
│       │   └── models.py           # 数据模型
│       ├── profiles/
│       │   ├── __init__.py
│       │   ├── manager.py          # 应用档案管理
│       │   └── default_profiles.yaml  # 内置游戏档案
│       └── ui/
│           ├── __init__.py
│           ├── tray.py             # 系统托盘
│           ├── notification.py     # 通知弹窗
│           └── report_window.py    # 报告查看窗口
├── config.yaml                     # 默认配置
├── app_profiles.yaml               # 用户自定义应用档案
├── requirements.txt
├── pyproject.toml
└── README.md
```

## 配置文件

```yaml
# config.yaml

# 人物设定
persona:
  user_name: "主人"
  companion_name: "時娘"
  personality:
    tsundere: 3
    strictness: 5
    playfulness: 6
    caring: 8
    chattiness: 5
  personality_prompt: |
    你是{companion_name}，{user_name}的时间管理伙伴。
    你性格温柔但有原则，偶尔会傲娇地调侃{user_name}。
    你关心{user_name}的学习和健康，会真诚地夸奖和鼓励。
    在监督模式下你会更严格，在陪伴模式下你更轻松调皮。

# 监控设置
monitor:
  poll_interval_seconds: 5
  ocr_interval_seconds: 60
  ocr_enabled: true
  screenshot_save_days: 7
  idle_threshold_seconds: 300         # 5 分钟无活动视为空闲
  categories:
    coding: ["Visual Studio Code", "PyCharm", "IDEA", "Vim", "Neovim"]
    gaming: ["Steam", "Epic Games", "LeagueClient", "r5apex"]
    social_media: ["微博", "Twitter", "Discord", "QQ"]
    video: ["bilibili", "YouTube", "Netflix"]
    studying: ["Notion", "Obsidian", "Anki"]
    reading: ["SumatraPDF", "Calibre", "Kindle"]
    slack: []                         # 用户手动归类

# LLM 设置
llm:
  provider: "openai"                  # openai / anthropic / custom
  model: "gpt-4o-mini"
  api_key: ""
  base_url: ""                        # 可选，支持自定义 API 地址
  max_tokens: 500
  temperature: 0.8

# 提醒设置
reminders:
  - type: rest
    continuous_work_minutes: 90
    cooldown_minutes: 30
  - type: anti_slack
    categories: ["gaming", "social_media", "video"]
    threshold_minutes: 30
    cooldown_minutes: 45
  - type: study
    scheduled_hours: ["9-11", "14-16"]
    required_category: "coding|reading|studying"
    grace_minutes: 15
    cooldown_minutes: 60
  - type: late_night
    start_hour: 0
    end_hour: 6
    cooldown_minutes: 60

# 报告设置
report:
  daily_time: "22:00"
  weekly_day: "sunday"
  weekly_time: "20:00"

# 数据存储
storage:
  db_path: "./data/toki-musume.db"
  screenshot_dir: "./data/screenshots"
```

## 关键技术决策

1. **规则优先，LLM 兜底** — 80% 的活动分类通过本地正则完成，仅模糊场景调用 LLM，控制 API 成本
2. **区域 OCR 而非全屏 OCR** — 应用定制档案指定屏幕区域，降低计算开销
3. **性格维度参数化** — 用数值维度控制 LLM prompt，而非硬编码台词，保证表达多样性
4. **双模式切换** — 监督/陪伴模式决定時娘的行为强度，同一性格在不同模式下表现不同
5. **SQLite 单文件** — 零运维，方便备份和迁移
6. **YAML 配置** — 用户可读可编辑，不依赖 UI 即可调参

## 预留扩展

- **Live2D 集成** — 時娘的视觉形象，表情随模式/互动变化
- **语音交互** — TTS 朗读 + STT 语音输入
- **Agent 能力** — 主动建议、日程管理、与其他工具集成
- **多用户/云同步** — 数据云端备份，多设备同步
- **插件系统** — 社区贡献应用档案、性格模板、提醒规则
