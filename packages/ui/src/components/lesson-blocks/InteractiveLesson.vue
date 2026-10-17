<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import RaButton from '../ui/RaButton.vue'
import RaProgress from '../ui/RaProgress.vue'
import { ArrowDown, ArrowLeft, ArrowRight, PartyPopper } from 'lucide-vue-next'
import LessonBlockView from './LessonBlockView.vue'
import { assetUrlsKey } from './assets'
import {
  isCheckBlock, isRequiredCheck, lessonCards,
  type BlockResult, type InteractiveLessonContent, type LessonBlock, type LessonBlockRenderers,
} from './types'

// Plays an interactive lesson in one of two layouts (content.display):
// - cards: one card per screen (a block, or blocks joined with keepWithNext), Duolingo-style.
//   Continue waits for the card's required questions; Back revisits earlier cards; a finish card
//   with a summary ends the lesson.
// - scroll: one page that grows a step at a time. A step runs up to and including the next
//   required question; "Continue" appears once it's resolved.
// revealAll shows every block at once (admin's "all blocks" preview).
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
defineSlots<{
  /** Cards display: shown on the finish card, e.g. the page's "Mark complete" button. */
  finish?: () => unknown
}>()

provide(assetUrlsKey, computed(() => props.assetUrls ?? {}))

const results = ref<Record<string, BlockResult>>({})
const root = ref<HTMLElement | null>(null)
const useCards = computed(() => props.content.display === 'cards' && !props.revealAll)

const requiredChecks = computed(() => props.content.blocks.filter(isRequiredCheck))
const resolvedCount = computed(() => requiredChecks.value.filter(b => results.value[b.id]).length)
const allRequiredResolved = computed(() => resolvedCount.value === requiredChecks.value.length)

function onResolved(blockId: string, result: BlockResult) {
  results.value = { ...results.value, [blockId]: result }
  emit('answer', blockId, result)
}

// ── Scroll layout ──────────────────────────────────────────────────────────

const shownSteps = ref(1)

const steps = computed(() => {
  const out: LessonBlock[][] = [[]]
  for (const block of props.content.blocks) {
    out.at(-1)!.push(block)
    if (isRequiredCheck(block)) out.push([])
  }
  if (!out.at(-1)!.length) out.pop()
  return out
})

function stepGateResolved(step: LessonBlock[]): boolean {
  const last = step.at(-1)
  return !last || !isRequiredCheck(last) || !!results.value[last.id]
}

const visibleSteps = computed(() => (props.revealAll ? steps.value.length : shownSteps.value))

const canContinueScroll = computed(() =>
  !props.revealAll && shownSteps.value < steps.value.length && stepGateResolved(steps.value[shownSteps.value - 1]!))

