<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { Mode, Goal } from '../types'
import { useNow } from '../composables/useNow'
import { useModeIcons } from '../composables/useModeIcons'

const props = defineProps<{
  mode: Mode
  activeGoal: Goal | null
}>()

const now = useNow()
const modeInfo = useModeIcons()

const elapsedMinutes = () => {
  if (!props.activeGoal?.startedAt) return 0
  return Math.floor((now.value - props.activeGoal.startedAt) / 60000)
}

const info = modeInfo[props.mode]
</script>

<template>
  <div class="status-bar">
    <div class="status-info">
      <Icon :icon="info.icon" width="16" :style="{ color: `var(${info.colorVar})` }" />
      <span class="mode-label">{{ info.label }}</span>
      <span v-if="activeGoal" class="goal-label">
        · {{ activeGoal.topic }} {{ elapsedMinutes() }}m<template v-if="activeGoal.plannedMinutes">/{{ activeGoal.plannedMinutes }}m</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) 0;
}

.status-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-sm);
}

.mode-label {
  font-weight: bold;
  color: var(--color-text);
}

.goal-label {
  color: var(--color-text-secondary);
}
</style>
