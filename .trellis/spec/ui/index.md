# UI Module Spec

## Overview

UI Module 基于 PyQt6 实现系统托盘、通知弹窗和报告查看窗口。

## Pre-Development Checklist

- [ ] 确认 PyQt6 系统托盘 API
- [ ] 确认通知弹窗的样式和交互
- [ ] 确认报告窗口的布局

## Key Rules

### 系统托盘

- 启动后最小化到系统托盘，不显示主窗口
- 托盘图标使用自定义图标（预留 Live2D 头像位置）
- 右键菜单项：
  - 设定目标（进入监督模式）
  - 休息一下（切换陪伴模式）
  - 查看今日报告
  - 设置
  - 退出

### 通知弹窗

- 使用 `QSystemTrayIcon.showMessage()` 显示气泡通知
- 通知内容来自 Reminder Engine 生成的消息
- 通知持续时间 5 秒
- 可选声音提示（通过 `QSound` 或系统通知音）

### 报告窗口

- 独立 PyQt 窗口，从托盘菜单打开
- 布局：
  - 左侧：日历选择器
  - 右侧上：分类时间统计图表（柱状图/饼图）
  - 右侧中：活动时间轴
  - 右侧下：偷瞄姬点评文本
- 图表使用 `matplotlib` 嵌入 PyQt（`FigureCanvasQTAgg`）

### UI 与引擎的通信

- UI 不直接调用引擎方法
- 通过 Qt 信号/槽机制通信
- 引擎发出信号（如 `reminder_triggered`, `report_ready`），UI 连接槽函数响应

## Anti-Patterns

- 不要在 UI 线程中执行耗时操作（LLM 调用、OCR、数据库查询）
- 不要创建主窗口，应用以托盘为主
- 不要使用阻塞式对话框，所有交互非阻塞

## Reference Files

- 设计文档：`docs/superpowers/specs/2026-07-06-toki-musume-design.md`（UI 形态部分）
