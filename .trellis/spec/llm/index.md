# LLM Module Spec

## Overview

LLM Module 封装云端 LLM API 调用，提供统一接口供分类器、提醒引擎、报告引擎使用。

## Pre-Development Checklist

- [ ] 确认支持的 LLM provider（OpenAI、Anthropic、自定义）
- [ ] 确认各场景的 prompt 模板设计
- [ ] 确认 API 调用的错误处理和重试策略

## Key Rules

### 多 Provider 支持

- 通过 `config.yaml` 的 `llm.provider` 选择 provider
- 支持：`openai`, `anthropic`, `custom`（自定义 base_url）
- `client.py` 提供统一接口，屏蔽 provider 差异

### Prompt 管理

- 所有 prompt 模板集中在 `prompts.py`
- Prompt 必须注入以下变量：
  - `{companion_name}` — 伙伴名字
  - `{user_name}` — 用户名字
  - `{personality}` — 性格维度描述
  - `{mode}` — 当前模式（supervise/companion）
  - 场景特定变量（如活动上下文、战绩数据等）

### Prompt 场景

| 场景 | 输入 | 输出 |
|------|------|------|
| 活动分类 | 窗口标题 + 进程名 + 最近活动序列 | category, sub_category, confidence |
| 提醒消息 | 提醒类型 + 活动上下文 + 性格 | 拟人化消息文本 |
| 报告点评 | 当日/周活动统计 | 自然语言总结 + 建议 |
| 目标解析 | 用户自然语言输入 | Goal 对象（type, description, deadline） |
| 游戏互动 | 游戏名 + OCR 战绩 + 性格 | 个性化反应消息 |

### 调用约束

- `max_tokens` 通过配置控制（默认 500）
- `temperature` 可配置（默认 0.8，保证表达多样性）
- LLM 调用必须异步，不阻塞主线程
- 调用失败时：分类场景回退到规则默认分类，提醒场景使用 fallback 消息

### API Key 管理

- API Key 存在 `config.yaml`，不提交到 Git
- `config.yaml` 已在 `.gitignore` 中（用户自行创建，从 `config.example.yaml` 复制）

## Anti-Patterns

- 不要在 prompt 中硬编码性格描述，必须从 `persona` 配置动态注入
- 不要同步调用 LLM，所有调用必须异步
- 不要在 LLM 返回格式上做严格解析假设，做好容错

## Reference Files

- 设计文档：`docs/superpowers/specs/2026-07-06-toki-musume-design.md`（性格系统 + LLM 设置部分）
