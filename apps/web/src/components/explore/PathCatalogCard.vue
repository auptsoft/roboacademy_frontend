<script setup lang="ts">
import { useRouter } from 'vue-router'
import { RaCard, RaChip } from '@roboacademy/ui'
import { Layers } from 'lucide-vue-next'

const props = defineProps<{
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  courseCount: number
}>()

const router = useRouter()

function viewDetails() {
  router.push(`/app/explore/paths/${props.id}`)
}
</script>

<template>
  <RaCard
    :padding="0"
    class="flex h-full flex-col overflow-hidden cursor-pointer transition-[transform,border-color] duration-(--dur-2) ease-(--ease-out) hover:-translate-y-0.5 hover:border-(--line-2)"
    @click="viewDetails"
  >
    <div
      class="aspect-video bg-(--bg-3) border-b border-(--line-1)"
      :style="thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined"
      :class="!thumbnailUrl && 'bg-[repeating-linear-gradient(135deg,var(--ph-stripe)_0_12px,transparent_12px_24px)]'"
    />
    <div class="flex flex-1 flex-col gap-3 p-5">
      <div class="flex items-start justify-between gap-3">
        <h3 class="m-0 text-lg font-bold text-(--fg-1) tracking-[-0.005em]">{{ title }}</h3>
        <RaChip tone="neutral" class="shrink-0">
          <span class="inline-flex items-center gap-1"><Layers :size="11" />{{ courseCount }} {{ courseCount === 1 ? 'course' : 'courses' }}</span>
        </RaChip>
      </div>
      <p class="m-0 text-[13px] leading-5 text-(--fg-3) flex-1">{{ description }}</p>
    </div>
  </RaCard>
</template>
