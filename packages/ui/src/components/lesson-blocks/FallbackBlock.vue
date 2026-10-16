<script setup lang="ts">
import { Box } from 'lucide-vue-next'
import RaButton from '../ui/RaButton.vue'
import type { BlockResult, CodeBlock, Model3dBlock, ProgramBlock } from './types'

// Shown when the app didn't provide a renderer for a heavy block: the code as plain text, the
// model's description, or - for a coding task - a way past it, so a learner is never stuck.
defineProps<{ block: CodeBlock | Model3dBlock | ProgramBlock; result?: BlockResult | null }>()
defineEmits<{ resolved: [result: BlockResult] }>()
</script>

<template>
  <pre
    v-if="block.type === 'code'"
    class="m-0 overflow-x-auto rounded-(--ra-lg) border border-(--line-1) bg-(--bg-3) p-4 font-mono text-[13px] leading-[1.6] text-(--fg-1)"
  ><code>{{ block.code }}</code></pre>
  <div v-else-if="block.type === 'model3d'" class="flex items-center gap-3 rounded-(--ra-lg) border border-(--line-1) bg-(--bg-3) p-4 text-sm text-(--fg-2)">
    <Box :size="20" class="shrink-0 text-(--fg-3)" /> {{ block.alt }}
  </div>
  <div v-else>
    <p class="mt-0 mb-3 text-[15px] font-semibold text-(--fg-1)">{{ block.prompt }}</p>
    <p class="m-0 text-[13px] text-(--fg-3)">This coding task can't run here.</p>
    <RaButton v-if="!result" variant="secondary" class="mt-3" @click="$emit('resolved', { correct: false, attempts: 0 })">Continue without it</RaButton>
  </div>
</template>
