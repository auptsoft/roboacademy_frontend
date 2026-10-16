<script setup lang="ts">
import { computed, nextTick, provide, ref, watch } from 'vue'
import RaButton from '../ui/RaButton.vue'
import RaProgress from '../ui/RaProgress.vue'
import { ArrowDown } from 'lucide-vue-next'
import { renderRichText } from '../../lib/rich-text'
import ChoiceBlock from './ChoiceBlock.vue'
import OrderBlock from './OrderBlock.vue'
import RevealBlock from './RevealBlock.vue'
import MediaBlock from './MediaBlock.vue'
import EmbedBlock from './EmbedBlock.vue'
import LabelDiagramBlock from './LabelDiagramBlock.vue'
import GalleryBlock from './GalleryBlock.vue'
import FallbackBlock from './FallbackBlock.vue'
import { assetUrlsKey } from './assets'
import { isRequiredCheck, type BlockResult, type InteractiveLessonContent, type LessonBlock, type LessonBlockRenderers } from './types'

// Plays an interactive lesson one step at a time. A step runs up to and including the next
// required check; "Continue" only appears once that check is resolved (answered correctly, or
// the learner asked to see the answer). Results are formative and stay in the browser for now.
// revealAll shows every step up front (admin's editor preview); learners always get it stepped.
// initialResults restores a lesson left part-way (it may arrive after mount, once fetched).
// assetUrls maps media blocks' asset keys to signed URLs; blocks show placeholders until then.
const props = defineProps<{
  content: InteractiveLessonContent
  revealAll?: boolean
  initialResults?: Record<string, BlockResult>
  assetUrls?: Record<string, string>
  /** Players for code, 3D model and program blocks (see LessonBlockRenderers). */
  renderers?: LessonBlockRenderers
}>()
const emit = defineEmits<{
  progress: [state: { complete: boolean; results: Record<string, BlockResult> }]
  /** A check block was resolved just now (not on restore) - the parent records it. */
  answer: [blockId: string, result: BlockResult]
}>()

provide(assetUrlsKey, computed(() => props.assetUrls ?? {}))

const results = ref<Record<string, BlockResult>>({})
const shownSteps = ref(1)
const root = ref<HTMLElement | null>(null)

const steps = computed(() => {
  const out: LessonBlock[][] = [[]]
  for (const block of props.content.blocks) {
    out.at(-1)!.push(block)
    if (isRequiredCheck(block)) out.push([])
  }
  if (!out.at(-1)!.length) out.pop()
  return out
})

const requiredChecks = computed(() => props.content.blocks.filter(isRequiredCheck))
const resolvedCount = computed(() => requiredChecks.value.filter(b => results.value[b.id]).length)

function stepGateResolved(step: LessonBlock[]): boolean {
  const last = step.at(-1)
  return !last || !isRequiredCheck(last) || !!results.value[last.id]
}

const visibleSteps = computed(() => (props.revealAll ? steps.value.length : shownSteps.value))

const canContinue = computed(() =>
  !props.revealAll && shownSteps.value < steps.value.length && stepGateResolved(steps.value[shownSteps.value - 1]!))

const complete = computed(() =>
  visibleSteps.value >= steps.value.length && resolvedCount.value === requiredChecks.value.length)

function onResolved(blockId: string, result: BlockResult) {
  results.value = { ...results.value, [blockId]: result }
  emit('answer', blockId, result)
}

// Restored answers fill in what the learner hasn't answered in this visit, and the lesson opens
// at the first step whose check is still open. It never moves the learner backwards.
watch(() => props.initialResults, (initial) => {
  if (!initial) return
  const known = new Set(props.content.blocks.map(b => b.id))
  const restored = Object.fromEntries(Object.entries(initial).filter(([id]) => known.has(id)))
  results.value = { ...restored, ...results.value }
  const firstOpen = steps.value.findIndex(step => !stepGateResolved(step))
  shownSteps.value = Math.max(shownSteps.value, firstOpen === -1 ? steps.value.length : firstOpen + 1)
}, { immediate: true })

async function continueLesson() {
  shownSteps.value++
  await nextTick()
  root.value?.querySelector(`[data-step="${shownSteps.value - 1}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch([complete, results], () => emit('progress', { complete: complete.value, results: results.value }), { immediate: true })
</script>

<template>
  <div ref="root">
    <div v-if="requiredChecks.length" class="mb-6 flex items-center gap-3">
      <RaProgress :value="(resolvedCount / requiredChecks.length) * 100" class="flex-1" />
      <span class="shrink-0 text-xs text-(--fg-3)">{{ resolvedCount }}/{{ requiredChecks.length }} checks</span>
    </div>

    <section
      v-for="(step, stepIndex) in steps.slice(0, visibleSteps)"
      :key="stepIndex"
      :data-step="stepIndex"
      class="scroll-mt-6"
    >
      <div v-for="block in step" :key="block.id" class="mb-6">
        <div
          v-if="block.type === 'text'"
          class="rich-text leading-[1.7] text-(--fg-2)"
          v-html="renderRichText(block.body)"
        />
        <div v-else-if="block.type === 'choice' || block.type === 'order' || block.type === 'label-diagram' || block.type === 'program'" class="rounded-(--ra-lg) border border-(--line-1) bg-(--bg-2) p-5 max-md:p-4">
          <span v-if="block.required === false" class="mb-2 inline-block text-[11px] font-semibold uppercase tracking-[0.06em] text-(--fg-3)">Optional</span>
          <ChoiceBlock
            v-if="block.type === 'choice'"
            :block="block"
            :result="results[block.id] ?? null"
            @resolved="onResolved(block.id, $event)"
          />
          <OrderBlock
            v-else-if="block.type === 'order'"
            :block="block"
            :result="results[block.id] ?? null"
            @resolved="onResolved(block.id, $event)"
          />
          <LabelDiagramBlock
            v-else-if="block.type === 'label-diagram'"
            :block="block"
            :result="results[block.id] ?? null"
            @resolved="onResolved(block.id, $event)"
          />
          <component
            :is="renderers?.program ?? FallbackBlock"
            v-else
            :block="block"
            :result="results[block.id] ?? null"
            @resolved="(result: BlockResult) => onResolved(block.id, result)"
          />
        </div>
        <RevealBlock v-else-if="block.type === 'reveal'" :block="block" />
        <EmbedBlock v-else-if="block.type === 'embed'" :block="block" />
        <GalleryBlock v-else-if="block.type === 'gallery'" :block="block" />
        <component :is="renderers?.code ?? FallbackBlock" v-else-if="block.type === 'code'" :block="block" />
        <component :is="renderers?.model3d ?? FallbackBlock" v-else-if="block.type === 'model3d'" :block="block" />
        <MediaBlock v-else :block="block" />
      </div>
    </section>

    <RaButton v-if="canContinue" variant="secondary" @click="continueLesson">
      Continue
      <template #icon-right><ArrowDown :size="14" /></template>
    </RaButton>
  </div>
</template>
