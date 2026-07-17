import { createApp, h } from 'vue'
import Live2DCanvas from './components/Live2DCanvas.vue'
import { useController } from './composables/useController'

// Live2D 窗口的 Vue 应用
const { mode, pomodoroDisplay, slackCount } = useController()

const app = createApp({
  render() {
    return h(Live2DCanvas, {
      mode: mode.value,
      pomodoroPhase: pomodoroDisplay.value.phase,
      slackCount: slackCount.value,
      justCompletedTask: false,
    })
  },
})
app.mount('#live2d-app')
