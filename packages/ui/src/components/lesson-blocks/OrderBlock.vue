<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import RaButton from '../ui/RaButton.vue'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-vue-next'
import { renderRichText } from '../../lib/rich-text'
import type { BlockResult, OrderBlock } from './types'

const props = defineProps<{ block: OrderBlock; result: BlockResult | null }>()
const emit = defineEmits<{ resolved: [result: BlockResult] }>()

type Item = OrderBlock['items'][number]

// Drag to reorder, with up/down buttons alongside: the buttons work the same with keyboard and
// screen readers. Dragging is plain pointer events, so it needs no library on low-spec devices.
const order = ref<Item[]>(props.result ? [...props.block.items] : shuffle(props.block.items, props.block.id))
const attempts = ref(0)
const misplaced = ref<string[]>([])

const resolved = computed(() => props.result !== null)
const canGiveUp = computed(() => !resolved.value && attempts.value >= 2)

function move(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= order.value.length) return
  const next = [...order.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  order.value = next
  misplaced.value = []
}

// ── Dragging ──────────────────────────────────────────────────────────────────
// The dragged row follows the pointer; once it passes halfway over a neighbour the two swap in
// `order`, and the neighbour slides into the vacated slot.

// The list holds the pointer capture, not the row: reordering moves the row's DOM node, and
// moving a node releases any capture it holds.
const list = ref<HTMLElement | null>(null)
const rows = new Map<string, HTMLElement>()
const dragId = ref<string | null>(null)
const dragOffset = ref(0)
let dragStartY = 0
let swapping = false

function setRow(id: string, el: unknown) {
  if (el instanceof HTMLElement) rows.set(id, el)
  else rows.delete(id)
}

function onPointerDown(event: PointerEvent, item: Item) {
  if (resolved.value || event.button !== 0) return
  const target = event.target as HTMLElement
  // A touch anywhere but the grip scrolls the page as usual; the arrow buttons keep their clicks.
  if (event.pointerType !== 'mouse' && !target.closest('[data-drag-handle]')) return
  if (target.closest('button:not([data-drag-handle])')) return
  event.preventDefault()
  list.value?.setPointerCapture(event.pointerId)
  dragId.value = item.id
  dragStartY = event.clientY
  dragOffset.value = 0
}

function onPointerMove(event: PointerEvent) {
  if (!dragId.value) return
  dragOffset.value = event.clientY - dragStartY
  if (swapping) return
  const index = order.value.findIndex(item => item.id === dragId.value)
  const current = rows.get(dragId.value)
  if (!current) return
  const below = order.value[index + 1] && rows.get(order.value[index + 1]!.id)
  const above = order.value[index - 1] && rows.get(order.value[index - 1]!.id)
  // How far the dragged row's slot moves when it trades places (offsetTop ignores transforms).
  if (below) {
    const shift = below.offsetTop + below.offsetHeight - (current.offsetTop + current.offsetHeight)
    if (dragOffset.value > shift / 2) return void swap(index, 1, below, shift)
  }
  if (above) {
    const shift = above.offsetTop - current.offsetTop
    if (dragOffset.value < shift / 2) return void swap(index, -1, above, shift)
  }
}

async function swap(index: number, delta: -1 | 1, neighbour: HTMLElement, shift: number) {
  swapping = true
  const before = neighbour.offsetTop
  move(index, delta)
  // The slot moved by `shift`, so keep the row under the pointer by moving the origin with it.
  dragStartY += shift
  dragOffset.value -= shift
  await nextTick()
  slideFrom(neighbour, before - neighbour.offsetTop)
  swapping = false
}

function onPointerUp() {
  if (!dragId.value) return
  const el = rows.get(dragId.value)
  const offset = dragOffset.value
  dragId.value = null
  dragOffset.value = 0
  if (el) void nextTick(() => slideFrom(el, offset))
}

/** Animate an element from `dy` pixels away back to where it now sits. */
function slideFrom(el: HTMLElement, dy: number) {
  if (!dy) return
  el.style.transition = 'none'
  el.style.transform = `translateY(${dy}px)`
  void el.offsetHeight // commit the start position before transitioning from it
  el.style.transition = 'transform var(--dur-2) var(--ease-out)'
  el.style.transform = ''
}

