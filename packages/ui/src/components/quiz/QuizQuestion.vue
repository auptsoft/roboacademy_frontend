<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, X } from 'lucide-vue-next'
import { renderRichText } from '../../lib/rich-text'
import type {
  QuizCloze, QuizDefinition, QuizLabelDiagram, QuizMatch, QuizNumber, QuizOrder, QuizParsons, QuizQuestionKind, QuizResponse,
} from './types'

/**
 * One quiz question in assessment mode, for the kinds beyond multiple choice: put in order, fill
 * in the blanks, match the pairs, number answer. Collects a response (v-model) and nothing else -
 * no right/wrong, no retries; the server grades the submitted quiz.
 */
const props = defineProps<{ kind: Exclude<QuizQuestionKind, 'choice'>; definition: QuizDefinition; disabled?: boolean }>()
const response = defineModel<QuizResponse>({ required: true })

const order = computed(() => props.definition as QuizOrder)
const cloze = computed(() => props.definition as QuizCloze)
const match = computed(() => props.definition as QuizMatch)
const number = computed(() => props.definition as QuizNumber)
const parsons = computed(() => props.definition as QuizParsons)
const diagram = computed(() => props.definition as QuizLabelDiagram)

// Order: starts as given (already shuffled by the server), so it always has an answer.
if (props.kind === 'order' && !Array.isArray(response.value)) response.value = order.value.items.map(i => i.id)
const orderedItems = computed(() => {
  const byId = new Map(order.value.items.map(i => [i.id, i]))
  return ((response.value as string[]) ?? []).map(id => byId.get(id)).filter((i): i is { id: string; text: string } => !!i)
})

function moveItem(index: number, delta: -1 | 1) {
  const next = [...(response.value as string[])]
  const target = index + delta
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  response.value = next
}

// Cloze: one string per blank. With a word bank, each tile fills one blank at a time.
// Only a cloze has segments; every other kind has no blanks (this runs at setup for all kinds).
const blankCount = computed(() =>
  props.kind === 'cloze' ? (cloze.value.segments ?? []).filter(s => 'blank' in s).length : 0)
if (props.kind === 'cloze' && !Array.isArray(response.value)) response.value = Array.from({ length: blankCount.value }, () => '')
const blanks = computed(() => (response.value as string[]) ?? [])
const tileFor = ref<(number | null)[]>(Array.from({ length: blankCount.value }, () => null))
const focusedBlank = ref(0)

function setBlank(index: number, value: string) {
  const next = [...blanks.value]
  next[index] = value
  response.value = next
}

function placeTile(tileIndex: number) {
  const target = blanks.value[focusedBlank.value] ? blanks.value.findIndex(v => !v) : focusedBlank.value
  if (target === -1) return
  setBlank(target, cloze.value.bank![tileIndex]!)
  tileFor.value[target] = tileIndex
  const next = blanks.value.findIndex(v => !v)
  focusedBlank.value = next === -1 ? target : next
}

function clearBlank(index: number) {
  setBlank(index, '')
  tileFor.value[index] = null
  focusedBlank.value = index
}

// Match: tap a left item, then a right one, to pair them. Tap a pair to undo it.
if (props.kind === 'match' && !Array.isArray(response.value)) response.value = []
const pairs = computed(() => (response.value as { left: string; right: string }[]) ?? [])
const selectedLeft = ref<string | null>(null)
const pairedRight = computed(() => new Set(pairs.value.map(p => p.right)))
const pairedLeft = computed(() => new Set(pairs.value.map(p => p.left)))

function pickRight(rightId: string) {
  if (!selectedLeft.value || pairedRight.value.has(rightId)) return
  response.value = [...pairs.value, { left: selectedLeft.value, right: rightId }]
  selectedLeft.value = null
}

function unpair(leftId: string) {
  response.value = pairs.value.filter(p => p.left !== leftId)
}

function textOf(list: { id: string; text: string }[], id: string): string {
  return list.find(i => i.id === id)?.text ?? ''
}

