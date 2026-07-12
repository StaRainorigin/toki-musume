<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { Mode, Goal } from '../types'
import { useNow } from '../composables/useNow'
import { useModeIcons } from '../composables/useModeIcons'

const props = defineProps<{
  mode: Mode
  activeGoal: Goal | null
}>()

const emit = defineEmits<{
  switchMode: [mode: 'companion' | 'study' | 'work' | 'rest']
}>()

const now = useNow()
const modeInfo = useModeIcons()

const elapsedMinutes = () => {
  if (!props.activeGoal) return 0
  return Math.floor((now.value - props.activeGoal.startedAt) / 60000)
}

const modes = [
  { key: 'companion' as const },
  { key: 'study' as const },
  { key: 'work' as const },
  { key: 'rest' as const },
]
</script>

<template>
  <div class="status-bar">
    <div class="status-info">
      <Icon icon="tabler:sparkles" width="14" class="sparkle-icon" />
      <span class="mode-label">{{ modeInfo[mode].label }}</span>
      <span v-if="activeGoal" class="goal-label">
        · {{ activeGoal.topic }} {{ elapsedMinutes() }}m<template v-if="activeGoal.plannedMinutes">/{{ activeGoal.plannedMinutes }}m</template>
      </span>
    </div>
    <div class="mode-buttons">
      <button
        v-for="m in modes"
        :key="m.key"
        @click="emit('switchMode', m.key)"
        :class="['mode-btn', `mode-btn--${m.key}`, { active: mode === m.key }]"
      >
        <Icon :icon="modeInfo[m.key].icon" width="18" class="mode-icon" />
        <span class="mode-text">{{ modeInfo[m.key].label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
  flex-wrap: wrap;
}

.status-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-sm);
}

.sparkle-icon { color: var(--color-accent); }

.mode-label {
  font-weight: bold;
  color: var(--color-text);
}

.goal-label {
  color: var(--color-text-secondary);
}

.mode-buttons {
  display: flex;
  gap: var(--spacing-xs);
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  background: var(--color-bg-card);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  transition: all 0.25s ease;
}

.mode-icon { flex-shrink: 0; }

.mode-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.mode-btn--companion.active { background: var(--color-companion); border-color: var(--color-companion); color: white; }
.mode-btn--study.active { background: var(--color-study); border-color: var(--color-study); color: white; }
.mode-btn--work.active { background: var(--color-work); border-color: var(--color-work); color: white; }
.mode-btn--rest.active { background: var(--color-rest); border-color: var(--color-rest); color: white; }
</style>
