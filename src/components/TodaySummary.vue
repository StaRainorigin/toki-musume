<script setup lang="ts">
defineProps<{
  slackCount: number
}>()

defineEmits<{ viewFull: [] }>()
</script>

<template>
  <div class="today-summary" @click="$emit('viewFull')">
    <span>摸鱼 {{ slackCount }} 次</span>
    <span class="hint">| 查看历史</span>
  </div>
</template>

<style scoped>
.today-summary { padding: var(--spacing-sm); color: var(--color-text-secondary); font-size: var(--font-sm); cursor: pointer; }
.today-summary:hover { color: var(--color-accent); }
.hint { margin-left: var(--spacing-xs); }
</style>
