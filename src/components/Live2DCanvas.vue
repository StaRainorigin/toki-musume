<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useLive2D } from '../composables/useLive2D'

const props = defineProps<{
  mode: string
  pomodoroPhase: string
  slackCount: number
  justCompletedTask: boolean
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hasError = ref(false)
const { init, updateFromState, destroy, loaded } = useLive2D()

onMounted(async () => {
  if (!canvasRef.value) return
  try {
    await init(canvasRef.value, '/live2d/haru/haru_greeter_t03.model3.json')
    updateFromState(props.mode, props.pomodoroPhase, props.slackCount, props.justCompletedTask)
  } catch (e) {
    console.error('[Live2DCanvas] init failed', e)
    hasError.value = true
  }
})

// 监听状态变化，切换表情
watch(
  () => [props.mode, props.pomodoroPhase, props.slackCount, props.justCompletedTask],
  () => {
    if (loaded.value) {
      updateFromState(props.mode, props.pomodoroPhase, props.slackCount, props.justCompletedTask)
    }
  },
)

onUnmounted(() => {
  destroy()
})
</script>

<template>
  <div class="live2d-container">
    <canvas v-if="!hasError" ref="canvasRef" class="live2d-canvas"></canvas>
    <!-- Fallback: Icon -->
    <div v-if="hasError" class="fallback-avatar">
      <Icon
        :icon="props.mode === 'focus' ? 'tabler:focus-2' : 'tabler:coffee'"
        width="40"
      />
    </div>
  </div>
</template>

<style scoped>
.live2d-container {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.live2d-canvas {
  width: 100%;
  height: 100%;
}

.fallback-avatar {
  width: var(--avatar-size);
  height: var(--avatar-size);
  border-radius: 50%;
  background: var(--color-bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
  border: 2px solid var(--color-border-light);
  color: var(--color-accent);
}
</style>
