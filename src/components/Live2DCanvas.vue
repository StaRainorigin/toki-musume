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
  // 设置 canvas 尺寸为接近模型宽高比（Haru 约 1:1.8）
  canvasRef.value.width = 300
  canvasRef.value.height = 540
  try {
    await init(canvasRef.value, '/live2d/haru/haru_greeter_t03.model3.json')
    if (loaded.value) {
      updateFromState(props.mode, props.pomodoroPhase, props.slackCount, props.justCompletedTask)
    } else {
      hasError.value = true
    }
  } catch (e) {
    console.error('[Live2DCanvas] init failed', e)
    hasError.value = true
  }
})

watch(
  () => [props.mode, props.pomodoroPhase, props.slackCount, props.justCompletedTask],
  () => {
    if (loaded.value && !hasError.value) {
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
    <canvas v-show="!hasError && loaded" ref="canvasRef" class="live2d-canvas"></canvas>
    <div v-if="!hasError && !loaded" class="loading-avatar">
      <Icon icon="tabler:loader-2" width="32" class="spin-icon" />
    </div>
    <div v-if="hasError" class="fallback-avatar">
      <Icon :icon="props.mode === 'focus' ? 'tabler:focus-2' : 'tabler:coffee'" width="40" />
    </div>
  </div>
</template>

<style scoped>
.live2d-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 0;
  left: 0;
  background: transparent;
  pointer-events: auto;
}

.live2d-canvas {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.loading-avatar {
  color: var(--color-text-muted);
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.fallback-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff8fa3;
}
</style>
