# Monitor Engine Spec

## Overview

Monitor Engine 负责采集用户当前活动信息，采用分层轮询策略。

## Pre-Development Checklist

- [ ] 确认 Win32 API 获取窗口标题和进程名的可行性
- [ ] 确认 OCR 库选型（PaddleOCR vs Tesseract）
- [ ] 确认区域化 OCR 的坐标配置方式

## Key Rules

### 分层采集

| 层级 | 方法 | 频率 | 触发 |
|------|------|------|------|
| L1 | `GetForegroundWindow` + `GetWindowTextW` + `GetWindowThreadProcessId` | 每 5 秒 | 始终启用 |
| L2 | 浏览器 Accessibility API | 每 10 秒 | 可选启用 |
| L3 | 截图 + OCR | 每 30-60 秒 | 仅当 L1 信息不足时 |

### L1 采集（必须实现）

- 使用 `ctypes.windll.user32` 调用 Win32 API
- 每次采集获取：`process_name`, `window_title`, `timestamp`
- 采集结果传给 Core Engine 的分类器

### L3 区域化 OCR

- 当检测到特定应用（匹配 `app_profiles.yaml`）时，仅截取配置的屏幕区域
- 区域坐标格式：`[x1, y1, x2, y2]`，像素单位
- OCR 结果存入 `activities.ocr_text` 字段
- 截图保存到 `storage.screenshot_dir`，按 `screenshot_save_days` 自动清理

### 采集调度

- `collector.py` 统一调度 L1/L2/L3
- L1 始终运行，L3 按需启用
- 采集间隔通过 `config.yaml` 的 `monitor.poll_interval_seconds` 和 `monitor.ocr_interval_seconds` 配置

## Anti-Patterns

- 不要在采集线程中做分类或 LLM 调用，采集只负责获取原始数据
- 不要全屏 OCR，必须使用区域化 OCR 降低资源消耗
- 不要保存不必要的截图，仅在有 OCR 需求时截图

## Reference Files

- 设计文档：`docs/superpowers/specs/2026-07-06-toki-musume-design.md`（采集策略部分）
