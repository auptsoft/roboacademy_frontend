<script setup lang="ts">
import { computed } from 'vue'
import { Cpu } from 'lucide-vue-next'

export type CourseTileStatus = 'Completed' | 'In Progress' | 'New'

// Course card in the "program ribbon" style: sand strip over the thumbnail, a navy notched
// ribbon naming the category, then title, a meta row and tag chips.
const props = defineProps<{
  title: string
  thumbnailUrl: string | null
  ribbon?: string | null
  metaLeft?: string | null
  metaRight?: string | null
  tag?: string | null
  status?: CourseTileStatus
  // School-assigned enrolment, optionally with a deadline (omit dueAt once completed).
  assigned?: boolean
  dueAt?: string | null
}>()

const emit = defineEmits<{ open: [] }>()

const dueLabel = computed(() => {
  if (!props.dueAt) return null
  const due = new Date(props.dueAt)
  return {
    text: `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    overdue: due.getTime() < Date.now(),
  }
})

const statusTone: Record<CourseTileStatus, string> = {
  'Completed':   'bg-(--success-soft) text-(--success)',
  'In Progress': 'bg-(--brand-blue-soft) text-(--brand-blue)',
  'New':         'bg-(--warning-soft) text-(--warning)',
}
</script>

<template>
  <article
    class="group flex flex-col min-w-0 cursor-pointer outline-none"
    tabindex="0"
    role="link"
    :aria-label="props.title"
    @click="emit('open')"
    @keydown.enter="emit('open')"
  >
    <div class="relative aspect-[7/4] overflow-hidden border-t-[14px] border-(--brand-sand) bg-(--sidebar-active-bg) transition-[filter] duration-(--dur-2) group-hover:brightness-95 group-focus-visible:ring-2 group-focus-visible:ring-(--brand-blue-ring)">
      <img v-if="props.thumbnailUrl" :src="props.thumbnailUrl" alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      <div v-else class="absolute inset-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,var(--ph-stripe)_0_12px,transparent_12px_24px)]">
        <Cpu :size="40" class="text-(--fg-4)" />
      </div>

      <span v-if="props.ribbon" class="absolute -top-px left-6 max-w-[60%] [filter:drop-shadow(0_3px_0_rgba(255,255,255,0.95))]">
        <span class="block min-w-[76px] px-4 pt-2.5 pb-5 bg-(--brand-navy) text-(--brand-navy-fg) text-base font-semibold text-center truncate [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]">{{ props.ribbon }}</span>
      </span>
    </div>

    <h3 class="mt-3.5 mb-0 text-base font-normal text-(--heading) leading-snug line-clamp-2 group-hover:underline">{{ props.title }}</h3>

    <div v-if="props.metaLeft || props.metaRight" class="flex items-center justify-between gap-3 mt-2 text-[13px] text-(--fg-3)">
      <span class="truncate">{{ props.metaLeft }}</span>
      <span class="shrink-0">{{ props.metaRight }}</span>
    </div>

    <div v-if="props.tag || props.status || props.assigned || dueLabel" class="flex flex-wrap gap-2 mt-3">
      <span v-if="props.tag" class="inline-flex items-center px-6 py-2 rounded-(--ra-md) bg-(--bg-4) text-(--heading) text-[13px] font-medium uppercase">{{ props.tag }}</span>
      <span v-if="props.status" class="inline-flex items-center px-6 py-2 rounded-(--ra-md) text-[13px] font-medium" :class="statusTone[props.status]">{{ props.status }}</span>
      <span v-if="props.assigned && !dueLabel" class="inline-flex items-center px-4 py-2 rounded-(--ra-md) bg-(--bg-4) text-(--fg-2) text-[13px] font-medium">Assigned</span>
      <span
        v-if="dueLabel"
        class="inline-flex items-center px-4 py-2 rounded-(--ra-md) text-[13px] font-medium"
        :class="dueLabel.overdue ? 'bg-(--danger-soft) text-(--danger)' : 'bg-(--bg-4) text-(--fg-2)'"
      >{{ dueLabel.overdue ? `Overdue · ${dueLabel.text}` : dueLabel.text }}</span>
    </div>
  </article>
</template>