async function continueScroll() {
  shownSteps.value++
  await nextTick()
  root.value?.querySelector(`[data-step="${shownSteps.value - 1}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── Cards layout ───────────────────────────────────────────────────────────

const cards = computed(() => lessonCards(props.content.blocks))
/** cards.length means the finish card. */
const cardIndex = ref(0)
const reachedEnd = ref(false)
const onFinish = computed(() => cardIndex.value >= cards.value.length)
const currentCard = computed(() => cards.value[cardIndex.value] ?? [])

function cardGateResolved(card: LessonBlock[]): boolean {
  return card.filter(isRequiredCheck).every(b => results.value[b.id])
}

const canContinueCard = computed(() => !onFinish.value && cardGateResolved(currentCard.value))
const cardHasQuestion = computed(() => currentCard.value.some(isCheckBlock))

async function goToCard(index: number) {
  cardIndex.value = Math.max(0, Math.min(index, cards.value.length))
  if (onFinish.value) reachedEnd.value = true
  await nextTick()
  // Keep the top of the card in view on phones, where a long card leaves you at its bottom.
  const top = root.value?.getBoundingClientRect().top ?? 0
  if (top < 0) root.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Enter continues - when focus is on the page itself or inside this lesson (not in another
// lesson on the same page), and not in a field or on a button, where Enter already means something.
function onKeydown(event: KeyboardEvent) {
  if (!useCards.value || event.key !== 'Enter' || event.defaultPrevented) return
  const active = document.activeElement
  if (active && active !== document.body && !root.value?.contains(active)) return
  if ((event.target as HTMLElement).closest?.('input, textarea, select, button, a, [contenteditable="true"]')) return
  if (canContinueCard.value) void goToCard(cardIndex.value + 1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

/** Finish card summary: questions answered, and how many right first time. */
const summary = computed(() => {
  const checks = props.content.blocks.filter(isCheckBlock).filter(b => results.value[b.id])
  return {
    answered: checks.length,
    firstTry: checks.filter(b => results.value[b.id]!.correct && results.value[b.id]!.attempts <= 1).length,
  }
})

// ── Both ───────────────────────────────────────────────────────────────────

const complete = computed(() => allRequiredResolved.value
  && (useCards.value ? reachedEnd.value : visibleSteps.value >= steps.value.length))

// Restored answers fill in what the learner hasn't answered in this visit, and the lesson opens
// where they left off: the first step or card with an unanswered required question. It never
// moves the learner backwards, and a lesson with nothing answered yet starts at the beginning.
watch(() => props.initialResults, (initial) => {
  if (!initial) return
  const known = new Set(props.content.blocks.map(b => b.id))
  const restored = Object.fromEntries(Object.entries(initial).filter(([id]) => known.has(id)))
  results.value = { ...restored, ...results.value }

  const firstOpenStep = steps.value.findIndex(step => !stepGateResolved(step))
  shownSteps.value = Math.max(shownSteps.value, firstOpenStep === -1 ? steps.value.length : firstOpenStep + 1)

  if (!Object.keys(restored).length) return
  const firstOpenCard = cards.value.findIndex(card => !cardGateResolved(card))
  let lastAnswered = -1
  cards.value.forEach((card, i) => card.some(b => restored[b.id]) && (lastAnswered = i))
  const resumeAt = firstOpenCard === -1 ? lastAnswered + 1 : firstOpenCard
  if (resumeAt > cardIndex.value) {
    cardIndex.value = Math.min(resumeAt, cards.value.length)
    if (onFinish.value) reachedEnd.value = true
  }
}, { immediate: true })

watch([complete, results], () => emit('progress', { complete: complete.value, results: results.value }), { immediate: true })
</script>

<template>
  <div ref="root" class="mx-auto max-w-220 scroll-mt-6 px-12 pt-8 pb-12 max-md:px-4 max-md:pt-5">
    <!-- Cards -->
    <template v-if="useCards">
      <div class="mb-6 flex items-center gap-3">
        <RaProgress :value="(Math.min(cardIndex, cards.length) / cards.length) * 100" class="flex-1" />
        <span class="shrink-0 text-xs text-(--fg-3)">{{ Math.min(cardIndex + 1, cards.length) }} / {{ cards.length }}</span>
      </div>

      <Transition
        mode="out-in"
        enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
        enter-from-class="translate-x-4 opacity-0"
        leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
        leave-to-class="-translate-x-4 opacity-0"
      >
        <section v-if="!onFinish" :key="cardIndex" class="min-h-48" :aria-label="`Card ${cardIndex + 1} of ${cards.length}`">
          <div v-for="block in currentCard" :key="block.id" class="mb-6">
            <LessonBlockView
              :block="block"
              :result="results[block.id] ?? null"
              :renderers="renderers"
              @resolved="onResolved(block.id, $event)"
            />
          </div>
        </section>

        <section v-else key="finish" class="flex min-h-48 flex-col items-center gap-3 py-6 text-center" aria-label="Lesson finished">
          <PartyPopper :size="36" class="text-(--brand-blue)" />
          <h2 class="m-0 text-xl font-bold text-(--fg-1)">Lesson finished!</h2>
          <p v-if="summary.answered" class="m-0 text-sm text-(--fg-2)">
            You answered {{ summary.answered }} {{ summary.answered === 1 ? 'question' : 'questions' }},
            {{ summary.firstTry }} right first time.
          </p>
          <p v-if="!allRequiredResolved" class="m-0 text-[13px] text-(--danger)">Some questions still need an answer. Go back to finish them.</p>
          <slot name="finish" />
        </section>
      </Transition>

      <div class="mt-2 flex items-center gap-2 border-t border-(--line-1) pt-4">
        <RaButton v-if="cardIndex > 0" variant="ghost" @click="goToCard(cardIndex - 1)">
          <template #icon><ArrowLeft :size="14" /></template>
          Back
        </RaButton>
        <span v-if="!onFinish && cardHasQuestion && !canContinueCard" class="ml-auto text-xs text-(--fg-3)">Answer to continue</span>
        <RaButton v-if="!onFinish" :class="!cardHasQuestion || canContinueCard ? 'ml-auto' : ''" :disabled="!canContinueCard" @click="goToCard(cardIndex + 1)">
          {{ cardIndex === cards.length - 1 ? 'Finish' : 'Continue' }}
          <template #icon-right><ArrowRight :size="14" /></template>
        </RaButton>
      </div>
    </template>

    <!-- Scrolling page -->
    <template v-else>
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
          <LessonBlockView
            :block="block"
            :result="results[block.id] ?? null"
            :renderers="renderers"
            @resolved="onResolved(block.id, $event)"
          />
        </div>
      </section>

      <RaButton v-if="canContinueScroll" variant="secondary" @click="continueScroll">
        Continue
        <template #icon-right><ArrowDown :size="14" /></template>
      </RaButton>
    </template>
  </div>
</template>
