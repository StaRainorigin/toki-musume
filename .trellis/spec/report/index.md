# Report Engine Spec

## Overview

Report Engine 负责生成每日/每周活动汇总报告，包含 LLM 点评和可视化图表。

## Pre-Development Checklist

- [ ] 确认日报/周报的数据聚合逻辑
- [ ] 确认 LLM 生成报告的 prompt 模板
- [ ] 确认报告查看 UI 的布局和交互

## Key Rules

### 每日报告

- 自动生成时间：`config.yaml` 的 `report.daily_time`（默认 22:00）
- 可通过托盘菜单手动触发
- 内容：
  - 分类时间统计（柱状图）
  - 活动时间轴
  - 偷瞄姬点评（LLM 生成，结合性格维度）
  - 亮点与改进建议

### 每周报告

- 自动生成时间：`config.yaml` 的 `report.weekly_day` + `report.weekly_time`（默认周日 20:00）
- 汇总 7 天数据，对比上周变化
- LLM 生成趋势分析和建议

### 数据聚合

- 从 `activities` 表按日期范围查询
- 按 `category` 聚合 `duration_seconds`
- 结果存入 `daily_summaries` / `weekly_summaries` 表
- `category_durations` 字段存为 JSON：`{"coding": 3600, "gaming": 1800}`

### 报告查看 UI

- PyQt 窗口，从托盘右键菜单打开
- 包含：日历选择、时间轴、分类饼图/柱状图、LLM 点评文本
- 使用 `matplotlib` 或 `pyqtgraph` 绘制图表

## Anti-Patterns

- 不要在报告生成时做实时查询，先聚合再渲染
- 不要存储原始活动数据到 summary 表，只存聚合结果
- 报告生成失败不应影响其他系统运行

## Reference Files

- 设计文档：`docs/superpowers/specs/2026-07-06-toki-musume-design.md`（报告系统部分）
