# App Profiles Spec

## Overview

App Profiles 管理特定应用的定制化档案，支持区域化 OCR 和游戏战绩互动。

## Pre-Development Checklist

- [ ] 确认 app_profiles.yaml 的数据结构
- [ ] 确认区域 OCR 的坐标配置和触发机制
- [ ] 确认内置游戏档案（LOL, Apex 等）

## Key Rules

### 档案结构

每个应用档案包含：
- `process` — 匹配的进程名列表
- `mode` — 互动模式（`companion` 游戏时不打扰，事后互动）
- `ocr_zones` — OCR 区域列表，每个区域含 name, region, trigger, fields
- `responses` — 预定义响应模板（LLM 可在此基础上润色）

### 区域 OCR

- `region` 格式：`[x1, y1, x2, y2]`，屏幕像素坐标
- `trigger` 定义何时触发 OCR：`match_end`（比赛结束时）
- V1 版本通过轮询检测窗口标题变化来判断比赛结束
- `fields` 定义要提取的字段名（如 kda, 胜负, 评分）

### 响应模板

- `responses` 是预定义的响应方向，不是固定文本
- LLM 基于 responses 方向 + 性格维度 + 实际数据生成最终消息
- 示例：`win: "赢了！好厉害~"` → LLM 可能生成 `"主人赢了！偷瞄姬觉得你超强的！"`

### 档案管理

- 内置档案在 `profiles/default_profiles.yaml`
- 用户自定义档案在项目根目录 `app_profiles.yaml`
- 用户档案优先级高于内置档案
- `manager.py` 负责加载和合并档案

## Anti-Patterns

- 不要硬编码游戏档案到 Python 代码中，必须用 YAML 配置
- 不要假设屏幕分辨率固定，区域坐标应支持相对坐标或用户自定义
- 不要在游戏进行中触发 OCR 或提醒，只在比赛结束后

## Reference Files

- 设计文档：`docs/superpowers/specs/2026-07-06-toki-musume-design.md`（应用定制档案部分）
