# TokiMusume V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal runnable TokiMusume (偷瞄姬) that monitors user activity, classifies it, reminds based on rules, generates daily reports, and runs from the system tray.

**Architecture:** Single-process Python app with modular design. Monitor polls foreground window every 5s, classifies via rules (LLM fallback later), stores in SQLite, checks reminder rules, generates daily report with LLM, shows notifications via system tray.

**Tech Stack:** Python 3.10+, PyQt6, SQLite, pywin32, PyYAML, openai (or anthropic), pytest

---

## File Structure

```
toki-musume/
├── src/
│   └── toki_musume/
│       ├── __init__.py
│       ├── main.py                    # Entry point: start tray + engines
│       ├── config.py                  # Config loading from YAML
│       ├── core/
│       │   ├── __init__.py
│       │   ├── engine.py              # Core scheduler: starts monitor, reminder, report
│       │   ├── classifier.py          # Activity classification (rules first)
│       │   └── merger.py              # Merge consecutive same-category activities
│       ├── monitor/
│       │   ├── __init__.py
│       │   ├── collector.py           # Polling scheduler for L1
│       │   └── window.py              # Win32 API: GetForegroundWindow etc.
│       ├── reminder/
│       │   ├── __init__.py
│       │   ├── engine.py              # Check rules + cooldown, emit reminders
│       │   └── rules.py               # Load and manage reminder rules
│       ├── report/
│       │   ├── __init__.py
│       │   └── generator.py           # Daily/weekly report generation
│       ├── llm/
│       │   ├── __init__.py
│       │   ├── client.py              # Unified LLM API client
│       │   └── prompts.py             # Prompt templates
│       ├── storage/
│       │   ├── __init__.py
│       │   ├── database.py            # SQLite operations
│       │   └── models.py              # Data classes for activities, rules, etc.
│       └── ui/
│           ├── __init__.py
│           ├── tray.py                # System tray icon + menu
│           └── notification.py        # Bubble notification helper
├── tests/
│   ├── __init__.py
│   ├── test_config.py
│   ├── test_classifier.py
│   ├── test_merger.py
│   ├── test_database.py
│   ├── test_reminder_rules.py
│   ├── test_reminder_engine.py
│   ├── test_report_generator.py
│   └── test_llm_client.py
├── config.example.yaml                # Example config (committed)
├── requirements.txt
├── pyproject.toml
└── README.md                          # Already exists, update later
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `pyproject.toml`
- Create: `requirements.txt`
- Create: `src/toki_musume/__init__.py`
- Create: `src/toki_musume/main.py`
- Create: `config.example.yaml`
- Create: `tests/__init__.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "toki-musume"
version = "0.1.0"
description = "偷瞄姬 - Your time management companion"
requires-python = ">=3.10"
dependencies = [
    "PyQt6>=6.6",
    "pywin32>=306",
    "PyYAML>=6.0",
    "openai>=1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "pytest-cov>=4.0",
]

[project.scripts]
toki-musume = "toki_musume.main:main"

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 2: Create requirements.txt**

```
PyQt6>=6.6
pywin32>=306
PyYAML>=6.0
openai>=1.0
pytest>=7.0
pytest-cov>=4.0
```

- [ ] **Step 3: Create src/toki_musume/__init__.py**

```python
"""TokiMusume (偷瞄姬) - Your time management companion."""

__version__ = "0.1.0"
```

- [ ] **Step 4: Create src/toki_musume/main.py (minimal stub)**

```python
"""Entry point for TokiMusume."""

import sys


def main():
    """Start TokiMusume application."""
    print("偷瞄姬 starting...")
    # Will be implemented in later tasks
    sys.exit(0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Create config.example.yaml**

```yaml
# TokiMusume (偷瞄姬) Configuration
# Copy this file to config.yaml and fill in your settings.

persona:
  user_name: "主人"
  companion_name: "偷瞄姬"
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

monitor:
  poll_interval_seconds: 5
  ocr_enabled: false
  idle_threshold_seconds: 300
  categories:
    coding: ["Visual Studio Code", "PyCharm", "IDEA", "Vim", "Neovim"]
    gaming: ["Steam", "Epic Games", "LeagueClient", "r5apex"]
    social_media: ["微博", "Twitter", "Discord", "QQ"]
    video: ["bilibili", "YouTube", "Netflix"]
    studying: ["Notion", "Obsidian", "Anki"]
    reading: ["SumatraPDF", "Calibre", "Kindle"]

llm:
  provider: "openai"
  model: "gpt-4o-mini"
  api_key: ""           # Fill in your API key
  base_url: ""          # Optional: custom API endpoint
  max_tokens: 500
  temperature: 0.8

reminders:
  - type: rest
    continuous_work_minutes: 90
    cooldown_minutes: 30
  - type: anti_slack
    categories: ["gaming", "social_media", "video"]
    threshold_minutes: 30
    cooldown_minutes: 45
  - type: late_night
    start_hour: 0
    end_hour: 6
    cooldown_minutes: 60

report:
  daily_time: "22:00"
  weekly_day: "sunday"
  weekly_time: "20:00"

storage:
  db_path: "./data/toki-musume.db"
  screenshot_dir: "./data/screenshots"
```

- [ ] **Step 6: Create tests/__init__.py**

Empty file.

- [ ] **Step 7: Add config.yaml to .gitignore**

Append to `.gitignore`:
```
config.yaml
data/
__pycache__/
*.pyc
dist/
build/
*.egg-info/
```

- [ ] **Step 8: Verify project runs**

Run: `cd E:/Devs/day_recorder && pip install -e . && toki-musume`
Expected: prints "偷瞄姬 starting..." and exits

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: project scaffolding with pyproject.toml, config, and stubs"
```

---

### Task 2: Config Module

**Files:**
- Create: `src/toki_musume/config.py`
- Create: `tests/test_config.py`

- [ ] **Step 1: Write failing test for config loading**

```python
# tests/test_config.py
import pytest
from pathlib import Path
import yaml
from toki_musume.config import Config, load_config


@pytest.fixture
def sample_config_path(tmp_path):
    config_data = {
        "persona": {
            "user_name": "主人",
            "companion_name": "偷瞄姬",
            "personality": {
                "tsundere": 3,
                "strictness": 5,
                "playfulness": 6,
                "caring": 8,
                "chattiness": 5,
            },
            "personality_prompt": "你是{companion_name}",
        },
        "monitor": {
            "poll_interval_seconds": 5,
            "ocr_enabled": False,
            "idle_threshold_seconds": 300,
            "categories": {
                "coding": ["Visual Studio Code"],
            },
        },
        "llm": {
            "provider": "openai",
            "model": "gpt-4o-mini",
            "api_key": "test-key",
            "base_url": "",
            "max_tokens": 500,
            "temperature": 0.8,
        },
        "reminders": [
            {"type": "rest", "continuous_work_minutes": 90, "cooldown_minutes": 30},
        ],
        "report": {
            "daily_time": "22:00",
            "weekly_day": "sunday",
            "weekly_time": "20:00",
        },
        "storage": {
            "db_path": "./data/test.db",
            "screenshot_dir": "./data/screenshots",
        },
    }
    path = tmp_path / "config.yaml"
    path.write_text(yaml.dump(config_data), encoding="utf-8")
    return path


def test_load_config_reads_yaml(sample_config_path):
    config = load_config(sample_config_path)
    assert isinstance(config, Config)
    assert config.persona.user_name == "主人"
    assert config.persona.companion_name == "偷瞄姬"


def test_load_config_monitor_settings(sample_config_path):
    config = load_config(sample_config_path)
    assert config.monitor.poll_interval_seconds == 5
    assert config.monitor.ocr_enabled is False
    assert "coding" in config.monitor.categories


def test_load_config_llm_settings(sample_config_path):
    config = load_config(sample_config_path)
    assert config.llm.provider == "openai"
    assert config.llm.api_key == "test-key"


def test_load_config_reminders(sample_config_path):
    config = load_config(sample_config_path)
    assert len(config.reminders) == 1
    assert config.reminders[0].type == "rest"
    assert config.reminders[0].continuous_work_minutes == 90


def test_load_config_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        load_config(Path("/nonexistent/config.yaml"))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_config.py -v`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement config.py**

