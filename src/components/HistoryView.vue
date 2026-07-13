<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
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
      <button class="close-btn" @click="emit('close')"><Icon icon="tabler:x" width="16" /></button>
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

        <h5>摸鱼详情</h5>
        <div v-if="selected.slackDetails && selected.slackDetails.length > 0" class="slack-details">
          <div v-for="(d, i) in selected.slackDetails" :key="i" class="slack-item">
            <span class="slack-time">{{ d.time }}</span>
            <span class="slack-app">{{ d.processName }}</span>
            <span class="slack-title">{{ d.windowTitle.slice(0, 30) }}</span>
            <span class="slack-reason">{{ d.reason }}</span>
          </div>
        </div>
        <div v-else class="empty-sub">无摸鱼记录</div>

        <h5>应用时长</h5>
        <ul>
          <li v-for="(min, app) in selected.appTimeDistribution" :key="app">
            {{ app }}: {{ min }}m
          </li>
        </ul>
        <h5>目标</h5>
        <ul>
          <li v-for="g in selected.goals" :key="g.topic">
            {{ g.topic }} ({{ g.mode }}) - <Icon :icon="g.completed ? 'tabler:check' : 'tabler:x'" width="14" :class="g.completed ? 'check-icon' : 'x-icon'" /> {{ g.minutes }}m
          </li>
        </ul>
        <p class="comment">{{ selected.comment }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-view { padding: var(--spacing-lg); background: var(--color-bg-card); border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md); }
.close-btn { background: var(--color-bg-secondary); border: none; width: 28px; height: 28px; border-radius: 50%; font-size: 0.9em; cursor: pointer; color: var(--color-text-muted); transition: all 0.2s; }
.close-btn:hover { background: var(--color-accent-light); color: var(--color-accent); }
.history-layout { display: flex; gap: var(--spacing-lg); }
.date-list { list-style: none; padding: 0; min-width: 120px; cursor: pointer; }
.date-list li { padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-pill); transition: all 0.2s; }
.date-list li:hover { background: var(--color-accent-light); }
.summary-detail { flex: 1; }
.comment { margin-top: var(--spacing-md); padding: var(--spacing-md); background: var(--color-bg-secondary); border-radius: var(--radius-md); font-style: italic; color: var(--color-text-secondary); }
.empty { color: var(--color-text-muted); padding: var(--spacing-lg); text-align: center; }
.empty-sub { color: var(--color-text-muted); font-size: var(--font-sm); padding: var(--spacing-xs) 0; }
.check-icon { color: var(--color-rest); }
.x-icon { color: var(--color-danger); }
.slack-details { max-height: 200px; overflow-y: auto; }
.slack-item { display: flex; gap: var(--spacing-xs); padding: var(--spacing-xs) 0; border-bottom: 1px solid var(--color-border-light); font-size: var(--font-sm); align-items: baseline; }
.slack-time { color: var(--color-text-muted); flex-shrink: 0; width: 40px; }
.slack-app { font-weight: bold; color: var(--color-text); flex-shrink: 0; width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slack-title { color: var(--color-text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slack-reason { color: var(--color-accent); flex-shrink: 0; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
