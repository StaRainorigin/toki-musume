<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ send: [text: string] }>()
const text = ref('')

function handleSend() {
  const t = text.value.trim()
  if (!t) return
  emit('send', t)
  text.value = ''
}
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="message-input">
    <input
      v-model="text"
      @keydown="handleKeydown"
      placeholder="说点什么…"
    />
    <button @click="handleSend">发送</button>
  </div>
</template>

<style scoped>
.message-input { display: flex; gap: 8px; padding: 8px 0; }
input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
button { padding: 8px 16px; background: #4a90d9; color: white; border: none; border-radius: 4px; cursor: pointer; }
</style>