```python
# src/toki_musume/config.py
"""Configuration loading and management for TokiMusume."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass
class PersonalityConfig:
    tsundere: int = 3
    strictness: int = 5
    playfulness: int = 6
    caring: int = 8
    chattiness: int = 5


@dataclass
class PersonaConfig:
    user_name: str = "主人"
    companion_name: str = "偷瞄姬"
    personality: PersonalityConfig = field(default_factory=PersonalityConfig)
    personality_prompt: str = "你是{companion_name}，{user_name}的时间管理伙伴。"


@dataclass
class MonitorConfig:
    poll_interval_seconds: int = 5
    ocr_enabled: bool = False
    idle_threshold_seconds: int = 300
    categories: dict[str, list[str]] = field(default_factory=dict)


@dataclass
class LLMConfig:
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    api_key: str = ""
    base_url: str = ""
    max_tokens: int = 500
    temperature: float = 0.8


@dataclass
class ReminderRuleConfig:
    type: str = ""
    categories: list[str] = field(default_factory=list)
    threshold_minutes: int = 30
    continuous_work_minutes: int = 90
    cooldown_minutes: int = 30
    start_hour: int = 0
    end_hour: int = 6


@dataclass
class ReportConfig:
    daily_time: str = "22:00"
    weekly_day: str = "sunday"
    weekly_time: str = "20:00"


@dataclass
class StorageConfig:
    db_path: str = "./data/toki-musume.db"
    screenshot_dir: str = "./data/screenshots"


@dataclass
class Config:
    persona: PersonaConfig = field(default_factory=PersonaConfig)
    monitor: MonitorConfig = field(default_factory=MonitorConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)
    reminders: list[ReminderRuleConfig] = field(default_factory=list)
    report: ReportConfig = field(default_factory=ReportConfig)
    storage: StorageConfig = field(default_factory=StorageConfig)


def _parse_personality(data: dict[str, Any]) -> PersonalityConfig:
    return PersonalityConfig(**{k: v for k, v in data.items() if k in PersonalityConfig.__dataclass_fields__})


def _parse_reminders(data: list[dict[str, Any]]) -> list[ReminderRuleConfig]:
    result = []
    for item in data:
        known_fields = {k: v for k, v in item.items() if k in ReminderRuleConfig.__dataclass_fields__}
        result.append(ReminderRuleConfig(**known_fields))
    return result


def load_config(path: Path) -> Config:
    """Load configuration from a YAML file."""
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    persona_data = raw.get("persona", {})
    personality_data = persona_data.get("personality", {})

    return Config(
        persona=PersonaConfig(
            user_name=persona_data.get("user_name", "主人"),
            companion_name=persona_data.get("companion_name", "偷瞄姬"),
            personality=_parse_personality(personality_data),
            personality_prompt=persona_data.get("personality_prompt", ""),
        ),
        monitor=MonitorConfig(
            poll_interval_seconds=raw.get("monitor", {}).get("poll_interval_seconds", 5),
            ocr_enabled=raw.get("monitor", {}).get("ocr_enabled", False),
            idle_threshold_seconds=raw.get("monitor", {}).get("idle_threshold_seconds", 300),
            categories=raw.get("monitor", {}).get("categories", {}),
        ),
        llm=LLMConfig(
            provider=raw.get("llm", {}).get("provider", "openai"),
            model=raw.get("llm", {}).get("model", "gpt-4o-mini"),
            api_key=raw.get("llm", {}).get("api_key", ""),
            base_url=raw.get("llm", {}).get("base_url", ""),
            max_tokens=raw.get("llm", {}).get("max_tokens", 500),
            temperature=raw.get("llm", {}).get("temperature", 0.8),
        ),
        reminders=_parse_reminders(raw.get("reminders", [])),
        report=ReportConfig(
            daily_time=raw.get("report", {}).get("daily_time", "22:00"),
            weekly_day=raw.get("report", {}).get("weekly_day", "sunday"),
            weekly_time=raw.get("report", {}).get("weekly_time", "20:00"),
        ),
        storage=StorageConfig(
            db_path=raw.get("storage", {}).get("db_path", "./data/toki-musume.db"),
            screenshot_dir=raw.get("storage", {}).get("screenshot_dir", "./data/screenshots"),
        ),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_config.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: config module with YAML loading and typed dataclasses"
```

---

### Task 3: Storage Module (Database + Models)

**Files:**
- Create: `src/toki_musume/storage/__init__.py`
- Create: `src/toki_musume/storage/database.py`
- Create: `src/toki_musume/storage/models.py`
- Create: `tests/test_database.py`

- [ ] **Step 1: Write failing test for database operations**

```python
# tests/test_database.py
import pytest
from datetime import datetime
from toki_musume.storage.database import Database
from toki_musume.storage.models import Activity, CategoryRule, ReminderHistory


@pytest.fixture
def db(tmp_path):
    db_path = tmp_path / "test.db"
    database = Database(str(db_path))
    database.initialize()
    yield database
    database.close()


def test_database_initialize_creates_tables(db):
    # Tables should exist without error
    result = db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    table_names = [row[0] for row in result]
    assert "activities" in table_names
    assert "category_rules" in table_names
    assert "reminder_history" in table_names
    assert "daily_summaries" in table_names


def test_insert_and_query_activity(db):
    activity = Activity(
        start_time=datetime(2026, 7, 8, 10, 0, 0),
        end_time=datetime(2026, 7, 8, 10, 5, 0),
        process_name="Code.exe",
        window_title="main.py - Visual Studio Code",
        category="coding",
        sub_category="python",
        confidence=1.0,
        classification_method="rule",
        duration_seconds=300,
    )
    db.insert_activity(activity)

    activities = db.get_activities_by_date("2026-07-08")
    assert len(activities) == 1
    assert activities[0].process_name == "Code.exe"
    assert activities[0].category == "coding"


def test_insert_and_query_category_rules(db):
    rule = CategoryRule(
        pattern="Visual Studio Code",
        field="window_title",
        category="coding",
        sub_category="",
        priority=0,
    )
    db.insert_category_rule(rule)

    rules = db.get_category_rules()
    assert len(rules) >= 1
    assert rules[0].pattern == "Visual Studio Code"
    assert rules[0].category == "coding"


def test_reminder_cooldown_check(db):
    history = ReminderHistory(
        rule_type="rest",
        triggered_at=datetime(2026, 7, 8, 10, 0, 0),
        message="该休息了",
    )
    db.insert_reminder_history(history)

    # Within cooldown (30 min) should return True
    assert db.is_in_cooldown("rest", datetime(2026, 7, 8, 10, 15, 0), cooldown_minutes=30) is True
    # After cooldown should return False
    assert db.is_in_cooldown("rest", datetime(2026, 7, 8, 10, 35, 0), cooldown_minutes=30) is False


def test_get_category_durations_by_date(db):
    # Insert two activities
    db.insert_activity(Activity(
        start_time=datetime(2026, 7, 8, 10, 0, 0),
        end_time=datetime(2026, 7, 8, 11, 0, 0),
        process_name="Code.exe", window_title="test",
        category="coding", confidence=1.0, classification_method="rule",
        duration_seconds=3600,
    ))
    db.insert_activity(Activity(
        start_time=datetime(2026, 7, 8, 11, 0, 0),
        end_time=datetime(2026, 7, 8, 11, 30, 0),
        process_name="Steam.exe", window_title="Steam",
        category="gaming", confidence=1.0, classification_method="rule",
        duration_seconds=1800,
    ))

    durations = db.get_category_durations_by_date("2026-07-08")
    assert durations["coding"] == 3600
    assert durations["gaming"] == 1800
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_database.py -v`
Expected: FAIL (module not found)

- [ ] **Step 3: Create storage/__init__.py**

```python
"""Storage module for TokiMusume."""
```

- [ ] **Step 4: Create storage/models.py**

```python
# src/toki_musume/storage/models.py
"""Data models for TokiMusume."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class Activity:
    start_time: datetime
    end_time: datetime | None = None
    process_name: str = ""
    window_title: str = ""
    category: str = ""
    sub_category: str = ""
    confidence: float = 0.0
    classification_method: str = ""  # "rule" or "llm"
    duration_seconds: int = 0
    ocr_text: str = ""
    screenshot_path: str = ""


@dataclass
class CategoryRule:
    pattern: str
    field: str  # "process_name" or "window_title"
    category: str
    sub_category: str = ""
    priority: int = 0


@dataclass
class ReminderHistory:
    rule_type: str
    triggered_at: datetime
    message: str = ""


@dataclass
class DailySummary:
    date: str  # YYYY-MM-DD
    summary: str = ""
    category_durations: str = "{}"  # JSON
    raw_stats: str = "{}"  # JSON
```

- [ ] **Step 5: Create storage/database.py**

