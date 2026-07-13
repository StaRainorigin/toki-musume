import type {
  Mode, Goal, LogEvent, ForegroundWindow,
  PersonaConfig, LLMConfig, CompanionConfig, ChatLLMResponse,
} from './types'
import { DEFAULT_PERSONA, DEFAULT_LLM_CONFIG, DEFAULT_COMPANION_CONFIG } from './config'
import {
  createInitialState, startGoal, endGoal, startRest,
  enterCompanion, checkRestTimeout,
  type ModeMachineState,
} from './state/mode-machine'
import { WindowPoller } from './perception/poller'
import { checkIdle, createIdleDetectorState, type IdleDetectorState } from './perception/idle-detector'
import { AppProfileStore } from './slack/app-profiles'
import { SlackDetector } from './slack/detector'
import {
  createReminderState, checkReminderLevel, executeReminder,
  handleSokai, resetSlack, markSlackStart, updateLevel,
  type ReminderState,
} from './slack/reminder'
import { CompanionTriggerEngine, type CompanionEvent } from './companion/triggers'
import { arbitrate, generateCompanionMessage, computeNewCooldown } from './companion/arbiter'
import { LLMClient } from './llm/client'
import { buildSystemPrompt, buildChatPrompt } from './llm/prompts'
import { appendLog, saveRuntimeState, saveGoal, getIdleMs, writeConfigFile, listDailySummaries } from './tauri-bridge'
import { recoverState } from './recovery/runtime-state'
import { generateDailySummary } from './summary/daily'
import { SummaryScheduler } from './scheduler'
import type { DailySummary } from './types'

export type UIMessage = { role: 'user' | 'assistant' | 'system'; content: string; ts: number }

export type ControllerState = {
  mode: Mode
  activeGoal: Goal | null
  slackCount: number
}

export class AppController {
  private modeMachine: ModeMachineState = createInitialState()
  private poller = new WindowPoller()
  private idleState: IdleDetectorState = createIdleDetectorState()
  private reminderState: ReminderState = createReminderState()
  private profiles!: AppProfileStore
  private detector!: SlackDetector
  private triggerEngine!: CompanionTriggerEngine
  private llm!: LLMClient
  private scheduler!: SummaryScheduler
  persona: PersonaConfig = { ...DEFAULT_PERSONA }
  llmConfig: LLMConfig = { ...DEFAULT_LLM_CONFIG }
  companionConfig: CompanionConfig = { ...DEFAULT_COMPANION_CONFIG }
  private lastSpokeAt = 0
  private cooldownUntil = 0
  private chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  private slackCount = 0

  public onStateChange: ((state: ControllerState) => void) | null = null
  public onMessage: ((msg: UIMessage) => void) | null = null

  async init(): Promise<{ needsGoalTimeoutPrompt: boolean }> {
    const recovered = await recoverState()
    this.modeMachine = recovered.modeMachine
    this.profiles = recovered.profiles
    this.persona = recovered.persona
    this.llmConfig = recovered.llmConfig
    this.companionConfig = recovered.companionConfig
    this.llm = new LLMClient(this.llmConfig)
    this.detector = new SlackDetector(this.profiles, this.llm)
    this.triggerEngine = new CompanionTriggerEngine(this.profiles, (e) => this.handleCompanionEvent(e))
    this.scheduler = new SummaryScheduler(this.llm)

    this.pushSystem(`${this.persona.characterName} 已启动`)
    this.emitState()

    this.poller.start((win) => this.handleWindowChange(win))
    this.triggerEngine.startFallbackTimer(this.companionConfig.fallbackIntervalMinutes)
    this.scheduler.start()

    return { needsGoalTimeoutPrompt: recovered.needsGoalTimeoutPrompt }
  }

