# TokiMusume (偷瞄姬)

> 偷偷瞄一眼，守护你的时间

一个 Windows 桌面应用，以二次元管家娘形象陪伴你，帮你管理时间、监督摸鱼、总结每日活动。
## ✨ 特性

- 🔍 **活动感知** — 自动识别你在做什么（窗口标题、进程名、OCR）
- 🎯 **监督模式** — 设定学习/工作目标，严格监督，摸鱼立刻提醒
- 🏠 **陪伴模式** — 无目标时轻松互动，调侃聊天，游戏时鼓励
- 🎮 **游戏感知** — 识别游戏战绩，赢了夸你，输了安慰你
- 📊 **每日/每周报告** — 自动汇总时间分布，時娘点评
- 💬 **拟人化互动** — 可自定义名字和性格，傲娇/温柔/毒舌随你选

## 🛠 技术栈

- **语言**: Python
- **UI**: PyQt6 + 系统托盘
- **数据库**: SQLite
- **AI**: 云端 LLM API (OpenAI / Anthropic)
- **OCR**: PaddleOCR / Tesseract
- **平台**: Windows

## 📦 安装

```bash
# 克隆仓库
git clone git@github.com:StaRainorigin/toki-musume.git
cd toki-musume

# 安装依赖
pip install -r requirements.txt

# 配置
cp config.example.yaml config.yaml
# 编辑 config.yaml，填入 LLM API Key
```

## 🚀 使用

```bash
python -m toki_musume
```

启动后時娘会安静地待在系统托盘，右键托盘图标可：
- 设定学习/工作目标（进入监督模式）
- 查看今日报告
- 修改设置
- 退出

## 🎭 性格定制

在 `config.yaml` 中自定义時娘的性格：

```yaml
persona:
  user_name: "主人"          # 你想被叫什么
  companion_name: "偷瞄姬"   # 伙伴叫什么
  personality:
    tsundere: 3              # 傲娇：0=温柔, 10=嘴硬心软
    strictness: 5            # 严厉：0=随和, 10=严格
    playfulness: 6           # 俏皮：0=正经, 10=爱开玩笑
    caring: 8                # 关心：0=冷淡, 10=无微不至
    chattiness: 5            # 话多：0=惜字如金, 10=话痨
```

## 🔮 未来计划

- [ ] Live2D 形象集成
- [ ] 语音交互 (TTS + STT)
- [ ] Agent 能力（主动建议、日程管理）
- [ ] 更多游戏档案（Valorant, CS2, ...）
- [ ] 插件系统

## 📄 License

MIT