```python
# src/toki_musume/storage/database.py
"""SQLite database operations for TokiMusume."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from .models import Activity, CategoryRule, ReminderHistory, DailySummary


class Database:
    """Manages SQLite connection and operations."""

    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._conn: sqlite3.Connection | None = None

    def _ensure_dir(self) -> None:
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)

    def connect(self) -> None:
        self._ensure_dir()
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    def initialize(self) -> None:
        """Create all tables if they don't exist."""
        self.connect()
        assert self._conn is not None
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time DATETIME NOT NULL,
                end_time DATETIME,
                process_name TEXT NOT NULL,
                window_title TEXT NOT NULL,
                category TEXT,
                sub_category TEXT,
                confidence REAL DEFAULT 0,
                classification_method TEXT,
                duration_seconds INTEGER DEFAULT 0,
                ocr_text TEXT,
                screenshot_path TEXT
            );

            CREATE TABLE IF NOT EXISTS category_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern TEXT NOT NULL,
                field TEXT NOT NULL,
                category TEXT NOT NULL,
                sub_category TEXT,
                priority INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS reminder_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_type TEXT NOT NULL,
                triggered_at DATETIME NOT NULL,
                message TEXT
            );

            CREATE TABLE IF NOT EXISTS daily_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                summary TEXT NOT NULL,
                category_durations TEXT,
                raw_stats TEXT
            );

            CREATE TABLE IF NOT EXISTS weekly_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_start TEXT NOT NULL UNIQUE,
                summary TEXT NOT NULL,
                category_durations TEXT,
                raw_stats TEXT
            );
        """)
        self._conn.commit()

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> sqlite3.Cursor:
        assert self._conn is not None
        return self._conn.execute(sql, params)

    # --- Activity operations ---

    def insert_activity(self, activity: Activity) -> int:
        assert self._conn is not None
        cursor = self._conn.execute(
            """INSERT INTO activities
               (start_time, end_time, process_name, window_title, category,
                sub_category, confidence, classification_method, duration_seconds,
                ocr_text, screenshot_path)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                activity.start_time.isoformat(),
                activity.end_time.isoformat() if activity.end_time else None,
                activity.process_name,
                activity.window_title,
                activity.category,
                activity.sub_category,
                activity.confidence,
                activity.classification_method,
                activity.duration_seconds,
                activity.ocr_text,
                activity.screenshot_path,
            ),
        )
        self._conn.commit()
        return cursor.lastrowid  # type: ignore

    def get_activities_by_date(self, date: str) -> list[Activity]:
        assert self._conn is not None
        rows = self._conn.execute(
            "SELECT * FROM activities WHERE date(start_time) = ? ORDER BY start_time",
            (date,),
        ).fetchall()
        return [self._row_to_activity(row) for row in rows]

    def get_latest_activity(self) -> Activity | None:
        assert self._conn is not None
        row = self._conn.execute(
            "SELECT * FROM activities ORDER BY start_time DESC LIMIT 1"
        ).fetchone()
        return self._row_to_activity(row) if row else None

    def update_activity_end_time(self, activity_id: int, end_time: datetime, duration_seconds: int) -> None:
        assert self._conn is not None
        self._conn.execute(
            "UPDATE activities SET end_time = ?, duration_seconds = ? WHERE id = ?",
            (end_time.isoformat(), duration_seconds, activity_id),
        )
        self._conn.commit()

    def _row_to_activity(self, row: sqlite3.Row) -> Activity:
        return Activity(
            start_time=datetime.fromisoformat(row["start_time"]),
            end_time=datetime.fromisoformat(row["end_time"]) if row["end_time"] else None,
            process_name=row["process_name"],
            window_title=row["window_title"],
            category=row["category"] or "",
            sub_category=row["sub_category"] or "",
            confidence=row["confidence"] or 0.0,
            classification_method=row["classification_method"] or "",
            duration_seconds=row["duration_seconds"] or 0,
            ocr_text=row["ocr_text"] or "",
            screenshot_path=row["screenshot_path"] or "",
        )

    # --- Category rule operations ---

    def insert_category_rule(self, rule: CategoryRule) -> int:
        assert self._conn is not None
        cursor = self._conn.execute(
            """INSERT INTO category_rules (pattern, field, category, sub_category, priority)
               VALUES (?, ?, ?, ?, ?)""",
            (rule.pattern, rule.field, rule.category, rule.sub_category, rule.priority),
        )
        self._conn.commit()
        return cursor.lastrowid  # type: ignore

    def get_category_rules(self) -> list[CategoryRule]:
        assert self._conn is not None
        rows = self._conn.execute(
            "SELECT * FROM category_rules ORDER BY priority DESC"
        ).fetchall()
        return [
            CategoryRule(
                pattern=row["pattern"],
                field=row["field"],
                category=row["category"],
                sub_category=row["sub_category"] or "",
                priority=row["priority"],
            )
            for row in rows
        ]

    # --- Reminder history operations ---

    def insert_reminder_history(self, history: ReminderHistory) -> None:
        assert self._conn is not None
        self._conn.execute(
            "INSERT INTO reminder_history (rule_type, triggered_at, message) VALUES (?, ?, ?)",
            (history.rule_type, history.triggered_at.isoformat(), history.message),
        )
        self._conn.commit()

    def is_in_cooldown(self, rule_type: str, now: datetime, cooldown_minutes: int) -> bool:
        assert self._conn is not None
        row = self._conn.execute(
            """SELECT triggered_at FROM reminder_history
               WHERE rule_type = ?
               ORDER BY triggered_at DESC LIMIT 1""",
            (rule_type,),
        ).fetchone()
        if not row:
            return False
        last_triggered = datetime.fromisoformat(row["triggered_at"])
        diff = (now - last_triggered).total_seconds() / 60
        return diff < cooldown_minutes

    # --- Summary operations ---

    def get_category_durations_by_date(self, date: str) -> dict[str, int]:
        assert self._conn is not None
        rows = self._conn.execute(
            """SELECT category, SUM(duration_seconds) as total
               FROM activities
               WHERE date(start_time) = ? AND category IS NOT NULL
               GROUP BY category""",
            (date,),
        ).fetchall()
        return {row["category"]: row["total"] for row in rows}

    def insert_daily_summary(self, summary: DailySummary) -> None:
        assert self._conn is not None
        self._conn.execute(
            """INSERT OR REPLACE INTO daily_summaries
               (date, summary, category_durations, raw_stats)
               VALUES (?, ?, ?, ?)""",
            (summary.date, summary.summary, summary.category_durations, summary.raw_stats),
        )
        self._conn.commit()

    def get_daily_summary(self, date: str) -> DailySummary | None:
        assert self._conn is not None
        row = self._conn.execute(
            "SELECT * FROM daily_summaries WHERE date = ?", (date,)
        ).fetchone()
        if not row:
            return None
        return DailySummary(
            date=row["date"],
            summary=row["summary"],
            category_durations=row["category_durations"] or "{}",
            raw_stats=row["raw_stats"] or "{}",
        )
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pytest tests/test_database.py -v`
Expected: All 5 tests PASS

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: storage module with SQLite database and data models"
```

---

### Task 4: Monitor Module (Window Info + Collector)

**Files:**
- Create: `src/toki_musume/monitor/__init__.py`
- Create: `src/toki_musume/monitor/window.py`
- Create: `src/toki_musume/monitor/collector.py`

- [ ] **Step 1: Create monitor/__init__.py**

```python
"""Monitor module for TokiMusume."""
```

- [ ] **Step 2: Create monitor/window.py (Win32 API wrapper)**

```python
# src/toki_musume/monitor/window.py
"""Win32 API wrapper for getting foreground window information."""

from __future__ import annotations

import ctypes
from ctypes import wintypes
from dataclasses import dataclass
from pathlib import Path

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
psapi = ctypes.windll.psapi


@dataclass
class WindowInfo:
    """Information about the current foreground window."""
    process_name: str
    window_title: str


def get_foreground_window_info() -> WindowInfo:
    """Get process name and title of the current foreground window.

    Returns WindowInfo with empty strings if no window is focused.
    """
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return WindowInfo(process_name="", window_title="")

    # Get window title
    title_buffer = ctypes.create_unicode_buffer(512)
    user32.GetWindowTextW(hwnd, title_buffer, 512)
    window_title = title_buffer.value

    # Get process ID
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

    # Get process name from PID
    process_name = _get_process_name(pid.value)

    return WindowInfo(process_name=process_name, window_title=window_title)


