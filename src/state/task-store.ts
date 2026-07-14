import type { Task, TaskType, GoalMode } from '../types'

/**
 * 今日任务列表管理（内存存储）
 */
export class TaskStore {
  private tasks: Task[] = []
  private activeTaskId: string | null = null

  addTask(
    title: string,
    type: TaskType,
    mode: GoalMode,
    plannedMinutes?: number,
    description?: string,
  ): Task {
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      type,
      mode,
      status: 'pending',
      plannedMinutes: type === 'timed' ? plannedMinutes : undefined,
      completedMinutes: type === 'timed' ? 0 : undefined,
      pomodoroCount: type === 'timed' ? 0 : undefined,
      description: type === 'target' ? description : undefined,
      createdAt: Date.now(),
    }
    this.tasks.push(task)
    return task
  }

  removeTask(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id)
    if (this.activeTaskId === id) this.activeTaskId = null
  }

  completeTask(id: string): Task | null {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) return null
    task.status = 'completed'
    task.completedAt = Date.now()
    if (this.activeTaskId === id) this.activeTaskId = null
    return task
  }

  abandonTask(id: string): Task | null {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) return null
    task.status = 'abandoned'
    if (this.activeTaskId === id) this.activeTaskId = null
    return task
  }

  setActiveTask(id: string): Task | null {
    // 先取消之前的活跃任务
    if (this.activeTaskId) {
      const prev = this.tasks.find((t) => t.id === this.activeTaskId)
      if (prev && prev.status === 'active') prev.status = 'pending'
    }
    const task = this.tasks.find((t) => t.id === id)
    if (!task) return null
    task.status = 'active'
    if (!task.startedAt) task.startedAt = Date.now()
    this.activeTaskId = id
    return task
  }

  getActiveTask(): Task | null {
    if (!this.activeTaskId) return null
    return this.tasks.find((t) => t.id === this.activeTaskId) ?? null
  }

  getTodayTasks(): Task[] {
    return [...this.tasks]
  }

  getPendingTasks(): Task[] {
    return this.tasks.filter((t) => t.status === 'pending' || t.status === 'active')
  }

  getCompletedTasks(): Task[] {
    return this.tasks.filter((t) => t.status === 'completed')
  }

  /** 给活跃任务累加专注分钟数 */
  addFocusMinutesToActive(minutes: number): Task | null {
    const task = this.getActiveTask()
    if (!task || task.type !== 'timed') return null
    task.completedMinutes = (task.completedMinutes ?? 0) + minutes
    task.pomodoroCount = (task.pomodoroCount ?? 0) + 1
    // 检查是否自动完成
    if (task.plannedMinutes && task.completedMinutes >= task.plannedMinutes) {
      return this.completeTask(task.id)
    }
    return task
  }

  /** 批量添加任务（AI 计划确认后） */
  addBatch(tasks: Array<{ title: string; type: TaskType; mode: GoalMode; plannedMinutes?: number; description?: string }>): void {
    for (const t of tasks) {
      this.addTask(t.title, t.type, t.mode, t.plannedMinutes, t.description)
    }
  }

  clear(): void {
    this.tasks = []
    this.activeTaskId = null
  }
}