  private async handleWindowChange(win: ForegroundWindow): Promise<void> {
    const mode = this.modeMachine.mode
    const goal = this.modeMachine.activeGoal

    await this.log({
      ts: Date.now(), type: 'window_switch', mode,
      goalId: goal?.id, processName: win.processName, windowTitle: win.windowTitle,
    })

    const idleResult = await checkIdle(this.idleState)
    this.idleState = idleResult.state
    if (idleResult.transition) {
      await this.log({
        ts: Date.now(), type: idleResult.transition, mode,
        goalId: goal?.id,
        data: idleResult.transition === 'idle_started' ? { idleMinutes: 5 } : undefined,
      })
      this.triggerEngine.handleIdleTransition(
        idleResult.transition,
        idleResult.transition === 'idle_started' ? 5 : undefined,
      )
    }

    const restTimeout = checkRestTimeout(this.modeMachine, Date.now())
    if (restTimeout && restTimeout.ok) {
      this.modeMachine = restTimeout.state
      this.pushSystem('休息结束')
      await this.persistRuntimeState()
    }

    if ((mode === 'study' || mode === 'work') && goal) {
      const detection = await this.detector.detect(win, goal)
      if (detection.outcome === 'slacking') {
        this.reminderState = markSlackStart(this.reminderState)
        this.slackCount++
        await this.log({
          ts: Date.now(), type: 'slack_detected', mode, goalId: goal.id,
          processName: win.processName, note: `摸鱼：${win.windowTitle}`,
        })
      } else if (detection.outcome === 'working') {
        if (this.reminderState.slackStartedAt !== null) {
          this.reminderState = resetSlack(this.reminderState)
        }
      }

      const nextLevel = checkReminderLevel(this.reminderState)
      if (nextLevel && detection.needsReminder) {
        this.reminderState = updateLevel(this.reminderState, nextLevel)
        const { message, notified } = await executeReminder(this.llm, nextLevel, goal)
        this.pushAssistant(message)
        await this.log({
          ts: Date.now(), type: 'reminder', mode, goalId: goal.id,
          note: `第${nextLevel}级提醒${notified ? '（系统通知）' : ''}`,
          data: { level: nextLevel, message },
        })
      }
    }

    this.triggerEngine.handleWindowSwitch(win, mode)
    this.emitState()
  }

  private async handleCompanionEvent(event: CompanionEvent): Promise<void> {
    const ctx = {
      mode: this.modeMachine.mode,
      lastSpokeAt: this.lastSpokeAt,
      cooldownUntil: this.cooldownUntil,
      config: this.companionConfig,
      currentWindow: this.poller.getLastWindow() ?? undefined,
      isIdle: this.idleState.isIdle,
      idleMinutes: this.idleState.idleStartedAt
        ? Math.floor((Date.now() - this.idleState.idleStartedAt) / 60000)
        : undefined,
    }

    const decision = arbitrate(event, ctx)
    if (!decision.shouldSpeak) return

    const message = await generateCompanionMessage(this.llm, decision.prompt)
    this.pushAssistant(message)
    this.lastSpokeAt = Date.now()
    this.cooldownUntil = computeNewCooldown(this.companionConfig)
    await this.log({
      ts: Date.now(), type: 'companion_speak', mode: this.modeMachine.mode,
      note: message, data: { eventType: event.type },
    })
    await this.persistRuntimeState()
    this.emitState()
  }

  async handleUserMessage(text: string): Promise<void> {
    this.pushUser(text)
    this.chatHistory.push({ role: 'user', content: text })
    await this.log({
      ts: Date.now(), type: 'user_chat', mode: this.modeMachine.mode,
      goalId: this.modeMachine.activeGoal?.id, note: text,
    })

    if (this.llm.isConfigured('generate')) {
      const personaSystem = buildSystemPrompt(this.persona, this.modeMachine.mode, this.modeMachine.activeGoal)
      const { system: intentSystem, user } = buildChatPrompt(this.chatHistory, text)
      try {
        const result = await this.llm.chatWithIntent(
          [
            { role: 'system', content: personaSystem },
            { role: 'system', content: intentSystem },
            { role: 'user', content: user },
          ],
          'generate',
        )
        console.log('[DEBUG] LLM result:', JSON.stringify(result))
        this.pushAssistant(result.reply)
        this.chatHistory.push({ role: 'assistant', content: result.reply })
        await this.handleIntent(result)
      } catch (e) {
        console.error('[DEBUG] LLM error:', e)
        this.pushSystem('回复生成失败')
      }
    } else {
      this.pushSystem('（LLM 未配置，无法对话）')
    }
    this.emitState()
  }