def _get_process_name(pid: int) -> str:
    """Get process name from PID using OpenProcess + GetModuleFileName."""
    PROCESS_QUERY_INFORMATION = 0x0400
    PROCESS_VM_READ = 0x0010

    handle = kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid)
    if not handle:
        return ""

    try:
        filename_buffer = ctypes.create_unicode_buffer(512)
        if psapi.GetModuleFileNameW(handle, filename_buffer, 512):
            return Path(filename_buffer.value).name
        return ""
    finally:
        kernel32.CloseHandle(handle)
```

- [ ] **Step 3: Create monitor/collector.py**

```python
# src/toki_musume/monitor/collector.py
"""Activity collector that polls foreground window at regular intervals."""

from __future__ import annotations

import logging
import threading
from datetime import datetime
from typing import Callable

from .window import get_foreground_window_info, WindowInfo
from ..storage.database import Database
from ..storage.models import Activity
from ..config import Config

logger = logging.getLogger(__name__)


class ActivityCollector:
    """Polls foreground window and stores raw activity data."""

    def __init__(self, config: Config, database: Database) -> None:
        self._config = config
        self._db = database
        self._running = False
        self._thread: threading.Thread | None = None
        self._on_activity: Callable[[WindowInfo], None] | None = None
        self._last_info: WindowInfo | None = None

    def set_on_activity(self, callback: Callable[[WindowInfo], None]) -> None:
        """Set callback invoked when new activity data is collected."""
        self._on_activity = callback

    def start(self) -> None:
        """Start polling in a background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()
        logger.info("Activity collector started (interval=%ds)", self._config.monitor.poll_interval_seconds)

    def stop(self) -> None:
        """Stop the polling thread."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Activity collector stopped")

    def _poll_loop(self) -> None:
        """Main polling loop running in background thread."""
        interval = self._config.monitor.poll_interval_seconds
        while self._running:
            try:
                info = get_foreground_window_info()
                if info.window_title or info.process_name:
                    self._last_info = info
                    if self._on_activity:
                        self._on_activity(info)
            except Exception:
                logger.exception("Error collecting window info")
            threading.Event().wait(interval)
```

- [ ] **Step 4: Verify window.py works on Windows**

Run: `python -c "from toki_musume.monitor.window import get_foreground_window_info; info = get_foreground_window_info(); print(f'{info.process_name}: {info.window_title}')"`
Expected: Prints current foreground window process name and title

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: monitor module with Win32 window info and polling collector"
```

---

### Task 5: Core Module (Classifier + Merger + Engine)

**Files:**
- Create: `src/toki_musume/core/__init__.py`
- Create: `src/toki_musume/core/classifier.py`
- Create: `src/toki_musume/core/merger.py`
- Create: `src/toki_musume/core/engine.py`
- Create: `tests/test_classifier.py`
- Create: `tests/test_merger.py`

- [ ] **Step 1: Write failing test for classifier**

```python
# tests/test_classifier.py
import pytest
from toki_musume.core.classifier import ActivityClassifier, ClassificationResult
from toki_musume.storage.models import CategoryRule


@pytest.fixture
def classifier():
    rules = [
        CategoryRule(pattern="Visual Studio Code", field="window_title", category="coding", sub_category=""),
        CategoryRule(pattern="Code.exe", field="process_name", category="coding", sub_category=""),
        CategoryRule(pattern="Steam", field="window_title", category="gaming", sub_category=""),
        CategoryRule(pattern="bilibili", field="window_title", category="video", sub_category=""),
    ]
    return ActivityClassifier(rules=rules)


def test_classify_by_window_title(classifier):
    result = classifier.classify(process_name="Code.exe", window_title="main.py - Visual Studio Code")
    assert result.category == "coding"
    assert result.confidence == 1.0
    assert result.method == "rule"


def test_classify_by_process_name(classifier):
    result = classifier.classify(process_name="Code.exe", window_title="some other title")
    assert result.category == "coding"
    assert result.method == "rule"


def test_classify_unknown_returns_empty(classifier):
    result = classifier.classify(process_name="UnknownApp.exe", window_title="Unknown Window")
    assert result.category == ""
    assert result.method == ""


def test_classify_priority_higher_rule_wins():
    rules = [
        CategoryRule(pattern="Code", field="window_title", category="coding", priority=0),
        CategoryRule(pattern="Code", field="window_title", category="reading", priority=10),
    ]
    classifier = ActivityClassifier(rules=rules)
    result = classifier.classify(process_name="test", window_title="Code")
    assert result.category == "reading"  # higher priority wins
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_classifier.py -v`
Expected: FAIL

- [ ] **Step 3: Implement classifier.py**

```python
# src/toki_musume/core/classifier.py
"""Activity classifier using rules first, LLM fallback (V1: rules only)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from ..storage.models import CategoryRule


@dataclass
class ClassificationResult:
    category: str = ""
    sub_category: str = ""
    confidence: float = 0.0
    method: str = ""  # "rule" or "llm"


class ActivityClassifier:
    """Classifies user activity based on process name and window title."""

    def __init__(self, rules: list[CategoryRule]) -> None:
        self._rules = sorted(rules, key=lambda r: r.priority, reverse=True)

    def classify(self, process_name: str, window_title: str) -> ClassificationResult:
        """Classify activity using rules. Returns empty result if no rule matches."""
        for rule in self._rules:
            if rule.field == "process_name" and re.search(rule.pattern, process_name, re.IGNORECASE):
                return ClassificationResult(
                    category=rule.category,
                    sub_category=rule.sub_category,
                    confidence=1.0,
                    method="rule",
                )
            if rule.field == "window_title" and re.search(rule.pattern, window_title, re.IGNORECASE):
                return ClassificationResult(
                    category=rule.category,
                    sub_category=rule.sub_category,
                    confidence=1.0,
                    method="rule",
                )
        return ClassificationResult(category="", sub_category="", confidence=0.0, method="")
```

- [ ] **Step 4: Run classifier test to verify it passes**

Run: `pytest tests/test_classifier.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Write failing test for merger**

```python
# tests/test_merger.py
import pytest
from datetime import datetime
from toki_musume.core.merger import ActivityMerger
from toki_musume.storage.models import Activity


@pytest.fixture
def merger():
    return ActivityMerger(idle_threshold_seconds=300)


def test_same_category_merged(merger):
    a1 = Activity(
        start_time=datetime(2026, 7, 8, 10, 0, 0),
        end_time=datetime(2026, 7, 8, 10, 5, 0),
        process_name="Code.exe", window_title="test.py",
        category="coding", confidence=1.0, classification_method="rule",
        duration_seconds=300,
    )
    a2 = Activity(
        start_time=datetime(2026, 7, 8, 10, 5, 0),
        end_time=datetime(2026, 7, 8, 10, 10, 0),
        process_name="Code.exe", window_title="test2.py",
        category="coding", confidence=1.0, classification_method="rule",
        duration_seconds=300,
    )
    result = merger.should_merge(a1, a2)
    assert result is True


def test_different_category_no_merge(merger):
    a1 = Activity(
        start_time=datetime(2026, 7, 8, 10, 0, 0),
        end_time=datetime(2026, 7, 8, 10, 5, 0),
        process_name="Code.exe", window_title="test",
        category="coding", confidence=1.0, classification_method="rule",
        duration_seconds=300,
    )
    a2 = Activity(
        start_time=datetime(2026, 7, 8, 10, 5, 0),
        end_time=datetime(2026, 7, 8, 10, 10, 0),
        process_name="Steam.exe", window_title="Steam",
        category="gaming", confidence=1.0, classification_method="rule",
        duration_seconds=300,
    )
    result = merger.should_merge(a1, a2)
    assert result is False


def test_merge_duration(merger):
    a1 = Activity(
        start_time=datetime(2026, 7, 8, 10, 0, 0),
        end_time=datetime(2026, 7, 8, 10, 5, 0),
        process_name="Code.exe", window_title="test",
        category="coding", confidence=1.0, classification_method="rule",
        duration_seconds=300,
    )
    a2 = Activity(
        start_time=datetime(2026, 7, 8, 10, 5, 0),
        end_time=datetime(2026, 7, 8, 10, 10, 0),
        process_name="Code.exe", window_title="test2",
        category="coding", confidence=1.0, classification_method="rule",
        duration_seconds=300,
    )
    merged = merger.merge(a1, a2)
    assert merged.duration_seconds == 600
    assert merged.start_time == datetime(2026, 7, 8, 10, 0, 0)
    assert merged.end_time == datetime(2026, 7, 8, 10, 10, 0)
```

- [ ] **Step 6: Run merger test to verify it fails**

Run: `pytest tests/test_merger.py -v`
Expected: FAIL

- [ ] **Step 7: Implement merger.py**

```python
# src/toki_musume/core/merger.py
"""Activity merger: combines consecutive same-category activities."""

