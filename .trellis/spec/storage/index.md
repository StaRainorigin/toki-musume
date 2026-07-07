# Storage Module Spec

## Overview

Storage Module 管理 SQLite 数据库，提供数据访问层供所有模块使用。

## Pre-Development Checklist

- [ ] 确认数据库表结构（activities, category_rules, goals, daily_summaries, weekly_summaries, reminder_rules, reminder_history）
- [ ] 确认 SQLite 连接管理策略
- [ ] 确认数据迁移方案

## Key Rules

### 数据库位置

- 默认路径：`./data/toki-musume.db`
- 通过 `config.yaml` 的 `storage.db_path` 配置
- 首次启动自动创建数据库和表

### 表结构

核心表（详见设计文档数据模型部分）：

- `activities` — 活动记录，含 start_time, end_time, process_name, window_title, category, sub_category, confidence, classification_method, duration_seconds, ocr_text, screenshot_path
- `category_rules` — 分类规则，含 pattern, field, category, sub_category, priority
- `goals` — 用户目标，含 goal_type, description, deadline, duration_minutes, focus_categories, status
- `daily_summaries` — 每日汇总，含 date, summary, category_durations(JSON), raw_stats(JSON)
- `weekly_summaries` — 每周汇总，含 week_start, summary, category_durations(JSON), raw_stats(JSON)
- `reminder_rules` — 提醒规则，含 rule_type, category, threshold_minutes, message_template, cooldown_minutes, enabled
- `reminder_history` — 提醒历史，含 rule_type, triggered_at, message

### 连接管理

- 使用 `sqlite3` 标准库
- 单例模式，全局共享一个连接
- 写操作使用 `with conn:` 上下文管理器自动提交/回滚
- 不使用 ORM，直接 SQL，保持轻量

### 数据清理

- 截图文件按 `screenshot_save_days`（默认 7 天）自动清理
- 活动记录不自动删除，但可手动归档

## Anti-Patterns

- 不要在多个线程中共享同一个 cursor，每个线程使用独立 cursor
- 不要在数据库中存储大块二进制数据（如截图），只存路径
- 不要使用外键约束，保持 SQLite 轻量灵活

## Reference Files

- 设计文档：`docs/superpowers/specs/2026-07-06-toki-musume-design.md`（数据模型部分）
