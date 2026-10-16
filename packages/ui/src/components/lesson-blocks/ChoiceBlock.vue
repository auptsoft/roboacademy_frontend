<script setup lang="ts">
import { computed, ref } from 'vue'
import RaButton from '../ui/RaButton.vue'
import { Check, X } from 'lucide-vue-next'
import { renderRichText } from '../../lib/rich-text'
import type { BlockResult, ChoiceBlock } from './types'

const props = defineProps<{ block: ChoiceBlock; result: BlockResult | null }>()
const emit = defineEmits<{ resolved: [result: BlockResult] }>()

const selectedId = ref<string | null>(null)
// Wrong picks stay marked (with their feedback) so the learner never re-tries the same one. A
// restored result brings its picks back, so a revisit shows what was tried.
const restoredAnswer = props.result?.answer
const triedIds = ref<string[]>(restoredAnswer && 'picks' in restoredAnswer ? [...restoredAnswer.picks] : [])

const resolved = computed(() => props.result !== null)
const correctId = computed(() => props.block.options.find(o => o.correct)!.id)
const lastTried = computed(() => props.block.options.find(o => o.id === triedIds.value.at(-1)))
// Offered after two misses so a stuck learner isn't trapped behind one question.
const canGiveUp = computed(() => !resolved.value && triedIds.value.length >= 2)

function check() {
  if (!selectedId.value) return
  triedIds.value.push(selectedId.value)
  if (selectedId.value === correctId.value) {
    emit('resolved', { correct: true, attempts: triedIds.value.length, answer: { picks: [...triedIds.value] } })
  }
  selectedId.value = null
}

function showAnswer() {
  emit('resolved', { correct: false, attempts: triedIds.value.length, answer: { picks: [...triedIds.value] } })
}

function optionState(id: string): 'correct' | 'wrong' | 'selected' | 'idle' {
  if (resolved.value && id === correctId.value) return 'correct'
  if (triedIds.value.includes(id) && id !== correctId.value) return 'wrong'
  if (id === selectedId.value) return 'selected'
  return 'idle'
}
</script>

<template>
  <fieldset class="m-0 border-0 p-0">
    <legend class="mb-3 p-0 text-[15px] font-semibold text-(--fg-1)">{{ block.prompt }}</legend>

    <div role="radiogroup" class="flex flex-col gap-2">
      <button
        v-for="option in block.options"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="selectedId === option.id"
        :disabled="resolved || triedIds.includes(option.id)"
        :class="[
          'flex w-full items-center gap-3 rounded-(--ra-md) border px-3.5 py-3 text-left text-sm transition-colors',
          'disabled:cursor-default enabled:cursor-pointer enabled:hover:border-(--brand-blue)',
          {
            'border-(--success) bg-(--success-soft) text-(--fg-1)': optionState(option.id) === 'correct',
            'border-(--danger) bg-(--danger-soft) text-(--fg-2)': optionState(option.id) === 'wrong',
            'border-(--brand-blue) bg-[rgba(59,130,246,0.08)] text-(--fg-1)': optionState(option.id) === 'selected',
            'border-(--line-2) bg-(--bg-2) text-(--fg-2)': optionState(option.id) === 'idle',
          },
        ]"
        @click="selectedId = option.id"
      >
        <span class="flex size-5 shrink-0 items-center justify-center rounded-full border border-current">
          <Check v-if="optionState(option.id) === 'correct'" :size="12" />
          <X v-else-if="optionState(option.id) === 'wrong'" :size="12" />
          <span v-else-if="optionState(option.id) === 'selected'" class="size-2 rounded-full bg-current" />
        </span>
        {{ option.text }}
      </button>
    </div>

    <p v-if="!resolved && lastTried?.feedback" class="mt-3 mb-0 text-[13px] text-(--danger)" aria-live="polite">
      {{ lastTried.feedback }}
    </p>

    <div v-if="!resolved" class="mt-4 flex items-center gap-2">
      <RaButton :disabled="!selectedId" @click="check">Check</RaButton>
      <RaButton v-if="canGiveUp" variant="ghost" @click="showAnswer">Show answer</RaButton>
    </div>

    <div v-else class="mt-4 rounded-(--ra-md) bg-(--bg-3) px-3.5 py-3 text-[13px] text-(--fg-2)" aria-live="polite">
      <div class="mb-1 font-semibold" :class="result!.correct ? 'text-(--success)' : 'text-(--fg-1)'">
        {{ result!.correct ? (result!.attempts === 1 ? 'Correct!' : 'Got it.') : 'Here\'s the answer.' }}
      </div>
      <div
        v-if="block.explanation"
        class="rich-text leading-[1.6]"
        v-html="renderRichText(block.explanation)"
      />
    </div>
  </fieldset>
</template>