from __future__ import annotations

from ..storage.models import Activity


class ActivityMerger:
    """Decides whether to merge consecutive activities and performs the merge."""

    def __init__(self, idle_threshold_seconds: int = 300) -> None:
        self._idle_threshold = idle_threshold_seconds

    def should_merge(self, prev: Activity, current: Activity) -> bool:
        """Return True if current activity should be merged into prev."""
        if prev.category != current.category:
            return False
        if prev.classification_method != current.classification_method:
            return False
        # Check gap between activities
        if prev.end_time and current.start_time:
            gap = (current.start_time - prev.end_time).total_seconds()
            if gap > self._idle_threshold:
                return False
        return True

    def merge(self, prev: Activity, current: Activity) -> Activity:
        """Merge current into prev, returning updated Activity."""
        new_end = current.end_time or current.start_time
        new_duration = int((new_end - prev.start_time).total_seconds())
        return Activity(
            start_time=prev.start_time,
            end_time=new_end,
            process_name=prev.process_name,
            window_title=prev.window_title,
            category=prev.category,
            sub_category=prev.sub_category,
            confidence=prev.confidence,
            classification_method=prev.classification_method,
            duration_seconds=new_duration,
        )
```

- [ ] **Step 8: Run merger test to verify it passes**

Run: `pytest tests/test_merger.py -v`
Expected: All 3 tests PASS

- [ ] **Step 9: Create core/__init__.py and core/engine.py**

```python
# src/toki_musume/core/__init__.py
"""Core module for TokiMusume."""
```

```python
# src/toki_musume/core/engine.py
"""Core engine: orchestrates monitor, classifier, merger, and storage."""

from __future__ import annotations

import logging
from datetime import datetime

from ..config import Config
from ..storage.database import Database
from ..storage.models import Activity, CategoryRule
from ..monitor.collector import ActivityCollector
from ..monitor.window import WindowInfo
from .classifier import ActivityClassifier
from .merger import ActivityMerger

logger = logging.getLogger(__name__)


class CoreEngine:
    """Central orchestrator for TokiMusume."""

    def __init__(self, config: Config, database: Database) -> None:
        self._config = config
        self._db = database
        self._classifier = ActivityClassifier(rules=database.get_category_rules())
        self._merger = ActivityMerger(idle_threshold_seconds=config.monitor.idle_threshold_seconds)
        self._collector = ActivityCollector(config, database)
        self._current_activity: Activity | None = None
        self._on_reminder_check = None

        # Wire collector callback
        self._collector.set_on_activity(self._on_new_activity)

    def start(self) -> None:
        """Start the core engine and all subsystems."""
        self._ensure_default_rules()
        self._classifier = ActivityClassifier(rules=self._db.get_category_rules())
        self._collector.start()
        logger.info("Core engine started")

    def stop(self) -> None:
        """Stop all subsystems."""
        self._finish_current_activity()
        self._collector.stop()
        logger.info("Core engine stopped")

    def _on_new_activity(self, info: WindowInfo) -> None:
        """Called by collector when new window info is available."""
        now = datetime.now()
        result = self._classifier.classify(info.process_name, info.window_title)

        new_activity = Activity(
            start_time=now,
            process_name=info.process_name,
            window_title=info.window_title,
            category=result.category,
            sub_category=result.sub_category,
            confidence=result.confidence,
            classification_method=result.method,
        )

        if self._current_activity and self._merger.should_merge(self._current_activity, new_activity):
            # Merge: update in place
            self._current_activity = self._merger.merge(self._current_activity, new_activity)
        else:
            # New activity: finish previous, start new
            self._finish_current_activity()
            self._current_activity = new_activity

    def _finish_current_activity(self) -> None:
        """Write current activity to database if it exists."""
        if not self._current_activity:
            return
        now = datetime.now()
        self._current_activity.end_time = now
        self._current_activity.duration_seconds = int(
            (now - self._current_activity.start_time).total_seconds()
        )
        if self._current_activity.duration_seconds > 0:
            self._db.insert_activity(self._current_activity)
        self._current_activity = None

    def _ensure_default_rules(self) -> None:
        """Populate default category rules if the table is empty."""
        existing = self._db.get_category_rules()
        if existing:
            return

        categories = self._config.monitor.categories
        for category, patterns in categories.items():
            for pattern in patterns:
                self._db.insert_category_rule(CategoryRule(
                    pattern=pattern,
                    field="window_title",
                    category=category,
                ))
        logger.info("Populated default category rules from config")
```

- [ ] **Step 10: Run all tests**

Run: `pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat: core module with classifier, merger, and engine"
```

---

### Task 6: LLM Module

**Files:**
- Create: `src/toki_musume/llm/__init__.py`
- Create: `src/toki_musume/llm/client.py`
- Create: `src/toki_musume/llm/prompts.py`
- Create: `tests/test_llm_client.py`

- [ ] **Step 1: Write failing test for LLM client**

```python
# tests/test_llm_client.py
import pytest
from unittest.mock import patch, MagicMock
from toki_musume.llm.client import LLMClient
from toki_musume.llm.prompts import build_reminder_prompt, build_report_prompt
from toki_musume.config import LLMConfig, PersonaConfig, PersonalityConfig


@pytest.fixture
def llm_config():
    return LLMConfig(provider="openai", model="gpt-4o-mini", api_key="test-key")


@pytest.fixture
def persona_config():
    return PersonaConfig(
        user_name="主人",
        companion_name="偷瞄姬",
        personality=PersonalityConfig(tsundere=3, strictness=5, playfulness=6, caring=8, chattiness=5),
    )


def test_build_reminder_prompt_contains_persona(persona_config):
    prompt = build_reminder_prompt(
        persona=persona_config,
        mode="companion",
        reminder_type="rest",
        context="已经连续编码90分钟",
    )
    assert "偷瞄姬" in prompt
    assert "主人" in prompt
    assert "companion" in prompt


def test_build_report_prompt_contains_persona(persona_config):
    prompt = build_report_prompt(
        persona=persona_config,
        mode="companion",
        stats="coding: 3600s, gaming: 1800s",
    )
    assert "偷瞄姬" in prompt


@patch("toki_musume.llm.client.openai.OpenAI")
def test_llm_client_chat(mock_openai_cls, llm_config):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "主人，该休息了哦~"
    mock_client.chat.completions.create.return_value = mock_response

    client = LLMClient(llm_config)
    result = client.chat("你是偷瞄姬，提醒主人休息")
    assert result == "主人，该休息了哦~"


def test_llm_client_fallback_on_error(llm_config):
    llm_config.api_key = ""  # Empty key should trigger fallback
    client = LLMClient(llm_config)
    result = client.chat("test", fallback="默认消息")
    assert result == "默认消息"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_llm_client.py -v`
Expected: FAIL

- [ ] **Step 3: Create llm/__init__.py**

```python
"""LLM module for TokiMusume."""
```

- [ ] **Step 4: Create llm/prompts.py**

```python
# src/toki_musume/llm/prompts.py
"""Prompt templates for LLM interactions."""

from __future__ import annotations

from ..config import PersonaConfig


def _personality_description(persona: PersonaConfig) -> str:
    p = persona.personality
    traits = []
    if p.tsundere >= 5:
        traits.append("嘴硬心软，经常傲娇")
    elif p.tsundere >= 3:
        traits.append("偶尔傲娇地调侃")
    if p.strictness >= 7:
        traits.append("非常严格")
    elif p.strictness >= 4:
        traits.append("有原则但不苛刻")
    if p.playfulness >= 5:
        traits.append("爱开玩笑，俏皮")
    if p.caring >= 7:
        traits.append("非常关心，无微不至")
    elif p.caring >= 4:
        traits.append("关心但不过度")
    if p.chattiness >= 7:
        traits.append("话很多")
    elif p.chattiness >= 4:
        traits.append("适度聊天")
    return "、".join(traits) if traits else "温和友善"


def build_system_prompt(persona: PersonaConfig, mode: str) -> str:
    """Build the system prompt with persona and mode."""
    personality = _personality_description(persona)
    mode_desc = "监督模式（更严格，认真提醒）" if mode == "supervise" else "陪伴模式（更轻松，调皮互动）"
    return f"""你是{persona.companion_name}，{persona.user_name}的时间管理伙伴。
你的性格：{personality}。
当前处于{mode_desc}。
{persona.personality_prompt}
请用中文回复，保持角色性格。回复简洁（1-3句话）。"""


