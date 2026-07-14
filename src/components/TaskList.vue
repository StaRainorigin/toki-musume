<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { Task, TaskType } from '../types'

const props = defineProps<{
  tasks: Task[]
}>()

const emit = defineEmits<{
  addTask: [task: { title: string; type: TaskType; plannedMinutes?: number; description?: string }]
  removeTask: [id: string]
  completeTask: [id: string]
  setActiveTask: [id: string]
  generatePlan: []
}>()

const showAddForm = ref(false)
const newTitle = ref('')
const newType = ref<TaskType>('timed')
const newMinutes = ref(60)
const newDescription = ref('')

const pendingTasks = computed(() => props.tasks.filter((t) => t.status === 'pending' || t.status === 'active'))
const completedTasks = computed(() => props.tasks.filter((t) => t.status === 'completed'))

function handleAdd() {
  if (!newTitle.value.trim()) return
  emit('addTask', {
    title: newTitle.value.trim(),
    type: newType.value,
    plannedMinutes: newType.value === 'timed' ? newMinutes.value : undefined,
    description: newType.value === 'target' ? newDescription.value : undefined,
  })
  newTitle.value = ''
  newDescription.value = ''
  showAddForm.value = false
}

async function handleGeneratePlan() {
  emit('generatePlan')
  // suggestions will be set by parent via prop or event
}

function taskProgress(task: Task): number {
  if (task.type !== 'timed' || !task.plannedMinutes) return 0
  return Math.min(1, (task.completedMinutes ?? 0) / task.plannedMinutes)
}
</script>

<template>
  <div class="task-list">
    <div class="task-header">
      <h3><Icon icon="tabler:checkbox" width="18" /> 今日任务</h3>
      <div class="header-actions">
        <button class="mini-btn" @click="handleGeneratePlan">
          <Icon icon="tabler:sparkles" width="14" /> AI 计划
        </button>
        <button class="mini-btn" @click="showAddForm = !showAddForm">
          <Icon icon="tabler:plus" width="14" /> 添加
        </button>
      </div>
    </div>

    <!-- 添加任务表单 -->
    <div v-if="showAddForm" class="add-form">
      <input v-model="newTitle" placeholder="任务标题..." class="task-input" />
      <div class="form-row">
        <select v-model="newType">
          <option value="timed">计时任务</option>
          <option value="target">目标任务</option>
        </select>
        <input v-if="newType === 'timed'" v-model.number="newMinutes" type="number" min="10" placeholder="分钟" class="minutes-input" />
      </div>
      <input v-if="newType === 'target'" v-model="newDescription" placeholder="目标描述..." class="task-input" />
      <div class="form-actions">
        <button class="save-btn" @click="handleAdd">确认</button>
        <button class="cancel-btn" @click="showAddForm = false">取消</button>
      </div>
    </div>

    <!-- 待办任务 -->
    <div v-if="pendingTasks.length === 0 && !showAddForm" class="empty">
      还没有任务，点击"添加"或"AI 计划"创建
    </div>

    <div v-for="task in pendingTasks" :key="task.id" :class="['task-item', { active: task.status === 'active' }]">
      <div class="task-main" @click="emit('setActiveTask', task.id)">
        <div class="task-icon">
          <Icon :icon="task.type === 'timed' ? 'tabler:clock' : 'tabler:target'" width="16" />
        </div>
        <div class="task-content">
          <div class="task-title">{{ task.title }}</div>
          <div class="task-meta">
            <span v-if="task.type === 'timed' && task.plannedMinutes" class="task-progress-text">
              {{ task.completedMinutes ?? 0 }}/{{ task.plannedMinutes }}m
            </span>
            <span v-if="task.pomodoroCount" class="pomodoro-count">🍅×{{ task.pomodoroCount }}</span>
          </div>
          <!-- 进度条 -->
          <div v-if="task.type === 'timed' && task.plannedMinutes" class="progress-bar">
            <div class="progress-fill" :style="{ width: `${taskProgress(task) * 100}%` }"></div>
          </div>
        </div>
      </div>
      <div class="task-actions">
        <button v-if="task.status === 'active'" class="icon-action complete-btn" @click.stop="emit('completeTask', task.id)" title="完成">
          <Icon icon="tabler:check" width="16" />
        </button>
        <button class="icon-action remove-btn" @click.stop="emit('removeTask', task.id)" title="删除">
          <Icon icon="tabler:trash" width="16" />
        </button>
      </div>
    </div>

    <!-- 已完成 -->
    <div v-if="completedTasks.length > 0" class="completed-section">
      <div class="completed-label">已完成 ({{ completedTasks.length }})</div>
      <div v-for="task in completedTasks" :key="task.id" class="task-item completed">
        <Icon icon="tabler:check" width="16" class="check-icon" />
        <span class="task-title completed-title">{{ task.title }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-list {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  box-shadow: var(--shadow-sm);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}
.task-header h3 { margin: 0; font-size: var(--font-md); display: flex; align-items: center; gap: var(--spacing-xs); color: var(--color-text); }
.header-actions { display: flex; gap: var(--spacing-xs); }

.mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-sm);
  padding: 4px var(--spacing-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}