function check() {
  attempts.value++
  misplaced.value = order.value.filter((item, i) => item.id !== props.block.items[i]!.id).map(item => item.id)
  if (!misplaced.value.length) emit('resolved', { correct: true, attempts: attempts.value })
}

function showAnswer() {
  order.value = [...props.block.items]
  misplaced.value = []
  emit('resolved', { correct: false, attempts: attempts.value })
}

// Seeded by block id so the starting order is stable across reloads, and never already solved.
function shuffle(items: Item[], seed: string): Item[] {
  let state = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const random = () => (state = (state * 1103515245 + 12345) >>> 0) / 2 ** 32
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  if (result.every((item, i) => item.id === items[i]!.id)) result.push(result.shift()!)
  return result
}
</script>

<template>
  <div>
    <p class="mt-0 mb-3 text-[15px] font-semibold text-(--fg-1)">{{ block.prompt }}</p>

    <ol
      ref="list"
      class="m-0 flex list-none flex-col gap-2 p-0"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @lostpointercapture="onPointerUp"
    >
      <li
        v-for="(item, index) in order"
        :key="item.id"
        :ref="(el) => setRow(item.id, el)"
        :style="dragId === item.id ? { transform: `translateY(${dragOffset}px)`, transition: 'none' } : undefined"
        :class="[
          'relative flex items-center gap-3 rounded-(--ra-md) border px-3.5 py-2.5 text-sm select-none',
          !resolved && (dragId === item.id ? 'z-10 cursor-grabbing shadow-(--elev-3)' : 'cursor-grab'),
          resolved
            ? 'border-(--success) bg-(--success-soft) text-(--fg-1)'
            : misplaced.includes(item.id)
              ? 'border-(--danger) bg-(--danger-soft) text-(--fg-2)'
              : 'border-(--line-2) bg-(--bg-2) text-(--fg-2)',
        ]"
        @pointerdown="onPointerDown($event, item)"
      >
        <span
          v-if="!resolved"
          data-drag-handle
          class="-ml-1.5 flex h-8 w-6 shrink-0 touch-none items-center justify-center text-(--fg-4)"
          aria-hidden="true"
        >
          <GripVertical :size="16" />
        </span>
        <span class="w-5 shrink-0 text-center text-xs font-semibold text-(--fg-3)">{{ index + 1 }}</span>
        <span class="flex-1">{{ item.text }}</span>
        <span v-if="!resolved" class="flex gap-1">
          <button
            type="button"
            class="flex size-8 cursor-pointer items-center justify-center rounded-(--ra-sm) border border-(--line-2) bg-(--bg-3) text-(--fg-2) hover:text-(--fg-1) disabled:cursor-default disabled:opacity-30"
            :disabled="index === 0"
            :aria-label="`Move ${item.text} up`"
            @click="move(index, -1)"
          >
            <ArrowUp :size="14" />
          </button>
          <button
            type="button"
            class="flex size-8 cursor-pointer items-center justify-center rounded-(--ra-sm) border border-(--line-2) bg-(--bg-3) text-(--fg-2) hover:text-(--fg-1) disabled:cursor-default disabled:opacity-30"
            :disabled="index === order.length - 1"
            :aria-label="`Move ${item.text} down`"
            @click="move(index, 1)"
          >
            <ArrowDown :size="14" />
          </button>
        </span>
      </li>
    </ol>

    <p v-if="!resolved && misplaced.length" class="mt-3 mb-0 text-[13px] text-(--danger)" aria-live="polite">
      {{ order.length - misplaced.length }} of {{ order.length }} in the right place. Try again.
    </p>

    <div v-if="!resolved" class="mt-4 flex items-center gap-2">
      <RaButton @click="check">Check order</RaButton>
      <RaButton v-if="canGiveUp" variant="ghost" @click="showAnswer">Show answer</RaButton>
    </div>

    <div v-else class="mt-4 rounded-(--ra-md) bg-(--bg-3) px-3.5 py-3 text-[13px] text-(--fg-2)" aria-live="polite">
      <div class="mb-1 font-semibold" :class="result!.correct ? 'text-(--success)' : 'text-(--fg-1)'">
        {{ result!.correct ? 'Correct order!' : 'Here\'s the correct order.' }}
      </div>
      <div v-if="block.explanation" class="rich-text leading-[1.6]" v-html="renderRichText(block.explanation)" />
    </div>
  </div>
</template>
