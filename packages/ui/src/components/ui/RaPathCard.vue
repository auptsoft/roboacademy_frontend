<script setup lang="ts">
import RaChip from './RaChip.vue'
import RaProgress from './RaProgress.vue'
import RaButton from './RaButton.vue'
import { ArrowRight, Layers } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  title: string
  description: string
  courseCount: number
  completedCourses: number
  progress: number
  thumbnailUrl?: string | null
}>()

const emit = defineEmits<{ open: [] }>()

const statusTone = computed(() => props.progress === 100 ? 'instructor' : 'info')
const progressTone = computed(() => props.progress === 100 ? 'green' : 'blue')
</script>

<template>
  <div class="course-card">
    <div class="thumb-wrap">
      <div
        class="thumb"
        :style="thumbnailUrl
          ? { backgroundImage: `url(${thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : undefined"
      />
      <div class="thumb-chip">
        <RaChip :tone="statusTone">
          <span class="inline-flex items-center gap-1"><Layers :size="11" />{{ courseCount }} {{ courseCount === 1 ? 'course' : 'courses' }}</span>
        </RaChip>
      </div>
    </div>
    <div class="body">
      <div class="title-row">
        <span class="title">{{ title }}</span>
      </div>
      <p class="desc">{{ description }}</p>
      <div class="progress-wrap">
        <div class="progress-label">
          <span>Progress</span>
          <span class="progress-pct">{{ completedCourses }}/{{ courseCount }} courses</span>
        </div>
        <RaProgress :value="progress" :tone="progressTone" />
      </div>
      <RaButton variant="secondary" class="open-btn" @click="emit('open')">
        Open Path
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
  background: repeating-linear-gradient(135deg, var(--ph-stripe) 0 12px, transparent 12px 24px);
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
