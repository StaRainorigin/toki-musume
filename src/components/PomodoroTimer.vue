<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps<{
  phase: string
  label: string
  remainingSec: number
  progress: number  // 0-1
  cycleCount: number
}>()

const emit = defineEmits<{
  start: []
  pause: []
  skip: []
}>()

const isIdle = computed(() => props.phase === 'idle')

const remainingText = computed(() => {
  const min = Math.floor(props.remainingSec / 60)
  const sec = props.remainingSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
})

// 圆形进度条角度
const progressDeg = computed(() => props.progress * 360)
</script>

<template>
  <div class="pomodoro-timer" :class="`phase-${phase}`">
    <div class="timer-circle">
      <div class="circle-bg"></div>
      <div class="circle-progress" :style="{ background: `conic-gradient(var(--ring-color, var(--color-accent)) ${progressDeg}deg, var(--color-bg-secondary) ${progressDeg}deg)` }"></div>
      <div class="circle-inner">
        <div class="time-text">{{ isIdle ? '--:--' : remainingText }}</div>
        <div class="phase-label">{{ label }}</div>
      </div>
    </div>

    <div class="tomato-count">
      <Icon icon="tabler:school" width="14" />
      <span>已完成 {{ cycleCount }} 个番茄</span>
    </div>

    <div class="timer-actions">
      <button v-if="isIdle" class="timer-btn start" @click="emit('start')">
        <Icon icon="tabler:player-play-filled" width="18" /> 开始专注
      </button>
      <template v-else>
        <button class="timer-btn pause" @click="emit('pause')">
          <Icon icon="tabler:player-pause-filled" width="18" /> 暂停
        </button>
        <button class="timer-btn skip" @click="emit('skip')">
          <Icon icon="tabler:player-skip-forward-filled" width="18" /> 跳过
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.pomodoro-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
  box-shadow: var(--shadow-sm);
  --ring-color: var(--color-accent);
}

.pomodoro-timer.phase-focus { --ring-color: var(--color-accent); }
.pomodoro-timer.phase-break { --ring-color: var(--color-rest); }
.pomodoro-timer.phase-long_break { --ring-color: var(--color-idle); }

.timer-circle {
  position: relative;
  width: 100px;
  height: 100px;
}

.circle-bg, .circle-progress, .circle-inner {
  position: absolute;
  border-radius: 50%;
}

.circle-bg {
  width: 100%;
  height: 100%;
  background: var(--color-bg-secondary);
}

.circle-progress {
  width: 100%;
  height: 100%;
  transition: background 0.5s;
}

.circle-inner {
  width: 80%;
  height: 80%;
  top: 10%;
  left: 10%;
  background: var(--color-bg-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.time-text {
  font-size: 1.5em;
  font-weight: bold;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.phase-label {
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.tomato-count {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.timer-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.timer-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  border: none;
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all 0.2s;
  color: white;
}

.timer-btn.start { background: var(--color-accent); }
.timer-btn.start:hover { background: var(--color-accent-hover); transform: translateY(-2px); }
.timer-btn.pause { background: var(--color-text-secondary); }
.timer-btn.pause:hover { opacity: 0.8; }
.timer-btn.skip { background: var(--color-bg-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); }
.timer-btn.skip:hover { border-color: var(--color-accent); color: var(--color-accent); }
</style>
