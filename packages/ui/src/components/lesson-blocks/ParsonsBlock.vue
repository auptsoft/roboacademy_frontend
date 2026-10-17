<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import RaButton from '../ui/RaButton.vue'
import { renderRichText } from '../../lib/rich-text'
import { seededShuffle } from './shuffle'
import type { BlockResult, ParsonsBlock } from './types'

// Build a program from its lines: tap a line in the pool to add it, tap it again in the program to
// send it back, and use the arrows to reorder. Indentation is part of each line, so it shows as
// authored. Distractor lines don't belong anywhere.
const props = defineProps<{ block: ParsonsBlock; result: BlockResult | null }>()
const emit = defineEmits<{ resolved: [result: BlockResult] }>()

type Line = { id: string; text: string }

const allLines = computed<Line[]>(() => [...props.block.lines, ...(props.block.distractors ?? [])])
const pool = computed(() => seededShuffle(allLines.value, props.block.id).filter(l => !program.value.includes(l.id)))
const program = ref<string[]>(props.result ? props.block.lines.map(l => l.id) : [])
const wrong = ref<string[]>([])
const attempts = ref(0)

const resolved = computed(() => props.result !== null)
const canGiveUp = computed(() => !resolved.value && attempts.value >= 2)
const lineById = computed(() => new Map(allLines.value.map(l => [l.id, l])))

function add(id: string) {
  program.value = [...program.value, id]
  wrong.value = []
}

function remove(id: string) {
  if (resolved.value) return
  program.value = program.value.filter(l => l !== id)
  wrong.value = []
}

function move(index: number, delta: -1 | 1) {
  const next = [...program.value]
  const target = index + delta
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  program.value = next
  wrong.value = []
}

function check() {
  attempts.value++
  // A line is wrong if it's a distractor or not in its place.
  wrong.value = program.value.filter((id, i) => props.block.lines[i]?.id !== id)
  const complete = program.value.length === props.block.lines.length
  if (complete && !wrong.value.length) emit('resolved', { correct: true, attempts: attempts.value })
}

function showAnswer() {
  program.value = props.block.lines.map(l => l.id)
  wrong.value = []
  emit('resolved', { correct: false, attempts: attempts.value })
}

const missing = computed(() => !wrong.value.length && attempts.value > 0 && !resolved.value
  && program.value.length < props.block.lines.length)
</script>

<template>
  <div>
    <div class="rich-text mb-3 text-[15px] font-semibold text-(--fg-1)" v-html="renderRichText(block.prompt)" />

    <span class="text-xs text-(--fg-3)">Your program</span>
    <ol
      class="m-0 mt-1 flex min-h-14 list-none flex-col gap-1 rounded-(--ra-md) border border-dashed p-2"
      :class="resolved ? 'border-(--success)' : 'border-(--line-2)'"
      aria-label="Your program"
    >
      <li v-if="!program.length" class="px-1 py-2 text-xs text-(--fg-4)">Tap lines below to build the program.</li>
      <li v-for="(id, index) in program" :key="id" class="flex items-center gap-1">
        <button
          type="button"
          :disabled="resolved"
          :title="resolved ? undefined : 'Tap to remove'"
          class="min-w-0 flex-1 overflow-x-auto rounded-(--ra-sm) border px-2.5 py-1.5 text-left font-mono text-[13px] whitespace-pre"
          :class="resolved ? 'border-(--success) bg-(--success-soft) text-(--fg-1)'
            : wrong.includes(id) ? 'border-(--danger) bg-(--danger-soft) text-(--fg-1) cursor-pointer'
            : 'border-(--line-2) bg-(--bg-2) text-(--fg-1) cursor-pointer'"
          @click="remove(id)"
        >{{ lineById.get(id)?.text }}</button>
        <template v-if="!resolved">
          <button type="button" class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-(--ra-sm) border border-(--line-2) bg-(--bg-3) text-(--fg-2) disabled:cursor-default disabled:opacity-30" :disabled="index === 0" :aria-label="`Move line ${index + 1} up`" @click="move(index, -1)"><ArrowUp :size="14" /></button>
          <button type="button" class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-(--ra-sm) border border-(--line-2) bg-(--bg-3) text-(--fg-2) disabled:cursor-default disabled:opacity-30" :disabled="index === program.length - 1" :aria-label="`Move line ${index + 1} down`" @click="move(index, 1)"><ArrowDown :size="14" /></button>
        </template>
      </li>
    </ol>

    <template v-if="!resolved">
      <span class="mt-3 block text-xs text-(--fg-3)">Lines{{ block.distractors?.length ? " (not all of them are needed)" : '' }}</span>
      <div class="mt-1 flex flex-col gap-1" role="group" aria-label="Lines to choose from">
        <button
          v-for="line in pool"
          :key="line.id"
          type="button"
          class="cursor-pointer overflow-x-auto rounded-(--ra-sm) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.5 text-left font-mono text-[13px] whitespace-pre text-(--fg-1) hover:border-(--brand-blue)"
          @click="add(line.id)"
        >{{ line.text }}</button>
        <p v-if="!pool.length" class="m-0 text-xs text-(--fg-4)">All lines used.</p>
      </div>
    </template>

    <p v-if="!resolved && wrong.length" class="mt-3 mb-0 text-[13px] text-(--danger)" aria-live="polite">
      The highlighted lines are in the wrong place, or don't belong. Try again.
    </p>
    <p v-else-if="missing" class="mt-3 mb-0 text-[13px] text-(--danger)" aria-live="polite">So far so good, but some lines are missing.</p>

    <div v-if="!resolved" class="mt-4 flex items-center gap-2">
      <RaButton :disabled="!program.length" @click="check">Check program</RaButton>
      <RaButton v-if="canGiveUp" variant="ghost" @click="showAnswer">Show answer</RaButton>
    </div>
    <div v-else class="mt-4 rounded-(--ra-md) bg-(--bg-3) px-3.5 py-3 text-[13px] text-(--fg-2)" aria-live="polite">
      <div class="mb-1 font-semibold" :class="result!.correct ? 'text-(--success)' : 'text-(--fg-1)'">
        {{ result!.correct ? 'Your program is right!' : "Here's the working program." }}
      </div>
      <div v-if="block.explanation" class="rich-text leading-[1.6]" v-html="renderRichText(block.explanation)" />
    </div>
  </div>
</template>
