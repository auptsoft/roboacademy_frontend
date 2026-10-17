<script setup lang="ts">
import { computed, ref } from 'vue'
import RaButton from '../ui/RaButton.vue'
import { renderRichText } from '../../lib/rich-text'
import type { BlockResult, NumberBlock } from './types'

// A calculated answer, right within the author's ± margin. Accepts a comma as the decimal mark.
const props = defineProps<{ block: NumberBlock; result: BlockResult | null }>()
const emit = defineEmits<{ resolved: [result: BlockResult] }>()

const input = ref('')
const tries = ref<number[]>([])
const message = ref('')

const resolved = computed(() => props.result !== null)
const canGiveUp = computed(() => !resolved.value && tries.value.length >= 2)
const answerText = computed(() => {
  const unit = props.block.unit ? ` ${props.block.unit}` : ''
  return props.block.tolerance ? `${props.block.answer}${unit} (± ${props.block.tolerance})` : `${props.block.answer}${unit}`
})

function parse(value: string): number | null {
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!cleaned) return null
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

function check() {
  const value = parse(input.value)
  if (value === null) {
    message.value = 'Enter a number, like 20 or 0.5.'
    return
  }
  tries.value = [...tries.value, value]
  // A tiny relative slack, so 0.1 + 0.2-style rounding in a learner's calculator never fails them.
  const slack = (props.block.tolerance ?? 0) + 1e-9 * Math.max(1, Math.abs(props.block.answer))
  if (Math.abs(value - props.block.answer) <= slack) {
    message.value = ''
    emit('resolved', { correct: true, attempts: tries.value.length, answer: { values: tries.value } })
  } else {
    message.value = 'Not quite. Check your working and try again.'
  }
}

function showAnswer() {
  message.value = ''
  emit('resolved', { correct: false, attempts: tries.value.length, answer: { values: tries.value } })
}
</script>

<template>
  <div>
    <div class="rich-text mb-3 text-[15px] font-semibold text-(--fg-1)" v-html="renderRichText(block.prompt)" />

    <div v-if="!resolved" class="flex items-center gap-2">
      <input
        v-model="input"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        :aria-label="block.unit ? `Your answer, in ${block.unit}` : 'Your answer'"
        :aria-invalid="!!message"
        class="h-10 w-40 rounded-(--ra-md) border bg-(--bg-2) px-3 text-[15px] text-(--fg-1) outline-none focus:border-(--brand-blue)"
        :class="message ? 'border-(--danger)' : 'border-(--line-2)'"
        @input="message = ''"
        @keydown.enter="check"
      >
      <span v-if="block.unit" class="text-sm text-(--fg-2)">{{ block.unit }}</span>
    </div>
    <p v-if="message" class="mt-2 mb-0 text-[13px] text-(--danger)" aria-live="polite">{{ message }}</p>
    <p v-if="!resolved && tries.length" class="mt-1 mb-0 text-xs text-(--fg-3)">You tried: {{ tries.join(', ') }}</p>

    <div v-if="!resolved" class="mt-4 flex items-center gap-2">
      <RaButton :disabled="!input.trim()" @click="check">Check</RaButton>
      <RaButton v-if="canGiveUp" variant="ghost" @click="showAnswer">Show answer</RaButton>
    </div>
    <div v-else class="rounded-(--ra-md) bg-(--bg-3) px-3.5 py-3 text-[13px] text-(--fg-2)" aria-live="polite">
      <div class="mb-1 font-semibold" :class="result!.correct ? 'text-(--success)' : 'text-(--fg-1)'">
        {{ result!.correct ? 'Correct!' : 'The answer is' }} {{ answerText }}
      </div>
      <div v-if="block.explanation" class="rich-text leading-[1.6]" v-html="renderRichText(block.explanation)" />
    </div>
  </div>
</template>
