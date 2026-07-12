<script setup lang="ts">
defineProps<{
  slackCount: number
}>()

defineEmits<{ viewFull: [] }>()
</script>

<template>
  <div class="today-summary" @click="$emit('viewFull')">
    <span class="slack-badge">
      🐟 摸鱼 <strong>{{ slackCount }}</strong> 次
    </span>
    <span class="history-hint">查看历史 →</span>
  </div>
</template>

<style scoped>
.today-summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: all 0.2s;
}

.today-summary:hover {
  transform: translateX(4px);
}

.slack-badge {
  background: var(--color-bg-secondary);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-pill);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.slack-badge strong {
  color: var(--color-accent);
  font-size: var(--font-md);
}

.history-hint {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
  transition: color 0.2s;
}

.today-summary:hover .history-hint {
  color: var(--color-accent);
}
</style>