// Code builder: the program is line ids in order. Tap a line in the pool to add it, tap it in
// the program to send it back, arrows to reorder. Some pool lines may not belong at all.
if (props.kind === 'parsons' && !Array.isArray(response.value)) response.value = []
const program = computed(() => (response.value as string[]) ?? [])
const lineText = computed(() => new Map(parsons.value.lines.map(l => [l.id, l.text])))
const pool = computed(() => parsons.value.lines.filter(l => !program.value.includes(l.id)))

function moveLine(index: number, delta: -1 | 1) {
  const next = [...program.value]
  const target = index + delta
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  response.value = next
}

// Label the diagram: one label per marker, chosen from a list (works with touch, keyboard and
// screen readers). Only complete placements are sent.
if (props.kind === 'label-diagram' && !Array.isArray(response.value)) response.value = []
const placements = computed(() => (response.value as { marker: string; label: string }[]) ?? [])

function placeLabel(markerId: string, labelId: string) {
  const rest = placements.value.filter(p => p.marker !== markerId)
  response.value = labelId ? [...rest, { marker: markerId, label: labelId }] : rest
}

// Number: kept as typed; the server reads "0,5" as 0.5.
if (props.kind === 'number' && typeof response.value !== 'string') response.value = ''

watch(() => props.definition, () => (selectedLeft.value = null))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="definition.prompt" class="rich-text text-sm font-semibold text-(--fg-1)" v-html="renderRichText(definition.prompt)" />

    <!-- Put in order -->
    <ol v-if="kind === 'order'" class="m-0 flex list-none flex-col gap-1.5 p-0">
      <li v-for="(item, index) in orderedItems" :key="item.id" class="flex items-center gap-2 rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3 py-2 text-[13px] text-(--fg-1)">
        <span class="w-5 shrink-0 text-center text-xs font-semibold text-(--fg-3)">{{ index + 1 }}</span>
        <span class="flex-1">{{ item.text }}</span>
        <button type="button" class="flex size-7 cursor-pointer items-center justify-center rounded-(--ra-sm) border border-(--line-2) bg-(--bg-3) text-(--fg-2) disabled:cursor-default disabled:opacity-30" :disabled="disabled || index === 0" :aria-label="`Move ${item.text} up`" @click="moveItem(index, -1)"><ArrowUp :size="13" /></button>
        <button type="button" class="flex size-7 cursor-pointer items-center justify-center rounded-(--ra-sm) border border-(--line-2) bg-(--bg-3) text-(--fg-2) disabled:cursor-default disabled:opacity-30" :disabled="disabled || index === orderedItems.length - 1" :aria-label="`Move ${item.text} down`" @click="moveItem(index, 1)"><ArrowDown :size="13" /></button>
      </li>
    </ol>

    <!-- Fill in the blanks -->
    <template v-else-if="kind === 'cloze'">
      <div
        :class="cloze.mode === 'code'
          ? 'overflow-x-auto rounded-(--ra-md) bg-(--bg-3) p-3 font-mono text-[13px] leading-[2.2] whitespace-pre text-(--fg-1)'
          : 'text-sm leading-[2.2] text-(--fg-1)'"
      ><template v-for="(segment, i) in cloze.segments" :key="i"><template v-if="'text' in segment">{{ segment.text }}</template><input
        v-else-if="cloze.input === 'typed'"
        :value="blanks[segment.blank]"
        :disabled="disabled"
        :aria-label="`Blank ${segment.blank + 1}`"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        class="mx-0.5 inline-block h-8 w-28 rounded-(--ra-sm) border border-(--line-2) bg-(--bg-2) px-1.5 text-center align-middle font-[inherit] text-[inherit] text-(--fg-1) outline-none focus:border-(--brand-blue)"
        @input="setBlank(segment.blank, ($event.target as HTMLInputElement).value)"
      ><button
        v-else
        type="button"
        :disabled="disabled"
        :aria-label="blanks[segment.blank] ? `Blank ${segment.blank + 1}: ${blanks[segment.blank]}. Tap to remove.` : `Blank ${segment.blank + 1}, empty`"
        class="mx-0.5 inline-flex h-8 min-w-12 cursor-pointer items-center justify-center rounded-(--ra-sm) border px-2 align-middle font-[inherit] text-[inherit]"
        :class="blanks[segment.blank] ? 'border-(--line-2) bg-(--bg-2) text-(--fg-1)'
          : focusedBlank === segment.blank ? 'border-dashed border-(--brand-blue)' : 'border-dashed border-(--line-3)'"
        @click="blanks[segment.blank] ? clearBlank(segment.blank) : (focusedBlank = segment.blank)"
      >{{ blanks[segment.blank] || ' ' }}</button></template></div>
      <div v-if="cloze.input === 'bank' && cloze.bank" class="flex flex-wrap gap-2" role="group" aria-label="Word bank">
        <button
          v-for="(tile, t) in cloze.bank"
          :key="t"
          type="button"
          :disabled="disabled || tileFor.includes(t)"
          class="h-9 cursor-pointer rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3 text-[13px] text-(--fg-1) hover:border-(--brand-blue) disabled:cursor-default disabled:opacity-30"
          :class="cloze.mode === 'code' && 'font-mono'"
          @click="placeTile(t)"
        >
          {{ tile }}
        </button>
      </div>
    </template>

    <!-- Match the pairs -->
    <template v-else-if="kind === 'match'">
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1.5" role="group" aria-label="Left items">
          <button
            v-for="item in match.left"
            :key="item.id"
            type="button"
            :disabled="disabled || pairedLeft.has(item.id)"
            :aria-pressed="selectedLeft === item.id"
            class="min-h-10 cursor-pointer rounded-(--ra-md) border px-3 py-2 text-left text-[13px] disabled:cursor-default disabled:opacity-40"
            :class="selectedLeft === item.id ? 'border-(--brand-blue) bg-[rgba(59,130,246,0.08)] text-(--fg-1)' : 'border-(--line-2) bg-(--bg-2) text-(--fg-1)'"
            @click="selectedLeft = selectedLeft === item.id ? null : item.id"
          >
            {{ item.text }}
          </button>
        </div>
        <div class="flex flex-col gap-1.5" role="group" aria-label="Right items">
          <button
            v-for="item in match.right"
            :key="item.id"
            type="button"
            :disabled="disabled || pairedRight.has(item.id) || !selectedLeft"
            class="min-h-10 cursor-pointer rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3 py-2 text-left text-[13px] text-(--fg-1) disabled:cursor-default"
            :class="pairedRight.has(item.id) ? 'opacity-40' : ''"
            @click="pickRight(item.id)"
          >
            {{ item.text }}
          </button>
        </div>
      </div>
      <ul v-if="pairs.length" class="m-0 flex list-none flex-col gap-1 p-0" aria-label="Your pairs">
        <li v-for="pair in pairs" :key="pair.left" class="flex items-center gap-2 text-[13px] text-(--fg-2)">
          <span class="font-semibold text-(--fg-1)">{{ textOf(match.left, pair.left) }}</span> → {{ textOf(match.right, pair.right) }}
          <button v-if="!disabled" type="button" class="flex size-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-(--fg-3) hover:text-(--fg-1)" :aria-label="`Undo ${textOf(match.left, pair.left)}`" @click="unpair(pair.left)"><X :size="12" /></button>
        </li>
      </ul>
      <p v-else class="m-0 text-xs text-(--fg-3)">Tap an item on the left, then its match on the right.</p>
    </template>

    <!-- Code builder -->
    <template v-else-if="kind === 'parsons'">
      <span class="text-xs text-(--fg-3)">Your program</span>
      <ol class="m-0 flex min-h-12 list-none flex-col gap-1 rounded-(--ra-md) border border-dashed border-(--line-2) p-2" aria-label="Your program">
        <li v-if="!program.length" class="px-1 py-1.5 text-xs text-(--fg-4)">Tap lines below to build the program.</li>
        <li v-for="(id, index) in program" :key="id" class="flex items-center gap-1">
          <button
            type="button"
            :disabled="disabled"
            class="min-w-0 flex-1 cursor-pointer overflow-x-auto rounded-(--ra-sm) border border-(--line-2) bg-(--bg-2) px-2.5 py-1.5 text-left font-mono text-[13px] whitespace-pre text-(--fg-1)"
            title="Tap to remove"
            @click="response = program.filter(l => l !== id)"
          >{{ lineText.get(id) }}</button>
          <button type="button" class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-(--ra-sm) border border-(--line-2) bg-(--bg-3) text-(--fg-2) disabled:cursor-default disabled:opacity-30" :disabled="disabled || index === 0" :aria-label="`Move line ${index + 1} up`" @click="moveLine(index, -1)"><ArrowUp :size="13" /></button>
          <button type="button" class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-(--ra-sm) border border-(--line-2) bg-(--bg-3) text-(--fg-2) disabled:cursor-default disabled:opacity-30" :disabled="disabled || index === program.length - 1" :aria-label="`Move line ${index + 1} down`" @click="moveLine(index, 1)"><ArrowDown :size="13" /></button>
        </li>
      </ol>
      <span class="text-xs text-(--fg-3)">Lines (not all of them may be needed)</span>
      <div class="flex flex-col gap-1" role="group" aria-label="Lines to choose from">
        <button
          v-for="line in pool"
          :key="line.id"
          type="button"
          :disabled="disabled"
          class="cursor-pointer overflow-x-auto rounded-(--ra-sm) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.5 text-left font-mono text-[13px] whitespace-pre text-(--fg-1) hover:border-(--brand-blue)"
          @click="response = [...program, line.id]"
        >{{ line.text }}</button>
        <p v-if="!pool.length" class="m-0 text-xs text-(--fg-4)">All lines used.</p>
      </div>
    </template>

    <!-- Label the diagram -->
    <template v-else-if="kind === 'label-diagram'">
      <div class="relative overflow-hidden rounded-(--ra-md) border border-(--line-1) bg-(--bg-3)">
        <img
          v-if="diagram.image"
          :src="diagram.image"
          :srcset="diagram.imageSmall ? `${diagram.imageSmall} 800w, ${diagram.image} 1600w` : undefined"
          sizes="(max-width: 768px) 100vw, 720px"
          :alt="diagram.alt ?? ''"
          class="block h-auto w-full"
        >
        <div v-else class="aspect-video" role="img" :aria-label="diagram.alt ?? 'Diagram'" />
        <span
          v-for="(marker, index) in diagram.markers"
          :key="marker.id"
          class="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-(--brand-blue) text-xs font-bold text-white shadow"
          :style="{ left: `${marker.x}%`, top: `${marker.y}%` }"
          aria-hidden="true"
        >{{ index + 1 }}</span>
      </div>
      <ol class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="(marker, index) in diagram.markers" :key="marker.id" class="flex items-center gap-3 text-sm">
          <span class="w-6 shrink-0 text-center text-xs font-semibold text-(--fg-3)">{{ index + 1 }}</span>
          <select
            :value="placements.find(p => p.marker === marker.id)?.label ?? ''"
            :disabled="disabled"
            :aria-label="`Label for marker ${index + 1}`"
            class="h-9 min-w-0 flex-1 rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-2.5 text-sm text-(--fg-1) outline-none"
            @change="placeLabel(marker.id, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">Choose a label…</option>
            <option v-for="label in diagram.labels" :key="label.id" :value="label.id">{{ label.text }}</option>
          </select>
        </li>
      </ol>
    </template>

    <!-- Number answer -->
    <div v-else-if="kind === 'number'" class="flex items-center gap-2">
      <input
        :value="response as string"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        :disabled="disabled"
        :aria-label="number.unit ? `Your answer, in ${number.unit}` : 'Your answer'"
        class="h-10 w-40 rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3 text-sm text-(--fg-1) outline-none focus:border-(--brand-blue)"
        @input="response = ($event.target as HTMLInputElement).value"
      >
      <span v-if="number.unit" class="text-sm text-(--fg-2)">{{ number.unit }}</span>
    </div>
  </div>
</template>
