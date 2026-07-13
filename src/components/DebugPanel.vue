<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useController } from '../composables/useController'

const emit = defineEmits<{ close: [] }>()

const { controller } = useController()

const snapshot = ref<Awaited<ReturnType<typeof controller.debugGetSnapshot>> | null>(null)
const detectResult = ref<Awaited<ReturnType<typeof controller.debugDetectSlack>> | null>(null)
const loading = ref(false)
const detectLoading = ref(false)
const delayedCountdown = ref(0)
let timerId: number | null = null
let countdownId: number | null = null

async function refresh() {
  loading.value = true
  try {
    snapshot.value = await controller.debugGetSnapshot()
  } catch (e) {
    console.error('debug snapshot failed', e)
  }
  loading.value = false
}

async function forcePoll() {
  loading.value = true
  try {
    await controller.debugForcePoll()
    snapshot.value = await controller.debugGetSnapshot()
  } catch (e) {
    console.error('force poll failed', e)
  }
  loading.value = false
}

async function detectSlack() {
  detectLoading.value = true
  try {
    detectResult.value = await controller.debugDetectSlack()
  } catch (e) {
    console.error('detect failed', e)
  }
  detectLoading.value = false
}

// 延迟检测：倒计时3秒后检测，让你有时间切到别的窗口
async function delayedDetect() {
  delayedCountdown.value = 3
  countdownId = window.setInterval(() => {
    delayedCountdown.value--
    if (delayedCountdown.value <= 0) {
      if (countdownId !== null) { clearInterval(countdownId); countdownId = null }
      detectSlack()
    }
  }, 1000)
}

