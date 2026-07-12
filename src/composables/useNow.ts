import { ref, onUnmounted } from 'vue'

/** 每秒更新一次的 Date.now() ref，用于驱动模板中的时间显示 */
export function useNow(intervalMs = 1000) {
  const now = ref(Date.now())
  const id = window.setInterval(() => {
    now.value = Date.now()
  }, intervalMs)
  onUnmounted(() => clearInterval(id))
  return now
}
