<script setup lang="ts">
import { useRouter } from 'vue-router'
import { RaChip, RaButton } from '@roboacademy/ui'
import { Clock, Layers, ArrowRight } from 'lucide-vue-next'
import type { CourseCatalogItem } from '@/api/learning'

const props = defineProps<{
  id: string
  title: string
  description: string | null
  category: string | null
  level: CourseCatalogItem['level']
  lessonCount: number
  thumbnailUrl: string | null
}>()

const levelRank: Record<string, number> = { Beginner: 1, Intermediate: 2, Advanced: 3 }

const router = useRouter()

function viewDetails() {
  router.push(`/app/explore/courses/${props.id}`)
}
</script>

<template>
  <article
    class="bg-(--bg-2) border border-(--line-1) rounded-(--ra-xl) overflow-hidden flex flex-col cursor-pointer transition-[transform,border-color] duration-(--dur-2) ease-(--ease-out) hover:-translate-y-0.5 hover:border-(--line-2)"
    @click="viewDetails"
  >
    <div
      class="aspect-video bg-(--bg-3) border-b border-(--line-1) relative flex items-end justify-between p-3"
      :style="thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined"
      :class="!thumbnailUrl && 'bg-[repeating-linear-gradient(135deg,var(--ph-stripe)_0_12px,transparent_12px_24px)]'"
    >
      <RaChip v-if="category" tone="info">{{ category }}</RaChip>
      <span v-else />
      <span v-if="level" class="inline-flex gap-[3px] bg-(--tag-bg) rounded-(--ra-pill) py-1.5 px-2">
        <span v-for="n in 3" :key="n" class="w-[5px] h-[5px] rounded-full" :class="n <= (levelRank[level] ?? 0) ? 'bg-(--brand-blue)' : 'bg-white/[0.18]'" />
      </span>
    </div>
    <div class="p-5 flex flex-col gap-3 flex-1">
      <h3 class="m-0 text-lg font-bold text-(--fg-1) tracking-[-0.005em]">{{ title }}</h3>
      <p class="m-0 text-[13px] leading-5 text-(--fg-3) flex-1">{{ description }}</p>
      <div class="flex items-center justify-between gap-3 pt-3 border-t border-(--line-1) text-xs text-(--fg-4)">
        <span v-if="level" class="inline-flex items-center gap-1.5"><Layers :size="12" />{{ level }}</span>
        <span class="inline-flex items-center gap-1.5"><Clock :size="12" />{{ lessonCount }} lessons</span>
      </div>

      <RaButton class="w-full justify-center" @click="viewDetails">
        View details
        <template #icon-right><ArrowRight :size="14" /></template>
      </RaButton>
    </div>
  </article>
</template>