.mini-btn:hover { color: var(--color-accent); border-color: var(--color-accent); }

.add-form {
  background: var(--color-bg-secondary);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-sm);
}
.task-input {
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-xs);
  background: var(--color-bg-card);
  color: var(--color-text);
  box-sizing: border-box;
}
.form-row { display: flex; gap: var(--spacing-xs); margin-bottom: var(--spacing-xs); }
.form-row select, .minutes-input {
  padding: var(--spacing-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text);
  flex: 1;
}
.minutes-input { max-width: 80px; }
.form-actions { display: flex; gap: var(--spacing-xs); }
.save-btn { padding: 4px var(--spacing-md); background: var(--color-accent); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--font-sm); }
.cancel-btn { padding: 4px var(--spacing-md); background: var(--color-bg-card); color: var(--color-text-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; font-size: var(--font-sm); }

.empty { color: var(--color-text-muted); font-size: var(--font-sm); padding: var(--spacing-md); text-align: center; }

.task-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-xs);
  transition: all 0.2s;
  border: 1px solid transparent;
}
.task-item:hover { background: var(--color-bg-secondary); }
.task-item.active { background: var(--color-accent-light); border-color: var(--color-accent); }

.task-main { display: flex; align-items: flex-start; gap: var(--spacing-sm); flex: 1; cursor: pointer; }
.task-icon { color: var(--color-text-secondary); margin-top: 2px; }
.task-item.active .task-icon { color: var(--color-accent); }
.task-content { flex: 1; }
.task-title { font-size: var(--font-sm); color: var(--color-text); }
.task-meta { display: flex; gap: var(--spacing-xs); margin-top: 2px; font-size: var(--font-xs); color: var(--color-text-muted); }
.pomodoro-count { color: var(--color-danger); }

.progress-bar { height: 4px; background: var(--color-bg-hover); border-radius: var(--radius-pill); margin-top: var(--spacing-xs); overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-accent); border-radius: var(--radius-pill); transition: width 0.3s; }

.task-actions { display: flex; gap: var(--spacing-xs); }
.icon-action {
  width: 28px; height: 28px;
  border: none; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s;
}
.complete-btn { background: var(--color-rest-light); color: var(--color-rest); }
.complete-btn:hover { background: var(--color-rest); color: white; }
.remove-btn { background: var(--color-bg-secondary); color: var(--color-text-muted); }
.remove-btn:hover { background: var(--color-danger); color: white; }

.completed-section { margin-top: var(--spacing-md); padding-top: var(--spacing-sm); border-top: 1px solid var(--color-border-light); }
.completed-label { font-size: var(--font-xs); color: var(--color-text-muted); margin-bottom: var(--spacing-xs); }
.task-item.completed { opacity: 0.6; }
.completed-title { text-decoration: line-through; }
.check-icon { color: var(--color-rest); }
</style>
