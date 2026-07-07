# Core Engine Spec

## Overview

Core Engine 是 TokiMusume 的中枢，负责调度所有子系统、管理活动分类和模式切换。

## Pre-Development Checklist

- [ ] 阅读 `docs/superpowers/specs/2026-07-06-toki-musume-design.md` 中的架构和核心引擎部分
- [ ] 确认分类规则表和活动合并逻辑的设计
- [ ] 确认监督/陪伴双模式的切换机制

## Key Rules

### 活动分类：规则优先，LLM 兜底

- 80% 的活动分类应通过本地正则匹配 `category_rules` 表完成
- 仅当规则未命中时才调用 LLM API
- 分类结果必须包含 `category`, `sub_category`, `confidence`, `classification_method` 四个字段
- `classification_method` 只能是 `"rule"` 或 `"llm"`

### 活动合并

- 连续相同分类的活动记录合并为一条，更新 `duration_seconds`
- 分类变化或空闲超过 `idle_threshold_seconds`（默认 300 秒）时，结束当前记录
- 合并逻辑在 `core/merger.py` 中实现

### 模式管理

- 两种模式：`supervise`（监督）和 `companion`（陪伴）
- 用户可通过托盘菜单或自然语言切换
- 自然语言意图由 LLM 解析，映射为 `Goal` 对象
- 模式影响提醒引擎的行为强度，不影响监控引擎的采集

### 调度器

- 使用 Python `threading` 或 `sched` 模块实现定时任务
- 定时任务包括：L1 轮询（5s）、L2 轮询（10s）、L3 OCR（30-60s）、日报生成、周报生成
- 调度器在 `main.py` 启动时初始化

## Anti-Patterns

- 不要在分类器中硬编码进程名，所有规则存入 `category_rules` 表
- 不要在 Core Engine 中直接操作 UI，通过信号/回调通知 UI 层
- 不要在主线程中执行 LLM 调用或 OCR，必须异步

## Reference Files

- 设计文档：`docs/superpowers/specs/2026-07-06-toki-musume-design.md`