function fmtIdle(ms: number): string {
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function fmtTs(ts: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString()
}

onMounted(() => {
  refresh()
  timerId = window.setInterval(refresh, 3000)
})

onUnmounted(() => {
  if (timerId !== null) clearInterval(timerId)
  if (countdownId !== null) clearInterval(countdownId)
})
</script>

<template>
  <div class="debug-panel">
    <div class="panel-header">
      <h3><Icon icon="tabler:bug" width="18" /> 调试面板</h3>
      <button class="close-btn" @click="emit('close')"><Icon icon="tabler:x" width="16" /></button>
    </div>

    <section>
      <h4>当前状态</h4>
      <div class="section-actions">
        <button @click="refresh" :disabled="loading" class="mini-btn">刷新</button>
        <button @click="forcePoll" :disabled="loading" class="mini-btn">强制轮询</button>
      </div>
      <div v-if="snapshot" class="info-grid">
        <div><span class="label">模式:</span> {{ snapshot.mode }}</div>
        <div><span class="label">目标:</span> {{ snapshot.activeGoal ? `${snapshot.activeGoal.topic} (${snapshot.activeGoal.mode})` : '无' }}</div>
        <div><span class="label">前台进程:</span> {{ snapshot.foregroundWindow?.processName ?? '未检测' }}</div>
        <div><span class="label">窗口标题:</span> {{ snapshot.foregroundWindow?.windowTitle ?? '-' }}</div>
        <div><span class="label">空闲时间:</span> {{ fmtIdle(snapshot.idleMs) }}</div>
        <div><span class="label">是否空闲:</span> {{ snapshot.isIdle ? '是' : '否' }}</div>
        <div><span class="label">摸鱼次数:</span> {{ snapshot.slackCount }}</div>
        <div><span class="label">上次说话:</span> {{ fmtTs(snapshot.lastSpokeAt) }}</div>
        <div><span class="label">冷却到:</span> {{ snapshot.cooldownUntil ? fmtTs(snapshot.cooldownUntil) : '-' }}</div>
      </div>
      <div v-else class="loading">加载中...</div>

      <div v-if="snapshot" class="profiles">
        <div class="profile-list">
          <span class="label">白名单 ({{ snapshot.profiles.whitelisted.length }}):</span>
          <span class="profile-items">{{ snapshot.profiles.whitelisted.join(', ') || '空' }}</span>
        </div>
        <div class="profile-list">
          <span class="label">黑名单 ({{ snapshot.profiles.blacklisted.length }}):</span>
          <span class="profile-items">{{ snapshot.profiles.blacklisted.join(', ') || '空' }}</span>
        </div>
      </div>
    </section>

    <section>
      <h4>摸鱼检测</h4>
      <div class="section-actions">
        <button @click="detectSlack" :disabled="detectLoading || delayedCountdown > 0" class="mini-btn">
          <Icon icon="tabler:hand-tap" width="14" /> 立即检测
        </button>
        <button @click="delayedDetect" :disabled="detectLoading || delayedCountdown > 0" class="mini-btn">
          <Icon icon="tabler:timer" width="14" /> 延迟3秒检测
        </button>
        <span v-if="delayedCountdown > 0" class="countdown">{{ delayedCountdown }}秒后检测，快切窗口！</span>
      </div>
      <div v-if="detectLoading" class="loading">检测中...</div>
      <div v-else-if="detectResult" class="detect-result">
        <div v-if="detectResult.error" class="error">{{ detectResult.error }}</div>
        <template v-else>
          <div><span class="label">检测窗口:</span> {{ detectResult.foregroundWindow?.processName }} - {{ detectResult.foregroundWindow?.windowTitle }}</div>
          <div v-if="detectResult.detection">
            <div><span class="label">结果:</span>
              <span :class="detectResult.detection.outcome === 'slacking' ? 'text-red' : 'text-green'">
                {{ detectResult.detection.outcome }}
              </span>
            </div>
            <div><span class="label">需要提醒:</span> {{ detectResult.detection.needsReminder ? '是' : '否' }}</div>
            <div v-if="detectResult.detection.reason"><span class="label">理由:</span> {{ detectResult.detection.reason }}</div>
          </div>
          <div v-if="detectResult.goal"><span class="label">目标:</span> {{ detectResult.goal.topic }} ({{ detectResult.goal.mode }})</div>
        </template>
      </div>
      <div v-else class="hint">点击"手动检测"测试当前窗口是否被判定为摸鱼</div>
    </section>
  </div>
</template>

<style scoped>
.debug-panel {
  position: fixed;
  top: 50px;
  right: var(--spacing-lg);
  width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  background: rgba(255, 249, 245, 0.92);
  backdrop-filter: blur(12px);
  color: var(--color-text);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  z-index: 1000;
  font-size: var(--font-sm);
  box-shadow: var(--shadow-lg);
}
.panel-header { display: flex; justify-content: space-between; align-items: center; }
.panel-header h3 { margin: 0; font-size: var(--font-md); }
.close-btn { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 1.2em; }
section { margin-bottom: var(--spacing-md); padding-bottom: var(--spacing-sm); border-bottom: 1px solid var(--color-border); }
h4 { margin-bottom: var(--spacing-xs); display: flex; align-items: center; gap: var(--spacing-sm); }
.section-actions { margin-bottom: var(--spacing-xs); display: flex; gap: var(--spacing-xs); align-items: center; }
.countdown { color: var(--color-accent); font-weight: bold; font-size: var(--font-sm); animation: pulse 1s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.info-grid { display: grid; grid-template-columns: 1fr; gap: 2px; }
.info-grid div { padding: 2px 0; }
.label { color: var(--color-text-secondary); }
.text-red { color: var(--color-danger); font-weight: bold; }
.text-green { color: #4f4; font-weight: bold; }
.mini-btn { display: inline-flex; align-items: center; gap: 4px; font-size: var(--font-sm); padding: 2px var(--spacing-sm); background: var(--color-bg-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; }
.mini-btn:disabled { opacity: 0.5; }
.profiles { margin-top: var(--spacing-xs); }
.profile-list { margin-bottom: var(--spacing-xs); }
.profile-items { color: var(--color-text-muted); }
.loading, .hint { color: var(--color-text-muted); font-style: italic; }
.error { color: var(--color-danger); }
.detect-result div { padding: 2px 0; }
</style>
