<script setup lang="ts">
import type { Mode, Goal } from '../types'
import { useNow } from '../composables/useNow'

const props = defineProps<{
  mode: Mode
  activeGoal: Goal | null
}>()

const emit = defineEmits<{
  switchMode: [mode: 'companion' | 'study' | 'work' | 'rest']
}>()

const now = useNow()

const elapsedMinutes = () => {
  if (!props.activeGoal) return 0
  return Math.floor((now.value - props.activeGoal.startedAt) / 60000)
}
</script>

<template>
  <div class="status-bar">
    <span class="mode-label">模式: {{ mode }}</span>
    <span v-if="activeGoal" class="goal-label">
      | 目标: {{ activeGoal.topic }}
      ({{ elapsedMinutes() }}m
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
.status-bar { display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-sm); border-top: 1px solid var(--color-border); flex-wrap: wrap; }
.mode-label { font-weight: bold; }
.goal-label { color: var(--color-text-secondary); }
.mode-buttons { margin-left: auto; display: flex; gap: var(--spacing-xs); }
button { padding: var(--spacing-xs) var(--spacing-md); border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; background: var(--color-bg); }
button.active { background: var(--color-accent); color: white; }
</style>
