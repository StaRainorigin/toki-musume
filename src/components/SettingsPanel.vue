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
    <h3>设置</h3>

    <section>
      <h4>角色</h4>
      <label>角色名 <input v-model="localPersona.characterName" /></label>
      <label>软件名 <input v-model="localPersona.appName" /></label>
    </section>

    <section>
      <h4>LLM 配置</h4>
      <label>判断模型 <input v-model="localLLM.judgeModel" placeholder="gpt-4o-mini" /></label>
      <label>API Key <input v-model="localLLM.judgeApiKey" type="password" /></label>
      <label>API Base <input v-model="localLLM.judgeApiBase" /></label>
      <label>生成模型 <input v-model="localLLM.generateModel" placeholder="gpt-4o-mini" /></label>
      <label>API Key <input v-model="localLLM.generateApiKey" type="password" /></label>
      <label>API Base <input v-model="localLLM.generateApiBase" /></label>
      <label>总结模型 <input v-model="localLLM.summaryModel" placeholder="gpt-4o" /></label>
      <label>API Key <input v-model="localLLM.summaryApiKey" type="password" /></label>
      <label>API Base <input v-model="localLLM.summaryApiBase" /></label>
    </section>

    <section>
      <h4>陪伴</h4>
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
    </section>

    <button @click="save">保存</button>
  </div>
</template>

<style scoped>
.settings-panel { padding: 16px; max-width: 500px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px; }
section { margin-bottom: 16px; }
h4 { margin-bottom: 4px; }
label { display: block; margin-bottom: 4px; }
input, select { width: 100%; padding: 4px; margin-top: 2px; box-sizing: border-box; }
button { padding: 8px 16px; background: #4a90d9; color: white; border: none; border-radius: 4px; cursor: pointer; }
</style>