  private async handleIntent(result: ChatLLMResponse): Promise<void> {
    if (!result.intent) {
      console.log('[DEBUG] No intent detected')
      return
    }
    const intent = result.intent
    console.log('[DEBUG] Handling intent:', JSON.stringify(intent))
    switch (intent.type) {
      case 'switch_mode':
        if (intent.mode === 'companion') {
          const r = enterCompanion(this.modeMachine)
          if (r.ok) { this.modeMachine = r.state; await this.persistRuntimeState() }
        } else if (intent.mode === 'study' || intent.mode === 'work') {
          if (intent.topic) {
            const r = startGoal(this.modeMachine, intent.mode, intent.topic, intent.plannedMinutes)
            if (r.ok) {
              this.modeMachine = r.state
              await saveGoal(r.state.activeGoal!)
              await this.log({
                ts: Date.now(), type: 'goal_started', mode: this.modeMachine.mode,
                goalId: r.state.activeGoal!.id, data: { goal: r.state.activeGoal },
              })
              await this.persistRuntimeState()
            }
          }
        } else if (intent.mode === 'rest') {
          const r = startRest(this.modeMachine, intent.plannedMinutes ?? 15)
          if (r.ok) { this.modeMachine = r.state; await this.persistRuntimeState() }
        }
        break
      case 'sokai_yila':
        this.reminderState = handleSokai(this.reminderState, intent.minutes)
        await this.log({
          ts: Date.now(), type: 'sokai_yila', mode: this.modeMachine.mode,
          goalId: this.modeMachine.activeGoal?.id,
          note: `赖账 ${intent.minutes} 分钟`, data: { minutes: intent.minutes },
        })
        break
      case 'end_goal':
        if (this.modeMachine.activeGoal) {
          const r = endGoal(this.modeMachine)
          if (r.ok) {
            this.modeMachine = r.state
            const endedGoal = (r.event as unknown as { goal: Goal }).goal
            await saveGoal(endedGoal)
            await this.persistRuntimeState()
          }
        }
        break
      case 'summary': {
        const date = new Date().toISOString().slice(0, 10)
        const summary = await generateDailySummary(this.llm, date)
        this.pushSystem(summary.comment)
        break
      }
    }
  }

  async switchMode(m: 'companion' | 'study' | 'work' | 'rest'): Promise<void> {
    // 如果有活跃目标且切换到别的模式，先自动结束当前目标
    if (this.modeMachine.activeGoal && this.modeMachine.mode !== m) {
      const r = endGoal(this.modeMachine)
      if (r.ok) {
        this.modeMachine = r.state
        const endedGoal = (r.event as unknown as { goal: Goal }).goal
        await saveGoal(endedGoal)
      }
    }

    if (m === 'companion') {
      const r = enterCompanion(this.modeMachine)
      if (r.ok) this.modeMachine = r.state
    } else if (m === 'rest') {
      const r = startRest(this.modeMachine, 15)
      if (r.ok) this.modeMachine = r.state
    } else {
      const r = startGoal(this.modeMachine, m, '未命名目标')
      if (r.ok) {
        this.modeMachine = r.state
        await saveGoal(r.state.activeGoal!)
        await this.log({
          ts: Date.now(), type: 'goal_started', mode: this.modeMachine.mode,
          goalId: r.state.activeGoal!.id, data: { goal: r.state.activeGoal },
        })
      }
    }
    await this.persistRuntimeState()
    this.pushSystem(`切换到 ${m} 模式`)
    this.emitState()
  }

  async endActiveGoal(): Promise<void> {
    const r = endGoal(this.modeMachine)
    if (r.ok) {
      this.modeMachine = r.state
      const endedGoal = (r.event as unknown as { goal: Goal }).goal
      await saveGoal(endedGoal)
      await this.persistRuntimeState()
      this.pushSystem('目标已结束')
      this.emitState()
    }
  }

