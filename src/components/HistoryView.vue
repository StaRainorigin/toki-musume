<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listDailySummaries } from '../tauri-bridge'
import type { DailySummary } from '../types'

const summaries = ref<Array<{ date: string; data: DailySummary }>>([])
const selected = ref<DailySummary | null>(null)

onMounted(async () => {
  try {
    const today = new Date()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 30)
    const start = weekAgo.toISOString().slice(0, 10)
    const end = today.toISOString().slice(0, 10)
    const rows = await listDailySummaries(start, end)
    summaries.value = rows.map((r) => ({ date: r.date, data: JSON.parse(r.data) as DailySummary }))
    if (summaries.value.length > 0) {
      selected.value = summaries.value[0].data
    }
  } catch {
    // Tauri 未就绪时静默
  }
})

function selectSummary(date: string) {
  const found = summaries.value.find((s) => s.date === date)
  if (found) selected.value = found.data
}
</script>

<template>
  <div class="history-view">
    <h3>历史总结</h3>
    <div class="history-layout">
      <ul class="date-list">
        <li v-for="s in summaries" :key="s.date" @click="selectSummary(s.date)">
          {{ s.date }}
        </li>
      </ul>
      <div v-if="selected" class="summary-detail">
        <h4>{{ selected.date }}</h4>
        <p>摸鱼 {{ selected.slackCount }} 次 | 赖账 {{ selected.sokaiCount }} 次 ({{ selected.sokaiTotalMinutes }}m)</p>
        <h5>应用时长</h5>
        <ul>
          <li v-for="(min, app) in selected.appTimeDistribution" :key="app">
            {{ app }}: {{ min }}m
          </li>
        </ul>
        <h5>目标</h5>
        <ul>
          <li v-for="g in selected.goals" :key="g.topic">
            {{ g.topic }} ({{ g.mode }}) - {{ g.completed ? '✓' : '✗' }} {{ g.minutes }}m
          </li>
        </ul>
        <p class="comment">{{ selected.comment }}</p>
      </div>
      <div v-else class="empty">暂无历史总结</div>
    </div>
  </div>
</template>

<style scoped>
.history-view { padding: 16px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px; }
.history-layout { display: flex; gap: 16px; }
.date-list { list-style: none; padding: 0; min-width: 120px; cursor: pointer; }
.date-list li { padding: 4px 8px; border-radius: 4px; }
.date-list li:hover { background: #f0f0f0; }
.summary-detail { flex: 1; }
.comment { margin-top: 12px; padding: 8px; background: #f9f9f9; border-radius: 4px; font-style: italic; }
.empty { color: #999; }
</style>
