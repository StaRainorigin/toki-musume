# Reminder Engine Spec

## Overview

Reminder Engine 负责根据活动数据和用户目标，生成拟人化提醒消息。

## Pre-Development Checklist

- [ ] 确认提醒规则的数据模型和冷却机制
- [ ] 确认监督/陪伴模式对提醒行为的影响
- [ ] 确认 LLM 生成提醒消息的 prompt 模板

## Key Rules

### 双模式行为

| 提醒类型 | 监督模式 | 陪伴模式 |
|----------|----------|----------|
| 休息提醒 | 严格提醒 | 温和建议 |
| 摸鱼提醒 | 立刻警告 | 轻松调侃 |
| 学习提醒 | 强制提醒 | 不触发 |
| 游戏互动 | 不触发 | 根据战绩互动 |
| 久坐提醒 | 严格 | 温和 |
| 凌晨提醒 | 严格 | 温和 |
| 早上问候 | 不触发 | 问候 |

### 冷却机制

- 同类型提醒在 `cooldown_minutes` 内不重复触发
- 冷却记录存入 `reminder_history` 表
- 每次触发前查询 `reminder_history` 检查冷却

### 消息生成

- 提醒消息由 LLM 动态生成，基于：
  - 当前模式（supervise/companion）
  - 性格维度（tsundere, strictness, playfulness, caring, chattiness）
  - 用户名和伙伴名
  - 活动上下文（当前活动、持续时间）
- 不使用固定模板，保证每次表达有变化
- LLM prompt 在 `llm/prompts.py` 中管理

### 提醒规则配置

- 规则存入 `reminder_rules` 表 + `config.yaml`
- 用户可通过 UI 编辑规则
- 规则字段：`rule_type`, `category`, `threshold_minutes`, `cooldown_minutes`, `enabled`

## Anti-Patterns

- 不要硬编码提醒消息文本，必须通过 LLM 生成
- 不要忽略冷却机制，频繁提醒会打扰用户
- 不要在提醒引擎中直接弹窗，通过信号通知 UI 层

## Reference Files

- 设计文档：`docs/superpowers/specs/2026-07-06-toki-musume-design.md`（提醒系统部分）
