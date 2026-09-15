<script setup lang="ts">
import RaChip from './RaChip.vue'
import RaProgress from './RaProgress.vue'
import RaButton from './RaButton.vue'
import { ArrowRight, MoreVertical } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  title: string
  description: string
  progress: number
  status?: string
  thumb?: string
  thumbnailUrl?: string | null
}>()

const emit = defineEmits<{ open: [] }>()

const thumbGradients: Record<string, string> = {
  kinematics: 'linear-gradient(135deg, #3a4a3a 0%, #2a3528 50%, #1f2a1c 100%)',
  sensors:    'linear-gradient(135deg, #2a3852 0%, #1a2638 50%, #0f1722 100%)',
  pid:        'radial-gradient(circle at 30% 40%, #2a2630 0%, #15131a 100%)',
  python:     'linear-gradient(135deg, #1a2030 0%, #0d1118 100%)',
  pathplan:   'linear-gradient(135deg, #0a3030 0%, #074045 50%, #0a5050 100%)',
  cobots:     'linear-gradient(135deg, #2a2030 0%, #1a1422 100%)',
}

const thumbBg = computed(() => thumbGradients[props.thumb ?? 'kinematics'] ?? thumbGradients.kinematics)

const statusTone = computed(() => {
  if (props.status === 'Completed') return 'instructor'
  if (props.status === 'New') return 'info'
  return 'overlay'
})

const progressTone = computed(() => props.progress === 100 ? 'green' : 'blue')
</script>

<template>
  <div class="course-card">
    <div class="thumb-wrap">
      <div
        class="thumb"
        :style="thumbnailUrl
          ? { backgroundImage: `url(${thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: thumbBg }"
      />
      <div class="thumb-chip">
        <RaChip :tone="statusTone">{{ status ?? 'In Progress' }}</RaChip>
      </div>
    </div>
    <div class="body">
      <div class="title-row">
        <span class="title">{{ title }}</span>
        <MoreVertical :size="16" class="more-icon" />
      </div>
      <p class="desc">{{ description }}</p>
      <div class="progress-wrap">
        <div class="progress-label">
          <span>Progress</span>
          <span class="progress-pct">{{ progress }}%</span>
        </div>
        <RaProgress :value="progress" :tone="progressTone" />
      </div>
      <RaButton variant="secondary" class="open-btn" @click="emit('open')">
        Open Course
        <template #icon-right><ArrowRight :size="14" /></template>
      </RaButton>
    </div>
  </div>
</template>

<style scoped>
.course-card {
  background: var(--bg-2);
  border: 1px solid var(--line-1);
  border-radius: var(--ra-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.thumb-wrap { position: relative; }
.thumb {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: var(--ra-lg) var(--ra-lg) 0 0;
}
.thumb-chip {
  position: absolute;
  top: 12px;
  right: 12px;
}
.body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-1);
  line-height: 1.3;
}
.more-icon {
  color: var(--fg-4);
  flex-shrink: 0;
  margin-top: 4px;
}
.desc {
  font-size: 13px;
  color: var(--fg-3);
  line-height: 1.5;
  flex: 1;
  margin: 0;
}
.progress-wrap { display: flex; flex-direction: column; gap: 6px; }
.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--fg-3);
}
.progress-pct { color: var(--fg-1); font-weight: 600; }
.open-btn { width: 100%; justify-content: space-between; }
</style>
