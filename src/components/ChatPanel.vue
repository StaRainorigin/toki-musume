<script setup lang="ts">
defineProps<{
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; ts: number }>
}>()
</script>

<template>
  <div class="chat-panel">
    <div v-for="(msg, i) in messages" :key="i" :class="['message', msg.role]">
      <span v-if="msg.role === 'system'" class="system-text">{{ msg.content }}</span>
      <div v-else :class="['bubble', msg.role]">{{ msg.content }}</div>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  height: 300px;
  overflow-y: auto;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
}
.message { margin-bottom: 8px; }
.message.user { text-align: right; }
.message.assistant { text-align: left; }
.bubble {
  display: inline-block;
  padding: 8px 12px;
  border-radius: 12px;
  max-width: 70%;
  word-break: break-word;
}
.bubble.user { background: #4a90d9; color: white; }
.bubble.assistant { background: #f0f0f0; color: #333; }
.system-text { color: #999; font-size: 0.85em; font-style: italic; }
</style>
