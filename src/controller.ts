import type {
  Mode, Goal, LogEvent, ForegroundWindow,
  PersonaConfig, LLMConfig, CompanionConfig, ChatLLMResponse,
  Task, TaskType, GoalMode, PomodoroState, TaskSuggestion,
} from './types'
import { DEFAULT_PERSONA, DEFAULT_LLM_CONFIG, DEFAULT_COMPANION_CONFIG } from './config'
import {
  createInitialState, startGoal, endGoal, startRest, endRest,
  enterCompanion, checkRestTimeout,
  type ModeMachineState,
} from './state/mode-machine'
import { WindowPoller } from './perception/poller'
import { checkIdle, createIdleDetectorState, type IdleDetectorState } from './perception/idle-detector'
import { WindowHistoryTracker } from './perception/window-history'
import { WindowJudgeScheduler } from './perception/window-judge-scheduler'
import type { WindowRecord } from './perception/window-history'
import { AppProfileStore } from './slack/app-profiles'
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
import { TaskStore } from './state/task-store'
import {
  createPomodoroState, startFocus, startBreak, completeFocus,
  stopPomodoro, checkPhaseEnd, getRemainingSec, getProgress, getPhaseLabel,
} from './state/pomodoro'
import { buildDailyPlanPrompt, parseTaskSuggestions } from './llm/daily-plan-prompt'

export type UIMessage = { role: 'user' | 'assistant' | 'system'; content: string; ts: number }

export type ControllerState = {
  mode: Mode
  activeGoal: Goal | null
  slackCount: number
}

export class AppController {
  private modeMachine: ModeMachineState = createInitialState()
  private poller = new WindowPoller()
  private history = new WindowHistoryTracker()
  private judgeScheduler!: WindowJudgeScheduler
  private idleState: IdleDetectorState = createIdleDetectorState()
  private reminderState: ReminderState = createReminderState()
  private profiles!: AppProfileStore
  private triggerEngine!: CompanionTriggerEngine
  private llm!: LLMClient
  private scheduler!: SummaryScheduler
  taskStore = new TaskStore()
  pomodoro: PomodoroState = createPomodoroState()
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
    this.triggerEngine = new CompanionTriggerEngine(this.profiles, (e) => this.handleCompanionEvent(e))
    this.scheduler = new SummaryScheduler(this.llm)
    this.judgeScheduler = new WindowJudgeScheduler(this.history, this.llm, (result, records) => this.handleJudgeResult(result, records))

    // toki-musume 自身进程永远白名单
    await this.profiles.addToList('toki-musume.exe', 'whitelist')
    await this.profiles.addToList('toki-musume', 'whitelist')

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

    // 1. 记录窗口历史（只记录，不判断）
    this.history.recordWindow(win)

    await this.log({
      ts: Date.now(), type: 'window_switch', mode,
      goalId: goal?.id, processName: win.processName, windowTitle: win.windowTitle,
    })

    // 2. 空闲检测
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

    // 3. 休息超时检查
    const restTimeout = checkRestTimeout(this.modeMachine, Date.now())
    if (restTimeout && restTimeout.ok) {
      this.modeMachine = restTimeout.state
      this.pushAssistant('休息时间到啦，继续吧～')
      await this.persistRuntimeState()
    }

    // 3.5 番茄钟阶段检查
    if (this.pomodoro.phase !== 'idle') {
      await this.checkPomodoroPhase()
    }

    // 4. 陪伴监督：只在番茄钟专注阶段检测摸鱼
    if ((mode === 'study' || mode === 'work') && goal && this.pomodoro.phase === 'focus') {
      const listKind = this.profiles.lookup(win.processName, goal.topic)
      if (listKind === 'whitelist') {
        // 回到正事了，重置摸鱼状态
        if (this.reminderState.slackStartedAt !== null) {
          this.reminderState = resetSlack(this.reminderState)
        }
      } else if (listKind === 'blacklist') {
        this.handleSlackingDetected(win, goal, '黑名单匹配')
      } else {
        // 未知应用：交给 LLM 判断调度器（30秒首次检查）
        this.judgeScheduler.onWindowSwitch(goal)
      }
    }