def build_reminder_prompt(persona: PersonaConfig, mode: str, reminder_type: str, context: str) -> str:
    """Build prompt for reminder message generation."""
    system = build_system_prompt(persona, mode)
    user = f"提醒类型：{reminder_type}\n上下文：{context}\n请生成一条提醒消息。"
    return f"{system}\n\n{user}"


def build_report_prompt(persona: PersonaConfig, mode: str, stats: str) -> str:
    """Build prompt for daily report generation."""
    system = build_system_prompt(persona, mode)
    user = f"以下是今日活动统计：\n{stats}\n\n请生成一段简短的今日点评（2-4句话），包含亮点和改进建议。"
    return f"{system}\n\n{user}"
```

- [ ] **Step 5: Create llm/client.py**

```python
# src/toki_musume/llm/client.py
"""Unified LLM API client for TokiMusume."""

from __future__ import annotations

import logging

from ..config import LLMConfig

logger = logging.getLogger(__name__)


class LLMClient:
    """Client for interacting with LLM APIs."""

    def __init__(self, config: LLMConfig) -> None:
        self._config = config
        self._client = None
        self._init_client()

    def _init_client(self) -> None:
        """Initialize the LLM client based on provider config."""
        if not self._config.api_key:
            logger.warning("No API key configured, LLM calls will use fallback")
            return

        try:
            if self._config.provider == "openai":
                import openai
                kwargs = {"api_key": self._config.api_key}
                if self._config.base_url:
                    kwargs["base_url"] = self._config.base_url
                self._client = openai.OpenAI(**kwargs)
            elif self._config.provider == "anthropic":
                import anthropic
                kwargs = {"api_key": self._config.api_key}
                if self._config.base_url:
                    kwargs["base_url"] = self._config.base_url
                self._client = anthropic.Anthropic(**kwargs)
            else:
                # Custom provider: try OpenAI-compatible API
                import openai
                self._client = openai.OpenAI(
                    api_key=self._config.api_key,
                    base_url=self._config.base_url or "http://localhost:8000/v1",
                )
        except Exception:
            logger.exception("Failed to initialize LLM client")
            self._client = None

    def chat(self, prompt: str, fallback: str = "") -> str:
        """Send a prompt and get a response. Returns fallback on error."""
        if not self._client:
            logger.debug("LLM client not available, using fallback")
            return fallback

        try:
            if self._config.provider == "anthropic":
                response = self._client.messages.create(
                    model=self._config.model,
                    max_tokens=self._config.max_tokens,
                    messages=[{"role": "user", "content": prompt}],
                )
                return response.content[0].text
            else:
                # OpenAI-compatible
                response = self._client.chat.completions.create(
                    model=self._config.model,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                    messages=[{"role": "user", "content": prompt}],
                )
                return response.choices[0].message.content or fallback
        except Exception:
            logger.exception("LLM call failed, using fallback")
            return fallback
```

- [ ] **Step 6: **Step 6: Run test to verify it passes**

Run: `pytest tests/test_llm_client.py -v`
Expected: All 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: LLM module with multi-provider client and prompt templates"
```

---

### Task 7: Reminder Module

**Files:**
- Create: `src/toki_musume/reminder/__init__.py`
- Create: `src/toki_musume/reminder/rules.py`
- Create: `src/toki_musume/reminder/engine.py`
- Create: `tests/test_reminder_rules.py`
- Create: `tests/test_reminder_engine.py`

- [ ] **Step 1: Write failing test for reminder rules**

```python
# tests/test_reminder_rules.py
import pytest
from toki_musume.reminder.rules import ReminderRule, RuleChecker
from toki_musume.config import ReminderRuleConfig


def test_rest_rule_triggers_on_continuous_work():
    rule = ReminderRule(config=ReminderRuleConfig(type="rest", continuous_work_minutes=90))
    assert rule.should_trigger(current_category="coding", duration_minutes=95) is True
    assert rule.should_trigger(current_category="coding", duration_minutes=80) is False


def test_anti_slack_rule_triggers_on_slack_category():
    rule = ReminderRule(config=ReminderRuleConfig(
        type="anti_slack",
        categories=["gaming", "social_media", "video"],
        threshold_minutes=30,
    ))
    assert rule.should_trigger(current_category="gaming", duration_minutes=35) is True
    assert rule.should_trigger(current_category="coding", duration_minutes=35) is False
    assert rule.should_trigger(current_category="gaming", duration_minutes=20) is False


def test_late_night_rule_triggers():
    rule = ReminderRule(config=ReminderRuleConfig(
        type="late_night",
        start_hour=0,
        end_hour=6,
    ))
    assert rule.check_time(hour=2) is True
    assert rule.check_time(hour=10) is False
    assert rule.check_time(hour=0) is True
    assert rule.check_time(hour=5) is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_reminder_rules.py -v`
Expected: FAIL

- [ ] **Step 3: Create reminder/__init__.py**

```python
"""Reminder module for TokiMusume."""
```

- [ ] **Step 4: Create reminder/rules.py**

```python
# src/toki_musume/reminder/rules.py
"""Reminder rule definitions and checking logic."""

from __future__ import annotations

from ..config import ReminderRuleConfig


class ReminderRule:
    """A single reminder rule that can check if it should trigger."""

    def __init__(self, config: ReminderRuleConfig) -> None:
        self.config = config

    @property
    def rule_type(self) -> str:
        return self.config.type

    @property
    def cooldown_minutes(self) -> int:
        return self.config.cooldown_minutes

    def should_trigger(self, current_category: str, duration_minutes: int) -> bool:
        """Check if this rule should trigger based on current activity."""
        if self.config.type == "rest":
            return duration_minutes >= self.config.continuous_work_minutes
        elif self.config.type == "anti_slack":
            if current_category not in self.config.categories:
                return False
            return duration_minutes >= self.config.threshold_minutes
        return False

    def check_time(self, hour: int) -> bool:
        """Check if current hour is within the rule's time range."""
        if self.config.type != "late_night":
            return False
        start = self.config.start_hour
        end = self.config.end_hour
        if start <= end:
            return start <= hour < end
        else:  # wraps midnight
            return hour >= start or hour < end
```

- [ ] **Step 5: Run reminder rules test**

Run: `pytest tests/test_reminder_rules.py -v`
Expected: All 3 tests PASS

- [ ] **Step 6: Write failing test for reminder engine**

```python
# tests/test_reminder_engine.py
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from toki_musume.reminder.engine import ReminderEngine
from toki_musume.reminder.rules import ReminderRule
from toki_musume.config import ReminderRuleConfig, Config
from toki_musume.storage.database import Database
from toki_musume.llm.client import LLMClient


@pytest.fixture
def mock_db(tmp_path):
    db = Database(str(tmp_path / "test.db"))
    db.initialize()
    return db


@pytest.fixture
def mock_llm():
    client = MagicMock(spec=LLMClient)
    client.chat.return_value = "主人，该休息了哦~"
    return client


@pytest.fixture
def engine(mock_db, mock_llm):
    rules = [
        ReminderRule(ReminderRuleConfig(type="rest", continuous_work_minutes=90, cooldown_minutes=30)),
        ReminderRule(ReminderRuleConfig(
            type="anti_slack", categories=["gaming"], threshold_minutes=30, cooldown_minutes=45,
        )),
    ]
    return ReminderEngine(rules=rules, database=mock_db, llm_client=mock_llm, mode="companion")


def test_check_reminders_rest_triggered(engine, mock_llm):
    messages = engine.check(current_category="coding", duration_minutes=95)
    assert len(messages) >= 1
    assert any("休息" in m or "rest" in m.lower() for m in messages)
    mock_llm.chat.assert_called()


def test_check_reminders_no_trigger(engine, mock_llm):
    messages = engine.check(current_category="coding", duration_minutes=30)
    assert len(messages) == 0


def test_check_reminders_cooldown_prevents_repeat(engine, mock_db, mock_llm):
    # First trigger
    messages1 = engine.check(current_category="coding", duration_minutes=95)
    assert len(messages1) >= 1
    # Second trigger within cooldown
    messages2 = engine.check(current_category="coding", duration_minutes=100)
    assert len(messages2) == 0  # cooldown blocks
```

- [ ] **Step 7: Run test to verify it fails**

Run: `pytest tests/test_reminder_engine.py -v`
Expected: FAIL

- [ ] **Step 8: Create reminder/engine.py**

