<script setup lang="ts">
import { ref } from 'vue'
import type { PersonaConfig, LLMConfig, CompanionConfig } from '../types'

const props = defineProps<{
  persona: PersonaConfig
  llmConfig: LLMConfig
  companionConfig: CompanionConfig
}>()

const emit = defineEmits<{
  save: [{ persona: PersonaConfig; llmConfig: LLMConfig; companionConfig: CompanionConfig }]
  cancel: []
}>()

const localPersona = ref({ ...props.persona })
const localLLM = ref({ ...props.llmConfig })
const localCompanion = ref({ ...props.companionConfig })

function save() {
  emit('save', {
    persona: { ...localPersona.value },
    llmConfig: { ...localLLM.value },
    companionConfig: { ...localCompanion.value },
  })
}
</script>

<template>
  <div class="settings-panel">
    <div class="panel-header">
      <h3>设置</h3>
      <button class="close-btn" @click="emit('cancel')">✕</button>
    </div>

    <p class="hint">
      也可以直接编辑配置文件：<br/>
      <code>%APPDATA%\toki-musume\config.json</code>
    </p>

    <section>
      <h4>角色</h4>
      <label>角色名 <input v-model="localPersona.characterName" /></label>
      <label>软件名 <input v-model="localPersona.appName" /></label>
    </section>

    <section>
      <h4>LLM 配置</h4>
      <label>判断模型 <input v-model="localLLM.judgeModel" placeholder="deepseek-v4-flash" /></label>
      <label>API Key <input v-model="localLLM.judgeApiKey" type="password" /></label>
      <label>API Base <input v-model="localLLM.judgeApiBase" /></label>
      <label>生成模型 <input v-model="localLLM.generateModel" placeholder="deepseek-v4-flash" /></label>
      <label>API Key <input v-model="localLLM.generateApiKey" type="password" /></label>
      <label>API Base <input v-model="localLLM.generateApiBase" /></label>
      <label>总结模型 <input v-model="localLLM.summaryModel" placeholder="deepseek-v4-flash" /></label>
      <label>API Key <input v-model="localLLM.summaryApiKey" type="password" /></label>
      <label>API Base <input v-model="localLLM.summaryApiBase" /></label>
    </section>

    <section>
      <h4>陪伴</h4>
      <label>
        启用
        <input v-model="localCompanion.enabled" type="checkbox" />
      </label>
      <label>
        频率
        <select v-model="localCompanion.frequency">
          <option value="quiet">安静</option>
          <option value="normal">普通</option>
          <option value="chatty">话痨</option>
        </select>
      </label>
      <label>冷却(分钟) <input v-model.number="localCompanion.cooldownMinutes" type="number" /></label>
      <label>触发概率 <input v-model.number="localCompanion.triggerProbability" type="number" step="0.1" min="0" max="1" /></label>
      <label>回退间隔(分钟) <input v-model.number="localCompanion.fallbackIntervalMinutes" type="number" /></label>
    </section>

    <div class="panel-actions">
      <button class="save-btn" @click="save">保存</button>
      <button class="cancel-btn" @click="emit('cancel')">取消</button>
    </div>
  </div>
</template>

<style scoped>
.settings-panel { padding: var(--spacing-lg); max-width: 500px; border: 1px solid var(--color-border); border-radius: var(--radius-md); margin-bottom: var(--spacing-md); }
.panel-header { display: flex; justify-content: space-between; align-items: center; }
.close-btn { background: none; border: none; font-size: 1.2em; cursor: pointer; color: var(--color-text-muted); }
.hint { font-size: var(--font-sm); color: var(--color-text-muted); background: var(--color-bg-secondary); padding: var(--spacing-sm); border-radius: var(--radius-sm); }
.hint code { font-size: var(--font-sm); }
section { margin-bottom: var(--spacing-lg); }
h4 { margin-bottom: var(--spacing-xs); }
label { display: block; margin-bottom: var(--spacing-xs); }
input, select { width: 100%; padding: var(--spacing-xs); margin-top: 2px; box-sizing: border-box; }
input[type="checkbox"] { width: auto; }
.panel-actions { display: flex; gap: var(--spacing-sm); }
.save-btn { padding: var(--spacing-sm) var(--spacing-lg); background: var(--color-accent); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; }
.save-btn:hover { background: var(--color-accent-hover); }
.cancel-btn { padding: var(--spacing-sm) var(--spacing-lg); background: var(--color-bg-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; }
</style>