  updateConfig(persona: PersonaConfig, llmConfig: LLMConfig, companionConfig: CompanionConfig): void {
    this.persona = { ...persona }
    this.llmConfig = { ...llmConfig }
    this.companionConfig = { ...companionConfig }
    this.llm = new LLMClient(this.llmConfig)
    this.detector = new SlackDetector(this.profiles, this.llm)
    this.triggerEngine.stopFallbackTimer()
    this.triggerEngine.startFallbackTimer(this.companionConfig.fallbackIntervalMinutes)
    // 写回 config.json
    const cfg = {
      persona: this.persona,
      llm: {
        judge: { model: this.llmConfig.judgeModel, apiKey: this.llmConfig.judgeApiKey, apiBase: this.llmConfig.judgeApiBase },
        generate: { model: this.llmConfig.generateModel, apiKey: this.llmConfig.generateApiKey, apiBase: this.llmConfig.generateApiBase },
        summary: { model: this.llmConfig.summaryModel, apiKey: this.llmConfig.summaryApiKey, apiBase: this.llmConfig.summaryApiBase },
      },
      companion: this.companionConfig,
    }
    writeConfigFile(JSON.stringify(cfg, null, 2)).catch((e) => console.error('配置写入文件失败', e))
  }

  private pushUser(content: string) {
    this.onMessage?.({ role: 'user', content, ts: Date.now() })
  }
  private pushAssistant(content: string) {
    this.onMessage?.({ role: 'assistant', content, ts: Date.now() })
  }
  private pushSystem(content: string) {
    this.onMessage?.({ role: 'system', content, ts: Date.now() })
  }

  private emitState() {
    this.onStateChange?.({
      mode: this.modeMachine.mode,
      activeGoal: this.modeMachine.activeGoal,
      slackCount: this.slackCount,
    })
  }

  private async log(event: LogEvent): Promise<void> {
    try {
      await appendLog(event)
    } catch (e) {
      console.error('日志写入失败', e)
    }
  }

  private async persistRuntimeState(): Promise<void> {
    try {
      await saveRuntimeState({
        mode: this.modeMachine.mode,
        activeGoalId: this.modeMachine.activeGoal?.id,
        companionCooldownUntil: this.cooldownUntil,
        lastSpokeAt: this.lastSpokeAt,
      })
    } catch (e) {
      console.error('状态持久化失败', e)
    }
  }

  destroy() {
    this.poller.stop()
    this.triggerEngine.stopFallbackTimer()
    this.scheduler.stop()
  }

  // ===== 调试方法 =====
  async debugGetSnapshot(): Promise<{
    mode: Mode
    activeGoal: Goal | null
    foregroundWindow: ForegroundWindow | null
    idleMs: number
    isIdle: boolean
    slackCount: number
    lastSpokeAt: number
    cooldownUntil: number
    profiles: { whitelisted: string[]; blacklisted: string[] }
  }> {
    const win = this.poller.getLastWindow()
    const idleMs = await getIdleMs()
    return {
      mode: this.modeMachine.mode,
      activeGoal: this.modeMachine.activeGoal,
      foregroundWindow: win,
      idleMs,
      isIdle: this.idleState.isIdle,
      slackCount: this.slackCount,
      lastSpokeAt: this.lastSpokeAt,
      cooldownUntil: this.cooldownUntil,
      profiles: this.profiles.debugSnapshot(),
    }
  }

  async debugDetectSlack(): Promise<{
    foregroundWindow: ForegroundWindow | null
    detection: { outcome: string; needsReminder: boolean; reason?: string } | null
    goal: Goal | null
    error?: string
  }> {
    // 先强制轮询获取当前窗口
    const win = await this.poller.forcePoll()
    const goal = this.modeMachine.activeGoal
    if (!win) return { foregroundWindow: null, detection: null, goal, error: '未获取到前台窗口' }
    if (!goal) return { foregroundWindow: win, detection: null, goal: null, error: '当前无活跃目标，无法检测摸鱼' }
    try {
      const detection = await this.detector.detect(win, goal)
      return {
        foregroundWindow: win,
        detection: {
          outcome: detection.outcome,
          needsReminder: detection.needsReminder,
          reason: detection.reason,
        },
        goal,
      }
    } catch (e) {
      return { foregroundWindow: win, detection: null, goal, error: String(e) }
    }
  }

  async debugForcePoll(): Promise<ForegroundWindow | null> {
    return this.poller.forcePoll()
  }

  async listHistory(startDate: string, endDate: string): Promise<Array<{ date: string; data: DailySummary }>> {
    const rows = await listDailySummaries(startDate, endDate)
    return rows.map((r) => ({ date: r.date, data: JSON.parse(r.data) as DailySummary }))
  }
}
