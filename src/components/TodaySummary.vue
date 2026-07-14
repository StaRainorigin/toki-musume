<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  slackCount: number
}>()

defineEmits<{ 
  viewFull: [] 
  generateSummary: []
}>()
</script>

<template>
  <div class="today-summary">
    <span class="slack-badge" @click="$emit('viewFull')">
      <Icon icon="tabler:fish" width="16" class="fish-icon" />
      摸鱼 <strong>{{ slackCount }}</strong> 次
    </span>
    <span class="history-hint" @click="$emit('viewFull')">
      查看历史 <Icon icon="tabler:arrow-right" width="14" />
    </span>
    <button class="summary-btn" @click="$emit('generateSummary')">
      <Icon icon="tabler:file-text" width="14" /> 生成总结
    </button>
  </div>
</template>

<style scoped>
.today-summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
}

.slack-badge {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: var(--color-bg-secondary);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-pill);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.slack-badge:hover { transform: translateX(4px); }

.fish-icon { color: var(--color-accent); }

.slack-badge strong {
  color: var(--color-accent);
  font-size: var(--font-md);
}

.history-hint {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: var(--font-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.2s;
}
.history-hint:hover { color: var(--color-accent); }

.summary-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-sm);
  padding: 4px var(--spacing-sm);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}
.summary-btn:hover { color: var(--color-accent); border-color: var(--color-accent); }
</style>
