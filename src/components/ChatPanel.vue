<script setup lang="ts">
import { watch, nextTick, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { UIMessage } from '../controller'

const props = defineProps<{
  messages: UIMessage[]
  avatarIcon: string
}>()

const panelRef = ref<HTMLElement | null>(null)

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
      <!-- system 消息：居中小胶囊 -->
      <span v-if="msg.role === 'system'" class="system-pill">{{ msg.content }}</span>

      <!-- assistant 消息：头像 + 粉色气泡 + 左尾 -->
      <template v-else-if="msg.role === 'assistant'">
        <div class="avatar-mini">
          <Icon :icon="props.avatarIcon" width="18" />
        </div>
        <div class="bubble bubble-assistant">
          {{ msg.content }}
        </div>
      </template>

      <!-- user 消息：绿色气泡 + 右尾 -->
      <template v-else>
        <div class="bubble bubble-user">
          {{ msg.content }}
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  height: var(--chat-height);
  overflow-y: auto;
  padding: var(--spacing-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.chat-panel::-webkit-scrollbar { width: 6px; }
.chat-panel::-webkit-scrollbar-track { background: transparent; }
.chat-panel::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: var(--radius-pill); }

.message { margin-bottom: var(--spacing-md); display: flex; align-items: flex-start; gap: var(--spacing-sm); }
.message.user { justify-content: flex-end; }
.message.assistant { justify-content: flex-start; }
.message.system { justify-content: center; }

.system-pill {
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-pill);
}

.avatar-mini {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-accent);
}

.bubble {
  display: inline-block;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-lg);
  max-width: 72%;
  word-break: break-word;
  line-height: 1.5;
  font-size: var(--font-md);
  position: relative;
}

.bubble-assistant {
  background: var(--color-accent-light);
  color: var(--color-text);
  border-bottom-left-radius: var(--radius-sm);
}
.bubble-assistant::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: -6px;
  width: 12px;
  height: 12px;
  background: var(--color-accent-light);
  border-bottom-left-radius: 50%;
}

.bubble-user {
  background: var(--color-rest-light);
  color: var(--color-text);
  border-bottom-right-radius: var(--radius-sm);
}
.bubble-user::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: -6px;
  width: 12px;
  height: 12px;
  background: var(--color-rest-light);
  border-bottom-right-radius: 50%;
}
</style>