```python
# src/toki_musume/reminder/engine.py
"""Reminder engine: checks rules, manages cooldown, generates messages."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Callable

from .rules import ReminderRule
from ..storage.database import Database
from ..llm.client import LLMClient
from ..llm.prompts import build_reminder_prompt
from ..config import PersonaConfig

logger = logging.getLogger(__name__)


class ReminderEngine:
    """Checks reminder rules and generates notification messages."""

    def __init__(
        self,
        rules: list[ReminderRule],
        database: Database,
        llm_client: LLMClient,
        mode: str = "companion",
        persona: PersonaConfig | None = None,
    ) -> None:
        self._rules = rules
        self._db = database
        self._llm = llm_client
        self._mode = mode
        self._persona = persona
        self._on_reminder: Callable[[str], None] | None = None

    def set_on_reminder(self, callback: Callable[[str], None]) -> None:
        """Set callback for when a reminder is generated."""
        self._on_reminder = callback

    def set_mode(self, mode: str) -> None:
        """Switch between 'supervise' and 'companion' mode."""
        self._mode = mode

    def check(self, current_category: str, duration_minutes: int) -> list[str]:
        """Check all rules and return list of reminder messages."""
        now = datetime.now()
        messages = []

        for rule in self._rules:
            # Late night check
            if rule.rule_type == "late_night":
                if rule.check_time(now.hour) and not self._db.is_in_cooldown(rule.rule_type, now, rule.cooldown_minutes):
                    msg = self._generate_message(rule.rule_type, f"现在是凌晨{now.hour}点，还在用电脑")
                    if msg:
                        messages.append(msg)
                        self._db.insert_reminder_history(__import__('toki_musume.storage.models', fromlist=['ReminderHistory']).ReminderHistory(
                            rule_type=rule.rule_type, triggered_at=now, message=msg,
                        ))
                continue

            # Activity-based check
            if rule.should_trigger(current_category, duration_minutes):
                if self._db.is_in_cooldown(rule.rule_type, now, rule.cooldown_minutes):
                    continue

                context = self._build_context(rule, current_category, duration_minutes)
                msg = self._generate_message(rule.rule_type, context)
                if msg:
                    messages.append(msg)
                    from ..storage.models import ReminderHistory
                    self._db.insert_reminder_history(ReminderHistory(
                        rule_type=rule.rule_type, triggered_at=now, message=msg,
                    ))

                    if self._on_reminder:
                        self._on_reminder(msg)

        return messages

    def _build_context(self, rule: ReminderRule, category: str, duration: int) -> str:
        """Build context string for LLM prompt."""
        if rule.rule_type == "rest":
            return f"已经连续{category}了{duration}分钟"
        elif rule.rule_type == "anti_slack":
            return f"在{category}上花了{duration}分钟"
        return f"活动类型：{category}，持续{duration}分钟"

    def _generate_message(self, rule_type: str, context: str) -> str:
        """Generate a reminder message using LLM or fallback."""
        fallback_map = {
            "rest": "该休息一下了~",
            "anti_slack": "是不是该做点正事了？",
            "late_night": "很晚了，该睡觉了~",
        }
        fallback = fallback_map.get(rule_type, "提醒你一下~")

        if self._persona:
            prompt = build_reminder_prompt(self._persona, self._mode, rule_type, context)
            return self._llm.chat(prompt, fallback=fallback)
        return fallback
```

- [ ] **Step 9: Run reminder engine test**

Run: `pytest tests/test_reminder_engine.py -v`
Expected: All 3 tests PASS

- [ ] **Step 10: Run all tests**

Run: `pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat: reminder module with rule checking, cooldown, and LLM message generation"
```

---

### Task 8: Report Module

**Files:**
- Create: `src/toki_musume/report/__init__.py`
- Create: `src/toki_musume/report/generator.py`
- Create: `tests/test_report_generator.py`

- [ ] **Step 1: Write failing test for report generator**

```python
# tests/test_report_generator.py
import pytest
from datetime import datetime
from unittest.mock import MagicMock
from toki_musume.report.generator import ReportGenerator
from toki_musume.storage.database import Database
from toki_musume.storage.models import Activity
from toki_musume.llm.client import LLMClient
from toki_musume.config import PersonaConfig, PersonalityConfig


@pytest.fixture
def mock_db(tmp_path):
    db = Database(str(tmp_path / "test.db"))
    db.initialize()
    return db


@pytest.fixture
def mock_llm():
    client = MagicMock(spec=LLMClient)
    client.chat.return_value = "今天编码效率不错！下午有点摸鱼，明天加油~"
    return client


@pytest.fixture
def persona():
    return PersonaConfig(
        user_name="主人",
        companion_name="偷瞄姬",
        personality=PersonalityConfig(),
    )


@pytest.fixture
def generator(mock_db, mock_llm, persona):
    return ReportGenerator(database=mock_db, llm_client=mock_llm, persona=persona)


def test_generate_daily_report_with_data(generator, mock_db, mock_llm):
    # Insert test activities
    mock_db.insert_activity(Activity(
        start_time=datetime(2026, 7, 8, 10, 0, 0),
        end_time=datetime(2026, 7, 8, 12, 0, 0),
        process_name="Code.exe", window_title="test",
        category="coding", confidence=1.0, classification_method="rule",
        duration_seconds=7200,
    ))
    mock_db.insert_activity(Activity(
        start_time=datetime(2026, 7, 8, 13, 0, 0),
        end_time=datetime(2026, 7, 8, 14, 0, 0),
        process_name="Steam.exe", window_title="Steam",
        category="gaming", confidence=1.0, classification_method="rule",
        duration_seconds=3600,
    ))

    report = generator.generate_daily_report("2026-07-08")
    assert "coding" in report.category_durations
    assert "gaming" in report.category_durations
    assert report.summary != ""
    mock_llm.chat.assert_called_once()


def test_generate_daily_report_no_data(generator, mock_db):
    report = generator.generate_daily_report("2026-07-08")
    assert report.category_durations == {}
    assert report.summary == "今天没有记录到活动数据。"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_report_generator.py -v`
Expected: FAIL

- [ ] **Step 3: Create report/__init__.py**

```python
"""Report module for TokiMusume."""
```

- [ ] **Step 4: Create report/generator.py**

