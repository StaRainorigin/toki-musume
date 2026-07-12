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
.message-input { display: flex; gap: var(--spacing-sm); padding: var(--spacing-sm) 0; }
input { flex: 1; padding: var(--spacing-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
button { padding: var(--spacing-sm) var(--spacing-lg); background: var(--color-accent); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; }
button:hover { background: var(--color-accent-hover); }
</style>
