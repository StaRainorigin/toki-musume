<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useController } from '../composables/useController'
import type { DailySummary } from '../types'

const emit = defineEmits<{ close: [] }>()

const { listHistory } = useController()

const summaries = ref<Array<{ date: string; data: DailySummary }>>([])
const selected = ref<DailySummary | null>(null)

onMounted(async () => {
  const today = new Date()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 30)
  const start = weekAgo.toISOString().slice(0, 10)
  const end = today.toISOString().slice(0, 10)
  try {
    summaries.value = await listHistory(start, end)
    if (summaries.value.length > 0) {
      selected.value = summaries.value[0].data
    }
  } catch (e) {
    console.error('加载历史总结失败', e)
  }
})

function selectSummary(date: string) {
  const found = summaries.value.find((s) => s.date === date)
  if (found) selected.value = found.data
}
</script>

<template>
  <div class="history-view">
    <div class="panel-header">
      <h3>历史总结</h3>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>
    <div v-if="summaries.length === 0" class="empty">暂无历史总结</div>
    <div v-else class="history-layout">
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
    </div>
  </div>
</template>

<style scoped>
.history-view { padding: var(--spacing-lg); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.panel-header { display: flex; justify-content: space-between; align-items: center; }
.close-btn { background: none; border: none; font-size: 1.2em; cursor: pointer; color: var(--color-text-muted); }
.history-layout { display: flex; gap: var(--spacing-lg); }
.date-list { list-style: none; padding: 0; min-width: 120px; cursor: pointer; }
.date-list li { padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-sm); }
.date-list li:hover { background: var(--color-bg-hover); }
.summary-detail { flex: 1; }
.comment { margin-top: var(--spacing-md); padding: var(--spacing-sm); background: var(--color-bg-secondary); border-radius: var(--radius-sm); font-style: italic; }
.empty { color: var(--color-text-muted); padding: var(--spacing-md); }
</style>
