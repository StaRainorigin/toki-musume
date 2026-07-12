<script setup lang="ts">
import { watch, nextTick, ref } from 'vue'
import type { UIMessage } from '../controller'

const props = defineProps<{
  messages: UIMessage[]
}>()

const panelRef = ref<HTMLElement | null>(null)

// 新消息时自动滚动到底部
watch(
  () => props.messages.length,
  () => {
    nextTick(() => {
      if (panelRef.value) {
        panelRef.value.scrollTop = panelRef.value.scrollHeight
      }
    })
  },
)
</script>

<template>
  <div ref="panelRef" class="chat-panel">
    <div v-for="(msg, i) in messages" :key="i" :class="['message', msg.role]">
      <span v-if="msg.role === 'system'" class="system-text">{{ msg.content }}</span>
      <div v-else :class="['bubble', msg.role]">{{ msg.content }}</div>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  height: var(--chat-height);
  overflow-y: auto;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.message { margin-bottom: var(--spacing-sm); }
.message.user { text-align: right; }
.message.assistant { text-align: left; }
.bubble {
  display: inline-block;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-lg);
  max-width: 70%;
  word-break: break-word;
}
.bubble.user { background: var(--color-accent); color: white; }
.bubble.assistant { background: var(--color-bg-hover); color: var(--color-text); }
.system-text { color: var(--color-text-muted); font-size: var(--font-sm); font-style: italic; }
</style>
