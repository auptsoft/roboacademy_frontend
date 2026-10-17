<script setup lang="ts">
import { computed, ref } from 'vue'
import RaButton from '../ui/RaButton.vue'
import { renderRichText } from '../../lib/rich-text'
import { seededShuffle } from './shuffle'
import type { BlockResult, MatchBlock } from './types'

// Tap an item on one side, then its partner on the other. A right pair locks in; a wrong one
// flashes and counts as a mistake. Both columns are shuffled (stably), so position gives nothing away.
const props = defineProps<{ block: MatchBlock; result: BlockResult | null }>()
const emit = defineEmits<{ resolved: [result: BlockResult] }>()

type Side = 'left' | 'right'

const left = computed(() => seededShuffle(props.block.pairs, `${props.block.id}-l`))
const right = computed(() => seededShuffle(props.block.pairs, `${props.block.id}-r`))
const matched = ref(new Set<string>(props.result ? props.block.pairs.map(p => p.id) : []))
const selected = ref<{ side: Side; id: string } | null>(null)
const flash = ref<{ left: string; right: string } | null>(null)
const mistakes = ref(0)

const resolved = computed(() => props.result !== null)
const canGiveUp = computed(() => !resolved.value && mistakes.value >= 3)

function tap(side: Side, id: string) {
  if (resolved.value || matched.value.has(id) || flash.value) return
  if (!selected.value || selected.value.side === side) {
    selected.value = selected.value?.side === side && selected.value.id === id ? null : { side, id }
    return
  }
  const pair = side === 'left' ? { left: id, right: selected.value.id } : { left: selected.value.id, right: id }
  selected.value = null
  if (pair.left === pair.right) {
    matched.value = new Set([...matched.value, pair.left])
    if (matched.value.size === props.block.pairs.length) {
      emit('resolved', { correct: true, attempts: mistakes.value + 1 })
    }
    return
  }
  mistakes.value++
  flash.value = pair
  setTimeout(() => (flash.value = null), 700)
}

function showAnswer() {
  matched.value = new Set(props.block.pairs.map(p => p.id))
  emit('resolved', { correct: false, attempts: mistakes.value + 1 })
}

function state(side: Side, id: string): 'matched' | 'wrong' | 'selected' | 'idle' {
  if (matched.value.has(id)) return 'matched'
  if (flash.value?.[side] === id) return 'wrong'
  if (selected.value?.side === side && selected.value.id === id) return 'selected'
  return 'idle'
}

const tileClass = {
  matched: 'border-(--success) bg-(--success-soft) text-(--fg-2) opacity-70',
  wrong: 'border-(--danger) bg-(--danger-soft) text-(--fg-1)',
  selected: 'border-(--brand-blue) bg-[rgba(59,130,246,0.08)] text-(--fg-1)',
  idle: 'border-(--line-2) bg-(--bg-2) text-(--fg-1) hover:border-(--brand-blue) cursor-pointer',
}
</script>

<template>
  <div>
    <p class="mt-0 mb-3 text-[15px] font-semibold text-(--fg-1)">{{ block.prompt }}</p>

    <!-- Resolved: the pairs side by side, which reads better than two matched columns. -->
    <ul v-if="resolved" class="m-0 flex list-none flex-col gap-2 p-0">
      <li v-for="pair in block.pairs" :key="pair.id" class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
        <span class="rounded-(--ra-md) border border-(--success) bg-(--success-soft) px-3 py-2 text-(--fg-1)">{{ pair.left }}</span>
        <span class="text-(--fg-3)" aria-hidden="true">→</span>
        <span class="rounded-(--ra-md) border border-(--success) bg-(--success-soft) px-3 py-2 text-(--fg-1)">{{ pair.right }}</span>
      </li>
    </ul>

    <div v-else class="grid grid-cols-2 gap-2">
      <div class="flex flex-col gap-2" role="group" aria-label="Left items">
        <button
          v-for="pair in left"
          :key="pair.id"
          type="button"
          :aria-pressed="state('left', pair.id) === 'selected'"
          :disabled="matched.has(pair.id)"
          class="min-h-11 rounded-(--ra-md) border px-3 py-2 text-left text-sm transition-colors"
          :class="tileClass[state('left', pair.id)]"
          @click="tap('left', pair.id)"
        >
          {{ pair.left }}
        </button>
      </div>
      <div class="flex flex-col gap-2" role="group" aria-label="Right items">
        <button
          v-for="pair in right"
          :key="pair.id"
          type="button"
          :aria-pressed="state('right', pair.id) === 'selected'"
          :disabled="matched.has(pair.id)"
          class="min-h-11 rounded-(--ra-md) border px-3 py-2 text-left text-sm transition-colors"
          :class="tileClass[state('right', pair.id)]"
          @click="tap('right', pair.id)"
        >
          {{ pair.right }}
        </button>
      </div>
    </div>

    <p v-if="!resolved" class="mt-3 mb-0 text-[13px] text-(--fg-3)" aria-live="polite">
      {{ matched.size }} of {{ block.pairs.length }} matched<template v-if="mistakes"> · {{ mistakes }} {{ mistakes === 1 ? 'mistake' : 'mistakes' }}</template>
    </p>
    <div v-if="canGiveUp" class="mt-3">
      <RaButton variant="ghost" @click="showAnswer">Show answer</RaButton>
    </div>
    <div v-if="resolved" class="mt-4 rounded-(--ra-md) bg-(--bg-3) px-3.5 py-3 text-[13px] text-(--fg-2)" aria-live="polite">
      <div class="mb-1 font-semibold" :class="result!.correct ? 'text-(--success)' : 'text-(--fg-1)'">
        {{ result!.correct ? (result!.attempts === 1 ? 'All matched, no mistakes!' : 'All matched!') : "Here's how they match." }}
      </div>
      <div v-if="block.explanation" class="rich-text leading-[1.6]" v-html="renderRichText(block.explanation)" />
    </div>
  </div>
</template>
