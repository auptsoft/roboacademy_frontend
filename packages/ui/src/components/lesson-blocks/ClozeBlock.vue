<script setup lang="ts">
import { computed, ref } from 'vue'
import RaButton from '../ui/RaButton.vue'
import { renderRichText } from '../../lib/rich-text'
import { seededShuffle } from './shuffle'
import { parseCloze, type BlockResult, type ClozeBlock } from './types'

// Fill in the blanks, by tapping word-bank tiles or by typing. Code mode keeps the text
// monospaced and compares without spaces, so `pinMode(13,OUTPUT)` and `pinMode(13, OUTPUT)` match.
const props = defineProps<{ block: ClozeBlock; result: BlockResult | null }>()
const emit = defineEmits<{ resolved: [result: BlockResult] }>()

const segments = computed(() => parseCloze(props.block.text))
const blanks = computed(() => segments.value.flatMap(s => (s.kind === 'blank' ? [s] : [])))
const isCode = computed(() => props.block.mode === 'code')

// A restored correct result brings back what was written; otherwise (including "Show answer",
// whose saved answer is the wrong tries) blanks show the right answers once resolved.
const restored = props.result?.answer
const values = ref<string[]>(
  props.result?.correct && restored && 'filled' in restored ? [...restored.filled]
    : props.result ? blanks.value.map(b => b.answers[0]!)
    : blanks.value.map(() => ''))
const wrong = ref<number[]>([])
const attempts = ref(0)
const focused = ref(0)

const resolved = computed(() => props.result !== null)
const canGiveUp = computed(() => !resolved.value && attempts.value >= 2)
const allFilled = computed(() => values.value.every(v => v.trim()))

// Word bank: one tile per blank (its main answer) plus the author's distractors.
const tiles = computed(() => seededShuffle(
  [...blanks.value.map(b => b.answers[0]!), ...(props.block.distractors ?? []).filter(Boolean)].map((text, i) => ({ id: i, text })),
  props.block.id,
))
// Which tile fills which blank, so a used tile leaves the bank and comes back when removed.
const tileFor = ref<(number | null)[]>(blanks.value.map(() => null))
const usedTiles = computed(() => new Set(tileFor.value.filter((t): t is number => t !== null)))

