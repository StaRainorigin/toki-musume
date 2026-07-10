<script setup lang="ts">
import type { DailySummary } from '../types'

defineProps<{
  summary: DailySummary | null
  slackCount: number
  workMinutes: number
  goalProgress: number | null
}>()

defineEmits<{ viewFull: [] }>()
</script>

<template>
  <div class="today-summary" @click="$emit('viewFull')">
    <span>摸鱼 {{ slackCount }} 次</span>
    <span>| {{ workMinutes }}m</span>
    <span v-if="goalProgress !== null">| 目标进度 {{ Math.round(goalProgress * 100) }}%</span>
  </div>
</template>

<style scoped>
.today-summary { padding: 8px; color: #666; font-size: 0.9em; cursor: pointer; }
.today-summary span { margin-right: 8px; }
</style>
