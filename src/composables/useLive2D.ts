import { ref, onUnmounted } from 'vue'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display/cubism4'

// 注册 Live2D 到 PIXI
Live2DModel.registerTicker(PIXI.Ticker)

export type Live2DExpression = 'rest' | 'focus' | 'angry' | 'surprised' | 'celebrate'

export function useLive2D() {
  const app = ref<PIXI.Application | null>(null)
  const model = ref<Live2DModel | null>(null)
  const loaded = ref(false)
  const currentExpression = ref<string>('')

  async function init(canvasEl: HTMLCanvasElement, modelPath: string): Promise<void> {

    // 创建 PIXI 应用
    const pixiApp = new PIXI.Application({
      view: canvasEl,
      autoStart: true,
      backgroundAlpha: 0,
      width: canvasEl.clientWidth || 200,
      height: canvasEl.clientHeight || 250,
      antialias: true,
    })
    app.value = pixiApp

    try {
      // 加载 Live2D 模型
      const m = await Live2DModel.from(modelPath)
      pixiApp.stage.addChild(m)

      // 调整大小
      const scale = Math.min(
        pixiApp.renderer.width / m.width,
        pixiApp.renderer.height / m.height,
      ) * 0.9
      m.scale.set(scale)
      m.anchor.set(0.5, 0.5)
      m.x = pixiApp.renderer.width / 2
      m.y = pixiApp.renderer.height / 2

      model.value = m
      loaded.value = true

      // 鼠标跟踪
      pixiApp.stage.interactive = true
      pixiApp.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
        if (m) {
          m.focus(e.globalX, e.globalY)
        }
      })

      // 播放待机动作
      playMotion('Idle')
    } catch (e) {
      console.error('[Live2D] 模型加载失败', e)
    }
  }

  /** 切换表情 */
  function setExpression(name: string): void {
    if (!model.value || !loaded.value) return
    try {
      const expressions = (model.value as unknown as { expressions: Array<{ name: string }> }).expressions || []
      const expr = expressions.findIndex((e: { name: string }) => e.name === name)
      if (expr >= 0) {
        model.value!.expression(expr)
        currentExpression.value = name
      }
    } catch (e) {
      console.error('[Live2D] 表情切换失败', e)
    }
  }

  /** 播放动作 */
  function playMotion(group: string, index = 0): void {
    if (!model.value || !loaded.value) return
    try {
      model.value!.motion(group, index)
    } catch (e) {
      // 动作不存在时静默忽略
    }
  }

  /** 根据角色状态设置表情 */
  function updateFromState(mode: string, pomodoroPhase: string, slackCount: number, justCompletedTask: boolean): void {
    if (justCompletedTask) {
      setExpression('f04')  // 庆祝
      playMotion('TapBody')
      return
    }
    if (slackCount > 0 && mode === 'focus') {
      setExpression('f07')  // 生气/不满
      return
    }
    if (pomodoroPhase === 'focus') {
      setExpression('f00')  // 认真
      return
    }
    // 休息
    setExpression('f02')  // 开心/放松
  }

  function destroy(): void {
    if (model.value) {
      model.value.destroy()
      model.value = null
    }
    if (app.value) {
      app.value.destroy(true)
      app.value = null
    }
    loaded.value = false
  }

  onUnmounted(() => {
    destroy()
  })

  return {
    app,
    model,
    loaded,
    currentExpression,
    init,
    setExpression,
    playMotion,
    updateFromState,
    destroy,
  }
}