    this.triggerEngine.handleWindowSwitch(win, mode)
    this.emitState()
  }

  /** LLM 判断结果回调 */
  private async handleJudgeResult(
    result: { isSlacking: boolean; slackRatio: number; reason: string },
    records: WindowRecord[],
  ): Promise<void> {
    const goal = this.modeMachine.activeGoal
    if (!goal) return

    if (result.isSlacking && result.slackRatio > 0.3) {
      // 摸鱼占比超过 30% 才触发
      const lastRecord = records[records.length - 1]
      const win: ForegroundWindow = lastRecord
        ? { processName: lastRecord.processName, windowTitle: lastRecord.windowTitle, pid: 0 }
        : { processName: 'unknown', windowTitle: 'unknown', pid: 0 }
      this.handleSlackingDetected(win, goal, result.reason)
    } else {
      // 没在摸鱼，重置提醒状态
      if (this.reminderState.slackStartedAt !== null) {
        this.reminderState = resetSlack(this.reminderState)
      }
    }
  }

  /** 摸鱼检测到后的处理：记录 + 分级提醒 */
  private async handleSlackingDetected(win: ForegroundWindow, goal: Goal, reason: string): Promise<void> {
    this.reminderState = markSlackStart(this.reminderState)
    this.slackCount++
    await this.log({
      ts: Date.now(), type: 'slack_detected', mode: this.modeMachine.mode, goalId: goal.id,
      processName: win.processName, note: `摸鱼：${win.windowTitle}（${reason}）`,
    })

    // 角色语气提醒，基于当前任务上下文
    const task = this.taskStore.getActiveTask()
    const nextLevel = checkReminderLevel(this.reminderState)
    if (nextLevel) {
      this.reminderState = updateLevel(this.reminderState, nextLevel)
      const { message, notified } = await executeReminder(this.llm, nextLevel, goal)
      // 如果 LLM 生成了提醒，用它；否则用角色语气的默认提醒
      if (message) {
        this.pushAssistant(message)
      } else {
        const taskName = task?.title ?? goal.topic
        if (nextLevel === 1) {
          this.pushAssistant(`诶？你不是应该在${goal.mode === 'study' ? '学习' : '工作'}「${taskName}」吗？`)
        } else if (nextLevel === 2) {
          this.pushAssistant(`喂，你已经摸鱼一会儿了，回来继续「${taskName}」吧。`)
        } else {
          this.pushAssistant(`你摸鱼太久了！说好的${goal.mode === 'study' ? '学习' : '工作'}呢？认真点好不好？`)
        }
      }
      await this.log({
        ts: Date.now(), type: 'reminder', mode: this.modeMachine.mode, goalId: goal.id,
        note: `第${nextLevel}级提醒${notified ? '（系统通知）' : ''}`,
        data: { level: nextLevel, message },
      })
    }
    this.emitState()
  }

  // ===== 番茄钟 =====

  /** 检查番茄钟阶段是否结束，自动切换 */
  /** 检查番茄钟阶段是否结束，自动切换（公开，供定时器调用） */
  async checkPomodoroPhasePublic(): Promise<void> {
    return this.checkPomodoroPhase()
  }

  private async checkPomodoroPhase(): Promise<void> {
    if (this.pomodoro.phase === 'idle') return
    const now = Date.now()
    if (!checkPhaseEnd(this.pomodoro, now)) return

    if (this.pomodoro.phase === 'focus') {
      // 专注结束 → 累加时间到任务 → 进入休息
      const focusMin = this.pomodoro.phaseDurationMin
      const task = this.taskStore.getActiveTask()
      const completedTask = this.taskStore.addFocusMinutesToActive(focusMin)
      this.pomodoro = completeFocus(this.pomodoro)

      // 角色语气推送
      if (completedTask?.status === 'completed') {
        this.pushAssistant(`太棒了！你刚完成了 ${focusMin} 分钟的专注，「${completedTask.title}」已经完成啦！🎉 辛苦了，休息一下吧～`)
        await this.log({
          ts: now, type: 'task_completed', mode: this.modeMachine.mode,
          note: `任务完成：${completedTask.title}`,
          data: { taskId: completedTask.id, completedMinutes: completedTask.completedMinutes },
        })
      } else {
        const totalMin = task?.completedMinutes ?? focusMin
        const planned = task?.plannedMinutes ?? 0
        const progress = planned > 0 ? Math.round((totalMin / planned) * 100) : 0
        this.pushAssistant(`好厉害！专注了 ${focusMin} 分钟呢～${planned > 0 ? `「${task?.title}」已经完成 ${progress}% 了，` : ''}休息一下，喝口水吧！`)
      }

      this.pomodoro = startBreak(this.pomodoro)
      await this.log({
        ts: now, type: 'pomodoro_focus_end', mode: this.modeMachine.mode,
        data: { focusMin, cycleCount: this.pomodoro.cycleCount },
      })
    } else {
      // 休息结束 → 回到专注
      this.pushAssistant('休息好了吗？继续吧，加油～')
      this.pomodoro = startFocus(this.pomodoro)
      await this.log({
        ts: now, type: 'pomodoro_break_end', mode: this.modeMachine.mode,
        data: { nextPhase: 'focus' },
      })
    }
    this.emitState()
  }

  /** 开始番茄钟（用户手动触发或进入任务时自动触发） */
  startPomodoro(): void {
    const task = this.taskStore.getActiveTask()
    if (!task) {
      this.pushAssistant('先选一个任务吧，我帮你计时～')
      return
    }
    this.pomodoro = startFocus(this.pomodoro)
    this.pushAssistant(`好的！开始专注「${task.title}」，${this.pomodoro.focusMin} 分钟，加油哦～我会帮你看着的！`)
    this.emitState()
  }

  /** 停止番茄钟 */
  pausePomodoro(): void {
    this.pomodoro = stopPomodoro(this.pomodoro)
    this.pushAssistant('好的，先停一下。准备好了随时继续～')
    this.emitState()
  }

  /** 跳过当前阶段 */
  skipPhase(): void {
    if (this.pomodoro.phase === 'focus') {
      const elapsedMin = Math.max(1, Math.ceil((Date.now() - this.pomodoro.phaseStartedAt) / 60000))
      this.taskStore.addFocusMinutesToActive(elapsedMin)
      this.pomodoro = completeFocus(this.pomodoro)
      this.pomodoro = startBreak(this.pomodoro)
      this.pushAssistant(`这轮专注了 ${elapsedMin} 分钟，去休息一下吧～`)
    } else if (this.pomodoro.phase !== 'idle') {
      this.pomodoro = startFocus(this.pomodoro)
      this.pushAssistant('休息够了吗？那继续吧～')
    }
    this.emitState()
  }

  /** 获取番茄钟显示信息 */
  getPomodoroDisplay(): { phase: string; label: string; remainingSec: number; progress: number; cycleCount: number } {
    return {
      phase: this.pomodoro.phase,
      label: getPhaseLabel(this.pomodoro.phase),
      remainingSec: getRemainingSec(this.pomodoro),
      progress: getProgress(this.pomodoro),
      cycleCount: this.pomodoro.cycleCount,
    }
  }

  // ===== 任务管理 =====

  addTask(title: string, type: TaskType, mode: GoalMode, plannedMinutes?: number, description?: string): void {
    this.taskStore.addTask(title, type, mode, plannedMinutes, description)
    this.pushAssistant(`收到！已添加任务「${title}」`)
    this.emitState()
  }

  removeTask(id: string): void {
    this.taskStore.removeTask(id)
    this.emitState()
  }

  completeTask(id: string): void {
    this.taskStore.completeTask(id)
    this.pushAssistant('任务完成！辛苦啦～🎉')
    // 如果当前任务完成了，停止番茄钟
    if (this.pomodoro.phase !== 'idle' && !this.taskStore.getActiveTask()) {
      this.pomodoro = stopPomodoro(this.pomodoro)
    }
    this.emitState()
  }

  setActiveTask(id: string): void {
    const task = this.taskStore.setActiveTask(id)
    if (task) {
      this.pushAssistant(`好的，开始「${task.title}」吧！我会帮你计时的～`)
      // 如果在学习/工作模式且番茄钟空闲，自动开始专注
      if ((this.modeMachine.mode === 'study' || this.modeMachine.mode === 'work') && this.pomodoro.phase === 'idle') {
        this.startPomodoro()
      }
    }
    this.emitState()
  }

  getTasks(): Task[] {
    return this.taskStore.getTodayTasks()
  }

  // ===== AI 今日计划 =====

  async generateDailyPlan(): Promise<TaskSuggestion[]> {
    if (!this.llm.isConfigured('generate')) {
      this.pushAssistant('我还没连上大脑（LLM 未配置），没办法帮你规划呢')
      return []
    }
    this.pushAssistant('让我想想今天给你安排什么好...')
    try {
      const { system, user } = buildDailyPlanPrompt()
      const raw = await this.llm.chat(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        'generate',
      )
      const suggestions = parseTaskSuggestions(raw)
      if (suggestions.length > 0) {
        this.pushAssistant(`我想到了 ${suggestions.length} 个今天的任务，你看看怎么样？`)
      } else {
        this.pushAssistant('嗯...我暂时没想到什么好的建议，你自己加吧～')
      }
      return suggestions
    } catch (e) {
        this.pushAssistant('计划生成失败了...你先手动加几个任务吧')
      console.error('generateDailyPlan failed', e)
      return []
    }
  }

  confirmDailyPlan(suggestions: TaskSuggestion[]): void {
    this.taskStore.addBatch(suggestions)
    this.pushAssistant(`好！${suggestions.length} 个任务都加好了，选一个开始吧～`)
    this.emitState()
  }

  /** 手动生成今日总结 */
  async generateSummaryNow(date: string): Promise<void> {
    try {
      const summary = await generateDailySummary(this.llm, date)
      this.pushSystem(summary.comment || '总结已生成')
    } catch (e) {
      console.error('generateSummaryNow failed', e)
      throw e
    }
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
    // 如果在休息模式，先结束休息
    if (this.modeMachine.mode === 'rest' && m !== 'rest') {
      const restEnd = endRest(this.modeMachine)
      if (restEnd.ok) {
        this.modeMachine = restEnd.state
        this.pushSystem('休息结束')
      }
    }

    // 如果有活跃目标且切换到别的模式，先自动结束当前目标
    if (this.modeMachine.activeGoal && this.modeMachine.mode !== m) {
      const r = endGoal(this.modeMachine)
      if (r.ok) {
        this.modeMachine = r.state
        const endedGoal = (r.event as unknown as { goal: Goal }).goal
        await saveGoal(endedGoal)
      }
    }
    this.judgeScheduler.stopPeriodic()
    // 切到休息/陪伴时停番茄钟
    if (m === 'rest' || m === 'companion') {
      this.pomodoro = stopPomodoro(this.pomodoro)
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
        // 启动 LLM 定期检查
        this.judgeScheduler.startPeriodic(r.state.activeGoal)
        // 如果有活跃任务，自动开始番茄钟
        const activeTask = this.taskStore.getActiveTask()
        if (activeTask && this.pomodoro.phase === 'idle') {
          this.startPomodoro()
        }
      }
    }
    await this.persistRuntimeState()
    this.pushSystem(`切换到 ${m} 模式`)
    this.emitState()
  }

  async endActiveGoal(): Promise<void> {
    this.judgeScheduler.stopPeriodic()
    this.pomodoro = stopPomodoro(this.pomodoro)
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
    this.judgeScheduler.stopPeriodic()
    this.pomodoro = stopPomodoro(this.pomodoro)
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
    windowHistory: Array<{ processName: string; windowTitle: string; durationMs: number }>
    lastJudgeResult: { isSlacking: boolean; slackRatio: number; reason: string } | null
    lastJudgeAt: number
  }> {
    const win = this.poller.getLastWindow()
    let idleMs = 0
    try {
      idleMs = await getIdleMs()
    } catch { /* ignore */ }
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
      windowHistory: this.history.getRecentRecords(10).map((r) => ({
        processName: r.processName,
        windowTitle: r.windowTitle,
        durationMs: r.durationMs,
      })),
      lastJudgeResult: this.judgeScheduler.getLastResult(),
      lastJudgeAt: this.judgeScheduler.getLastCheckAt(),
    }
  }

  async debugDetectSlack(): Promise<{
    foregroundWindow: ForegroundWindow | null
    detection: { outcome: string; needsReminder: boolean; reason?: string; slackRatio?: number } | null
    goal: Goal | null
    error?: string
  }> {
    // 先强制轮询获取当前窗口
    const win = await this.poller.forcePoll()
    const goal = this.modeMachine.activeGoal
    if (!win) return { foregroundWindow: null, detection: null, goal, error: '未获取到前台窗口' }
    if (!goal) return { foregroundWindow: win, detection: null, goal: null, error: '当前无活跃目标，无法检测摸鱼' }

    // 先查快速分类
    const listKind = this.profiles.lookup(win.processName, goal.topic)
    if (listKind === 'whitelist') {
      return { foregroundWindow: win, detection: { outcome: 'working', needsReminder: false, reason: '白名单' }, goal }
    }
    if (listKind === 'blacklist') {
      return { foregroundWindow: win, detection: { outcome: 'slacking', needsReminder: true, reason: '黑名单' }, goal }
    }

    // 手动触发 LLM 判断
    try {
      const result = await this.judgeScheduler.checkNow(goal)
      if (result) {
        return {
          foregroundWindow: win,
          detection: {
            outcome: result.isSlacking ? 'slacking' : 'working',
            needsReminder: result.isSlacking,
            reason: result.reason,
            slackRatio: result.slackRatio,
          },
          goal,
        }
      }
      return { foregroundWindow: win, detection: { outcome: 'unknown', needsReminder: false, reason: 'LLM 未配置或无记录' }, goal }
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
