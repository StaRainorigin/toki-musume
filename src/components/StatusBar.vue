<script setup lang="ts">
import type { Mode, Goal } from '../types'

defineProps<{
  mode: Mode
  activeGoal: Goal | null
}>()

const emit = defineEmits<{
  switchMode: [mode: 'companion' | 'study' | 'work' | 'rest']
}>()
</script>

<template>
  <div class="status-bar">
    <span class="mode-label">模式: {{ mode }}</span>
    <span v-if="activeGoal" class="goal-label">
      | 目标: {{ activeGoal.topic }}
      ({{ Math.floor((Date.now() - activeGoal.startedAt) / 60000) }}m
      <template v-if="activeGoal.plannedMinutes">/ {{ activeGoal.plannedMinutes }}m</template>)
    </span>
    <div class="mode-buttons">
      <button @click="emit('switchMode', 'companion')" :class="{ active: mode === 'companion' }">陪伴</button>
      <button @click="emit('switchMode', 'study')" :class="{ active: mode === 'study' }">学习</button>
      <button @click="emit('switchMode', 'work')" :class="{ active: mode === 'work' }">工作</button>
      <button @click="emit('switchMode', 'rest')" :class="{ active: mode === 'rest' }">休息</button>
    </div>
  </div>
</template>

<style scoped>
.status-bar { display: flex; align-items: center; gap: 12px; padding: 8px; border-top: 1px solid #ddd; flex-wrap: wrap; }
.mode-label { font-weight: bold; }
.goal-label { color: #666; }
.mode-buttons { margin-left: auto; display: flex; gap: 4px; }
button { padding: 4px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: white; }
button.active { background: #4a90d9; color: white; }
.end-btn { color: #d94a4a; }
</style>
