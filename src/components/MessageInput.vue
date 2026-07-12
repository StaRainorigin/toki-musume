<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'

const emit = defineEmits<{ send: [text: string] }>()
const text = ref('')

const canSend = computed(() => text.value.trim().length > 0)

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
      placeholder="说点什么呀～"
    />
    <button class="send-btn" @click="handleSend" :disabled="!canSend">
      <Icon icon="tabler:send-filled" width="18" />
    </button>
  </div>
</template>

<style scoped>
.message-input {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
  align-items: center;
}

input {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 2px solid var(--color-border-light);
  border-radius: var(--radius-pill);
  background: var(--color-bg-card);
  font-family: var(--font-family);
  font-size: var(--font-md);
  color: var(--color-text);
  transition: all 0.2s;
}

input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 4px var(--color-accent-light);
}

input::placeholder { color: var(--color-text-muted); }

.send-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  color: white;
}

.send-btn:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: scale(1.1) rotate(-10deg);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