function normalise(value: string): string {
  return isCode.value ? value.replace(/\s+/g, '') : value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function isRight(index: number): boolean {
  return blanks.value[index]!.answers.some(a => normalise(a) === normalise(values.value[index] ?? ''))
}

function place(tileId: number, text: string) {
  const target = values.value[focused.value] ? values.value.findIndex(v => !v) : focused.value
  if (target === -1) return
  values.value[target] = text
  tileFor.value[target] = tileId
  wrong.value = wrong.value.filter(i => i !== target)
  const next = values.value.findIndex(v => !v)
  focused.value = next === -1 ? target : next
}

function clearBlank(index: number) {
  if (resolved.value) return
  values.value[index] = ''
  tileFor.value[index] = null
  focused.value = index
}

function onType(index: number, value: string) {
  values.value[index] = value
  wrong.value = wrong.value.filter(i => i !== index)
}

function check() {
  attempts.value++
  wrong.value = blanks.value.map((_, i) => i).filter(i => !isRight(i))
  if (!wrong.value.length) emit('resolved', { correct: true, attempts: attempts.value, answer: { filled: [...values.value] } })
}

function showAnswer() {
  const tried = [...values.value]
  values.value = blanks.value.map(b => b.answers[0]!)
  wrong.value = []
  emit('resolved', { correct: false, attempts: attempts.value, answer: { filled: tried } })
}

function blankWidth(index: number): string {
  const longest = Math.max(...blanks.value[index]!.answers.map(a => a.length), values.value[index]?.length ?? 0, 3)
  return `${Math.min(longest + 2, 30)}ch`
}
</script>

<template>
  <div>
    <div v-if="block.prompt" class="mb-3 text-[15px] font-semibold text-(--fg-1)">{{ block.prompt }}</div>

    <div
      :class="isCode
        ? 'overflow-x-auto rounded-(--ra-md) bg-(--bg-3) p-3 font-mono text-[13px] leading-[2.2] whitespace-pre text-(--fg-1)'
        : 'text-[15px] leading-[2.2] text-(--fg-1)'"
    ><template v-for="(segment, i) in segments" :key="i"><template v-if="segment.kind === 'text'">{{ segment.value }}</template><input
      v-else-if="block.input === 'typed' && !resolved"
      :value="values[segment.index]"
      :style="{ width: blankWidth(segment.index) }"
      :aria-label="`Blank ${segment.index + 1}`"
      :aria-invalid="wrong.includes(segment.index)"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      class="mx-0.5 inline-block h-8 rounded-(--ra-sm) border bg-(--bg-2) px-1.5 text-center align-middle font-[inherit] text-[inherit] text-(--fg-1) outline-none focus:border-(--brand-blue)"
      :class="wrong.includes(segment.index) ? 'border-(--danger)' : 'border-(--line-2)'"
      @input="onType(segment.index, ($event.target as HTMLInputElement).value)"
      @keydown.enter="allFilled && check()"
    ><button
      v-else
      type="button"
      :disabled="resolved"
      :aria-label="values[segment.index] ? `Blank ${segment.index + 1}: ${values[segment.index]}. Tap to remove.` : `Blank ${segment.index + 1}, empty`"
      class="mx-0.5 inline-flex h-8 min-w-12 items-center justify-center rounded-(--ra-sm) border px-2 align-middle font-[inherit] text-[inherit]"
      :class="[
        resolved ? 'border-(--success) bg-(--success-soft) text-(--fg-1)'
          : wrong.includes(segment.index) ? 'border-(--danger) bg-(--danger-soft) text-(--fg-1) cursor-pointer'
          : values[segment.index] ? 'border-(--line-2) bg-(--bg-2) text-(--fg-1) cursor-pointer'
          : focused === segment.index ? 'border-dashed border-(--brand-blue) bg-transparent cursor-pointer' : 'border-dashed border-(--line-3) bg-transparent cursor-pointer',
      ]"
      @click="values[segment.index] ? clearBlank(segment.index) : (focused = segment.index)"
    >{{ values[segment.index] || ' ' }}</button></template></div>

    <div v-if="block.input === 'bank' && !resolved" class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Word bank">
      <button
        v-for="tile in tiles"
        :key="tile.id"
        type="button"
        :disabled="usedTiles.has(tile.id)"
        class="h-9 cursor-pointer rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3 text-sm text-(--fg-1) hover:border-(--brand-blue) disabled:cursor-default disabled:opacity-30"
        :class="isCode && 'font-mono text-[13px]'"
        @click="place(tile.id, tile.text)"
      >
        {{ tile.text }}
      </button>
    </div>

    <p v-if="!resolved && wrong.length" class="mt-3 mb-0 text-[13px] text-(--danger)" aria-live="polite">
      {{ blanks.length - wrong.length }} of {{ blanks.length }} right. Try again.
    </p>

    <div v-if="!resolved" class="mt-4 flex items-center gap-2">
      <RaButton :disabled="!allFilled" @click="check">Check</RaButton>
      <RaButton v-if="canGiveUp" variant="ghost" @click="showAnswer">Show answer</RaButton>
    </div>
    <div v-else class="mt-4 rounded-(--ra-md) bg-(--bg-3) px-3.5 py-3 text-[13px] text-(--fg-2)" aria-live="polite">
      <div class="mb-1 font-semibold" :class="result!.correct ? 'text-(--success)' : 'text-(--fg-1)'">
        {{ result!.correct ? 'All correct!' : "Here's the answer." }}
      </div>
      <div v-if="block.explanation" class="rich-text leading-[1.6]" v-html="renderRichText(block.explanation)" />
    </div>
  </div>
</template>
