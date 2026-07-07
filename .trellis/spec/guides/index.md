# Cross-Layer Guides

## Project Architecture

TokiMusume (偷瞄姬) 是一个 Python Windows 桌面应用，单体模块化架构。

```
src/toki_musume/
├── main.py              # 入口
├── config.py            # 配置加载
├── core/                # 核心引擎
├── monitor/             # 活动采集
├── reminder/            # 提醒引擎
├── report/              # 报告引擎
├── llm/                 # LLM 客户端
├── storage/             # 数据库
├── profiles/            # 应用档案
└── ui/                  # 系统托盘 + 通知 + 报告窗口
```

## Data Flow

```
用户活动 → Monitor(采集) → Core(分类+合并) → Storage(持久化)
                                           → Reminder(检查+生成消息) → UI(通知)
                                           → Report(汇总) → UI(报告窗口)
```

## Key Conventions

### 配置管理

- 所有配置在 `config.yaml`，YAML 格式
- 用户从 `config.example.yaml` 复制，填入个人设置
- `config.yaml` 不提交 Git
- 配置通过 `config.py` 统一加载，提供类型安全的访问接口

### 异步设计

- 采集、LLM 调用、OCR 等耗时操作在后台线程
- UI 线程仅负责渲染和用户交互
- 模块间通过信号/回调通信，不直接调用

### LLM 使用原则

- 规则优先，LLM 兜底（分类场景）
- LLM 生成消息而非固定模板（提醒/报告场景）
- 所有 LLM 调用异步，失败有 fallback
- Prompt 模板集中管理，注入性格和上下文变量

### 性格系统

- 5 个数值维度（tsundere, strictness, playfulness, caring, chattiness）
- 维度值影响 LLM prompt，不硬编码行为
- 监督/陪伴模式通过调节 strictness 和 chattiness 的权重来改变行为强度

### 错误处理

- LLM 调用失败：分类回退到规则默认值，提醒使用 fallback 消息，报告标注"生成失败"
- OCR 失败：跳过本次 OCR，不影响 L1 采集
- 数据库错误：记录日志，不崩溃
- 所有错误通过 `logging` 模块记录，不 print

## Anti-Patterns

- 不要跨模块直接导入内部实现，通过公共接口访问
- 不要在多个模块中重复定义数据模型，集中在 `storage/models.py`
- 不要假设网络始终可用，所有 LLM 调用必须有离线 fallback
