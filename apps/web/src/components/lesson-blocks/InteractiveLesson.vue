<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RaButton, RaProgress } from '@roboacademy/ui'
import { ArrowDown } from 'lucide-vue-next'
import { renderRichText } from '@/lib/rich-text'
import ChoiceBlock from './ChoiceBlock.vue'
import OrderBlock from './OrderBlock.vue'
import RevealBlock from './RevealBlock.vue'
import { isRequiredCheck, type BlockResult, type InteractiveLessonContent, type LessonBlock } from './types'

// Plays an interactive lesson one step at a time. A step runs up to and including the next
// required check; "Continue" only appears once that check is resolved (answered correctly, or
// the learner asked to see the answer). Results are formative and stay in the browser for now.
const props = defineProps<{ content: InteractiveLessonContent }>()
const emit = defineEmits<{
  progress: [state: { complete: boolean; results: Record<string, BlockResult> }]
}>()

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

const canContinue = computed(() =>
  shownSteps.value < steps.value.length && stepGateResolved(steps.value[shownSteps.value - 1]!))

const complete = computed(() =>
  shownSteps.value >= steps.value.length && resolvedCount.value === requiredChecks.value.length)

function onResolved(blockId: string, result: BlockResult) {
  results.value = { ...results.value, [blockId]: result }
}

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
      v-for="(step, stepIndex) in steps.slice(0, shownSteps)"
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
        <div v-else-if="block.type === 'choice' || block.type === 'order'" class="rounded-(--ra-lg) border border-(--line-1) bg-(--bg-2) p-5 max-md:p-4">
          <ChoiceBlock
            v-if="block.type === 'choice'"
            :block="block"
            :result="results[block.id] ?? null"
            @resolved="onResolved(block.id, $event)"
          />
          <OrderBlock
            v-else
            :block="block"
            :result="results[block.id] ?? null"
            @resolved="onResolved(block.id, $event)"
          />
        </div>
        <RevealBlock v-else-if="block.type === 'reveal'" :block="block" />
      </div>
    </section>

    <RaButton v-if="canContinue" variant="secondary" @click="continueLesson">
      Continue
      <template #icon-right><ArrowDown :size="14" /></template>
    </RaButton>
  </div>
</template>
