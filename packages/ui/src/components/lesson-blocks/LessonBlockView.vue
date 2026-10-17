<script setup lang="ts">
import { renderRichText } from '../../lib/rich-text'
import ChoiceBlock from './ChoiceBlock.vue'
import OrderBlock from './OrderBlock.vue'
import RevealBlock from './RevealBlock.vue'
import MediaBlock from './MediaBlock.vue'
import EmbedBlock from './EmbedBlock.vue'
import LabelDiagramBlock from './LabelDiagramBlock.vue'
import GalleryBlock from './GalleryBlock.vue'
import FallbackBlock from './FallbackBlock.vue'
import ClozeBlock from './ClozeBlock.vue'
import MatchBlock from './MatchBlock.vue'
import NumberBlock from './NumberBlock.vue'
import ParsonsBlock from './ParsonsBlock.vue'
import { isCheckBlock, type BlockResult, type LessonBlock, type LessonBlockRenderers } from './types'

/** One block of an interactive lesson, whichever way the lesson lays its blocks out. */
defineProps<{ block: LessonBlock; result: BlockResult | null; renderers?: LessonBlockRenderers }>()
const emit = defineEmits<{ resolved: [result: BlockResult] }>()

function onResolved(result: BlockResult) {
  emit('resolved', result)
}
</script>

<template>
  <div
    v-if="block.type === 'text'"
    class="rich-text leading-[1.7] text-(--fg-2)"
    v-html="renderRichText(block.body)"
  />
  <div v-else-if="isCheckBlock(block)" class="rounded-(--ra-lg) border border-(--line-1) bg-(--bg-2) p-5 max-md:p-4">
    <span v-if="block.required === false" class="mb-2 inline-block text-[11px] font-semibold uppercase tracking-[0.06em] text-(--fg-3)">Optional</span>
    <ChoiceBlock v-if="block.type === 'choice'" :block="block" :result="result" @resolved="onResolved" />
    <OrderBlock v-else-if="block.type === 'order'" :block="block" :result="result" @resolved="onResolved" />
    <LabelDiagramBlock v-else-if="block.type === 'label-diagram'" :block="block" :result="result" @resolved="onResolved" />
    <ClozeBlock v-else-if="block.type === 'cloze'" :block="block" :result="result" @resolved="onResolved" />
    <MatchBlock v-else-if="block.type === 'match'" :block="block" :result="result" @resolved="onResolved" />
    <NumberBlock v-else-if="block.type === 'number'" :block="block" :result="result" @resolved="onResolved" />
    <ParsonsBlock v-else-if="block.type === 'parsons'" :block="block" :result="result" @resolved="onResolved" />
    <component :is="renderers?.program ?? FallbackBlock" v-else :block="block" :result="result" @resolved="onResolved" />
  </div>
  <RevealBlock v-else-if="block.type === 'reveal'" :block="block" />
  <EmbedBlock v-else-if="block.type === 'embed'" :block="block" />
  <GalleryBlock v-else-if="block.type === 'gallery'" :block="block" />
  <component :is="renderers?.code ?? FallbackBlock" v-else-if="block.type === 'code'" :block="block" />
  <component :is="renderers?.model3d ?? FallbackBlock" v-else-if="block.type === 'model3d'" :block="block" />
  <MediaBlock v-else :block="block" />
</template>