```python
# src/toki_musume/report/generator.py
"""Daily and weekly report generator."""

from __future__ import annotations

import json
import logging

from ..storage.database import Database
from ..storage.models import DailySummary
from ..llm.client import LLMClient
from ..llm.prompts import build_report_prompt
from ..config import PersonaConfig

logger = logging.getLogger(__name__)


class ReportGenerator:
    """Generates daily and weekly activity reports."""

    def __init__(
        self,
        database: Database,
        llm_client: LLMClient,
        persona: PersonaConfig | None = None,
        mode: str = "companion",
    ) -> None:
        self._db = database
        self._llm = llm_client
        self._persona = persona
        self._mode = mode

    def generate_daily_report(self, date: str) -> DailySummary:
        """Generate a daily report for the given date (YYYY-MM-DD)."""
        durations = self._db.get_category_durations_by_date(date)

        if not durations:
            return DailySummary(
                date=date,
                summary="今天没有记录到活动数据。",
                category_durations="{}",
                raw_stats="{}",
            )

        # Build stats text for LLM
        stats_lines = []
        for category, seconds in sorted(durations.items(), key=lambda x: x[1], reverse=True):
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            if hours > 0:
                stats_lines.append(f"{category}: {hours}小时{minutes}分钟")
            else:
                stats_lines.append(f"{category}: {minutes}分钟")
        stats_text = "\n".join(stats_lines)

        # Generate LLM summary
        if self._persona:
            prompt = build_report_prompt(self._persona, self._mode, stats_text)
            summary = self._llm.chat(prompt, fallback=f"今日活动统计：{stats_text}")
        else:
            summary = f"今日活动统计：{stats_text}"

        report = DailySummary(
            date=date,
            summary=summary,
            category_durations=json.dumps(durations, ensure_ascii=False),
            raw_stats=json.dumps(durations, ensure_ascii=False),
        )

        # Save to database
        self._db.insert_daily_summary(report)
        logger.info("Generated daily report for %s", date)

        return report
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_report_generator.py -v`
Expected: All 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: report module with daily report generation and LLM summary"
```

---

### Task 9: UI Module (System Tray + Notifications)

**Files:**
- Create: `src/toki_musume/ui/__init__.py`
- Create: `src/toki_musume/ui/tray.py`
- Create: `src/toki_musume/ui/notification.py`

- [ ] **Step 1: Create ui/__init__.py**

```python
"""UI module for TokiMusume."""
```

- [ ] **Step 2: Create ui/notification.py**

```python
# src/toki_musume/ui/notification.py
"""Notification helper for system tray bubble messages."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def show_notification(tray_icon, title: str, message: str, duration_ms: int = 5000) -> None:
    """Show a system tray bubble notification.

    Args:
        tray_icon: QSystemTrayIcon instance
        title: Notification title
        message: Notification body text
        duration_ms: How long to show the notification
    """
    try:
        from PyQt6.QtWidgets import QSystemTrayIcon
        tray_icon.showMessage(title, message, QSystemTrayIcon.MessageIcon.Information, duration_ms)
        logger.debug("Notification shown: %s - %s", title, message)
    except Exception:
        logger.exception("Failed to show notification")
```

- [ ] **Step 3: Create ui/tray.py**

```python
# src/toki_musume/ui/tray.py
"""System tray icon and menu for TokiMusume."""

from __future__ import annotations

import logging
import sys

from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMenu
from PyQt6.QtGui import QIcon, QAction
from PyQt6.QtCore import QObject, pyqtSignal

from .notification import show_notification
from ..config import Config
from ..core.engine import CoreEngine
from ..reminder.engine import ReminderEngine
from ..report.generator import ReportGenerator

logger = logging.getLogger(__name__)


class TrayApp(QObject):
    """System tray application with menu and signal handling."""

    reminder_signal = pyqtSignal(str)  # Emitted when a reminder message is ready

    def __init__(self, config: Config, engine: CoreEngine, reminder_engine: ReminderEngine, report_generator: ReportGenerator) -> None:
        super().__init__()
        self._config = config
        self._engine = engine
        self._reminder_engine = reminder_engine
        self._report_generator = report_generator
        self._app: QApplication | None = None
        self._tray: QSystemTrayIcon | None = None

    def run(self) -> None:
        """Start the Qt application and system tray."""
        self._app = QApplication(sys.argv)
        self._app.setQuitOnLastWindowClosed(False)

        # Create tray icon
        self._tray = QSystemTrayIcon()
        # Use a default application icon for now
        self._tray.setIcon(self._app.style().standardIcon(self._app.style().StandardPixmap.SP_ComputerIcon))
        self._tray.setToolTip(f"{self._config.persona.companion_name} (偷瞄姬)")

        # Create context menu
        menu = QMenu()

        # Mode actions
        supervise_action = QAction("🎯 设定目标（监督模式）", menu)
        supervise_action.triggered.connect(self._set_supervise_mode)
        menu.addAction(supervise_action)

        companion_action = QAction("🏠 休息一下（陪伴模式）", menu)
        companion_action.triggered.connect(self._set_companion_mode)
        menu.addAction(companion_action)

        menu.addSeparator()

        # Report action
        report_action = QAction("📊 查看今日报告", menu)
        report_action.triggered.connect(self._show_daily_report)
        menu.addAction(report_action)

        menu.addSeparator()

        # Quit action
        quit_action = QAction("退出", menu)
        quit_action.triggered.connect(self._quit)
        menu.addAction(quit_action)

        self._tray.setContextMenu(menu)

        # Connect reminder signal
        self.reminder_signal.connect(self._on_reminder)

        # Wire reminder engine callback
        self._reminder_engine.set_on_reminder(
            lambda msg: self.reminder_signal.emit(msg)
        )

        # Show tray and start engine
        self._tray.show()
        self._engine.start()

        # Welcome notification
        show_notification(self._tray, self._config.persona.companion_name, "偷瞄姬已启动~我会偷偷看着你的哦")

        logger.info("Tray app started")
        sys.exit(self._app.exec())

    def _set_supervise_mode(self) -> None:
        self._reminder_engine.set_mode("supervise")
        if self._tray:
            show_notification(self._tray, "监督模式", "偷瞄姬会严格盯着你的！加油~")

    def _set_companion_mode(self) -> None:
        self._reminder_engine.set_mode("companion")
        if self._tray:
            show_notification(self._tray, "陪伴模式", "偷瞄姬会轻松陪着你~")

    def _show_daily_report(self) -> None:
        from datetime import date
        today = date.today().isoformat()
        report = self._report_generator.generate_daily_report(today)
        if self._tray:
            show_notification(self._tray, f"今日报告 ({today})", report.summary, duration_ms=10000)

    def _on_reminder(self, message: str) -> None:
        """Handle reminder signal on the UI thread."""
        if self._tray:
            show_notification(self._tray, self._config.persona.companion_name, message)

    def _quit(self) -> None:
        self._engine.stop()
        if self._app:
            self._app.quit()
```

- [ ] **Step 4: Verify tray module imports correctly**

Run: `python -c "from toki_musume.ui.tray import TrayApp; print('OK')"`
Expected: OK

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: UI module with system tray, notifications, and mode switching"
```

---

### Task 10: Main Entry Point Integration

**Files:**
- Modify: `src/toki_musume/main.py`

- [ ] **Step 1: Update main.py to wire everything together**

```python
# src/toki_musume/main.py
"""Entry point for TokiMusume (偷瞄姬)."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from .config import Config, load_config
from .storage.database import Database
from .core.engine import CoreEngine
from .reminder.rules import ReminderRule
from .reminder.engine import ReminderEngine
from .report.generator import ReportGenerator
from .llm.client import LLMClient
from .ui.tray import TrayApp


def find_config() -> Path:
    """Find config.yaml, searching common locations."""
    candidates = [
        Path("config.yaml"),
        Path(__file__).parent.parent.parent / "config.yaml",
        Path.home() / ".toki-musume" / "config.yaml",
    ]
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError(
        "config.yaml not found. Copy config.example.yaml to config.yaml and fill in your settings."
    )


def main() -> None:
    """Start TokiMusume application."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )
    logger = logging.getLogger(__name__)

    try:
        config_path = find_config()
        config = load_config(config_path)
        logger.info("Config loaded from %s", config_path)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Initialize database
    db = Database(config.storage.db_path)
    db.initialize()

    # Initialize LLM client
    llm_client = LLMClient(config.llm)

    # Initialize core engine
    engine = CoreEngine(config, db)

    # Initialize reminder engine
    reminder_rules = [ReminderRule(rc) for rc in config.reminders]
    reminder_engine = ReminderEngine(
        rules=reminder_rules,
        database=db,
        llm_client=llm_client,
        mode="companion",
        persona=config.persona,
    )

    # Initialize report generator
    report_generator = ReportGenerator(
        database=db,
        llm_client=llm_client,
        persona=config.persona,
    )

    # Start tray app (this blocks until quit)
    tray_app = TrayApp(config, engine, reminder_engine, report_generator)
    tray_app.run()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run all tests**

Run: `pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: wire all modules together in main entry point"
```

---

### Task 11: End-to-End Smoke Test

**Files:**
- None (manual verification)

- [ ] **Step 1: Install the package**

Run: `pip install -e .`

- [ ] **Step 2: Copy config and set API key**

Run: `cp config.example.yaml config.yaml`
Then edit `config.yaml` and fill in `llm.api_key` with a real key (or leave empty for fallback mode).

- [ ] **Step 3: Run the app**

Run: `toki-musume`
Expected: System tray icon appears, welcome notification shows "偷瞄姬已启动~"

- [ ] **Step 4: Test mode switching**

Right-click tray icon → "🎯 设定目标（监督模式）"
Expected: Notification "监督模式"

Right-click tray icon → "🏠 休息一下（陪伴模式）"
Expected: Notification "陪伴模式"

- [ ] **Step 5: Test daily report**

Right-click tray icon → "📊 查看今日报告"
Expected: Notification with today's activity summary

- [ ] **Step 6: Test quit**

Right-click tray icon → "退出"
Expected: App exits cleanly

- [ ] **Step 7: Final commit**

```bash
git add -A && git commit -m "feat: V1 complete - TokiMusume (偷瞄姬) is alive!"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ L1 monitoring: Task 4 (window.py + collector.py)
- ✅ Rule-based classification: Task 5 (classifier.py)
- ✅ Activity merging: Task 5 (merger.py)
- ✅ SQLite storage: Task 3 (database.py + models.py)
- ✅ Reminder rules + cooldown: Task 7 (rules.py + engine.py)
- ✅ LLM message generation: Task 6 (client.py + prompts.py)
- ✅ Daily report: Task 8 (generator.py)
- ✅ System tray UI: Task 9 (tray.py + notification.py)
- ✅ Mode switching: Task 9 (tray menu)
- ✅ Config management: Task 2 (config.py)
- ❌ L2/L3 monitoring: deferred to V2
- ❌ App profiles / game interaction: deferred to V2
- ❌ Weekly report: deferred to V2
- ❌ Report viewer window: deferred to V2

**2. Placeholder scan:** No TBD/TODO/fill-in-later found. ✅

**3. Type consistency:** All dataclass fields, method names, and parameter types are consistent across tasks. ✅
