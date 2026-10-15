<script setup lang="ts">
import { ref } from 'vue'
import { RaChip } from '@roboacademy/ui'
import InteractiveLesson from '@/components/lesson-blocks/InteractiveLesson.vue'
import { sampleInteractiveLesson } from '@/components/lesson-blocks/sample-lesson'

// Dev-only preview of the interactive lesson renderer; the route is registered in DEV builds only.
const complete = ref(false)
</script>

<template>
  <div class="mx-auto max-w-180 px-12 pt-8 pb-12 max-md:px-4 max-md:pt-5">
    <div class="mb-3 flex items-center gap-3">
      <RaChip tone="info">Dev preview</RaChip>
      <RaChip :tone="complete ? 'student' : 'neutral'">{{ complete ? 'Lesson complete' : 'In progress' }}</RaChip>
    </div>
    <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Your first LED circuit</h1>
    <hr class="my-8 border-0 border-t border-(--line-1)" />
    <InteractiveLesson :content="sampleInteractiveLesson" @progress="complete = $event.complete" />
  </div>
</template>
