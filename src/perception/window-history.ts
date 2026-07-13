import type { ForegroundWindow } from '../types'

/**
 * 窗口历史记录条目
 */
export type WindowRecord = {
  processName: string
  windowTitle: string
  timestamp: number      // 切换到这个窗口的时间
  durationMs: number     // 在这个窗口停留了多久（下一个切换时计算）
}

/**
 * 窗口历史记录器
 * 只记录窗口切换事实，不做摸鱼判断
 */
export class WindowHistoryTracker {
  private records: WindowRecord[] = []
  private currentRecord: WindowRecord | null = null
  private maxRecords = 200  // 防止无限增长

  /** 记录窗口切换，自动计算上一个窗口的停留时长 */
  recordWindow(win: ForegroundWindow): void {
    const now = Date.now()

    // 关闭上一个记录的 duration
    if (this.currentRecord) {
      this.currentRecord.durationMs = now - this.currentRecord.timestamp
    }

    // 如果和当前窗口完全一样，不记录（去重）
    if (this.currentRecord &&
        this.currentRecord.processName === win.processName &&
        this.currentRecord.windowTitle === win.windowTitle) {
      // 同窗口标题没变，只更新时间戳
      this.currentRecord.timestamp = now
      return
    }

    // 新窗口记录
    this.currentRecord = {
      processName: win.processName,
      windowTitle: win.windowTitle,
      timestamp: now,
      durationMs: 0,
    }
    this.records.push(this.currentRecord)

    // 限制记录数量
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords)
    }
  }

  /** 获取最近 N 分钟的窗口记录 */
  getRecentRecords(minutes: number): WindowRecord[] {
    const cutoff = Date.now() - minutes * 60 * 1000
    return this.records.filter((r) => r.timestamp >= cutoff)
  }

  /** 获取自上次检查以来的新记录（用于增量 LLM 检查） */
  getRecordsSince(timestamp: number): WindowRecord[] {
    return this.records.filter((r) => r.timestamp >= timestamp)
  }

  /** 获取当前窗口记录 */
  getCurrentRecord(): WindowRecord | null {
    return this.currentRecord
  }

  /** 获取所有记录（调试用） */
  getAllRecords(): WindowRecord[] {
    return [...this.records]
  }

  /** 清空历史 */
  clear(): void {
    this.records = []
    this.currentRecord = null
  }
}
