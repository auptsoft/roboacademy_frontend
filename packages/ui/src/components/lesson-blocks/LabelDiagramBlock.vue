<script setup lang="ts">
import { computed, ref } from 'vue'
import RaButton from '../ui/RaButton.vue'
import { renderRichText } from '../../lib/rich-text'
import { useAssetUrl } from './assets'
import type { BlockResult, DiagramLabel, LabelDiagramBlock } from './types'

// Numbered markers sit on the diagram; the learner picks the right label for each from a list.
// A select per marker rather than drag-and-drop, so it works the same with touch, keyboard and
// screen readers. Markers are numbered in a shuffled (but stable) order so the numbering gives
// nothing away.
const props = defineProps<{ block: LabelDiagramBlock; result: BlockResult | null }>()
const emit = defineEmits<{ resolved: [result: BlockResult] }>()
const assetUrl = useAssetUrl()

const markers = computed(() => shuffle(props.block.labels, props.block.id))
const choices = computed(() => [...props.block.labels].sort((a, b) => a.text.localeCompare(b.text)))
const chosen = ref<Record<string, string>>({})
const wrong = ref<string[]>([])
const attempts = ref(0)

const resolved = computed(() => props.result !== null)
const allChosen = computed(() => markers.value.every(m => chosen.value[m.id]))
const canGiveUp = computed(() => !resolved.value && attempts.value >= 2)
const src = computed(() => assetUrl(props.block.asset))
const srcset = computed(() => {
  const small = assetUrl(props.block.assetSmall)
  return small && src.value ? `${small} 800w, ${src.value} 1600w` : undefined
})

function choose(markerId: string, labelId: string) {
  chosen.value = { ...chosen.value, [markerId]: labelId }
  wrong.value = wrong.value.filter(id => id !== markerId)
}

function check() {
  attempts.value++
  wrong.value = markers.value.filter(m => chosen.value[m.id] !== m.id).map(m => m.id)
  if (!wrong.value.length) emit('resolved', { correct: true, attempts: attempts.value })
}

function showAnswer() {
  wrong.value = []
  emit('resolved', { correct: false, attempts: attempts.value })
}

function markerState(id: string): 'correct' | 'wrong' | 'idle' {
  if (resolved.value) return 'correct'
  return wrong.value.includes(id) ? 'wrong' : 'idle'
}

function shuffle(items: DiagramLabel[], seed: string): DiagramLabel[] {
  let state = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11)
  const random = () => (state = (state * 1103515245 + 12345) >>> 0) / 2 ** 32
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}
</script>

<template>
  <div>
    <p class="mt-0 mb-3 text-[15px] font-semibold text-(--fg-1)">{{ block.prompt }}</p>

    <div class="relative overflow-hidden rounded-(--ra-md) border border-(--line-1) bg-(--bg-3)">
      <img
        v-if="src"
        :src="src"
        :srcset="srcset"
        sizes="(max-width: 768px) 100vw, 720px"
        :alt="block.alt"
        loading="lazy"
        decoding="async"
        class="block h-auto w-full"
      >
      <div v-else class="aspect-video" role="img" :aria-label="block.alt" />
      <span
        v-for="(marker, index) in markers"
        :key="marker.id"
        class="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow"
        :class="{
          'bg-(--success)': markerState(marker.id) === 'correct',
          'bg-(--danger)': markerState(marker.id) === 'wrong',
          'bg-(--brand-blue)': markerState(marker.id) === 'idle',
        }"
        :style="{ left: `${marker.x}%`, top: `${marker.y}%` }"
        aria-hidden="true"
      >
        {{ index + 1 }}
      </span>
    </div>

    <ol class="mt-3 mb-0 flex list-none flex-col gap-2 p-0">
      <li v-for="(marker, index) in markers" :key="marker.id" class="flex items-center gap-3 text-sm">
        <span class="w-6 shrink-0 text-center text-xs font-semibold text-(--fg-3)">{{ index + 1 }}</span>
        <span v-if="resolved" class="font-semibold text-(--success)">{{ marker.text }}</span>
        <select
          v-else
          :value="chosen[marker.id] ?? ''"
          :aria-label="`Label for marker ${index + 1}`"
          :aria-invalid="wrong.includes(marker.id)"
          class="h-9 min-w-0 flex-1 rounded-(--ra-md) border bg-(--bg-2) px-2.5 text-sm text-(--fg-1) outline-none"
          :class="wrong.includes(marker.id) ? 'border-(--danger)' : 'border-(--line-2)'"
          @change="choose(marker.id, ($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>Choose a label…</option>
          <option v-for="choice in choices" :key="choice.id" :value="choice.id">{{ choice.text }}</option>
        </select>
      </li>
    </ol>

    <p v-if="!resolved && wrong.length" class="mt-3 mb-0 text-[13px] text-(--danger)" aria-live="polite">
      {{ markers.length - wrong.length }} of {{ markers.length }} right. Try again.
    </p>

    <div v-if="!resolved" class="mt-4 flex items-center gap-2">
      <RaButton :disabled="!allChosen" @click="check">Check labels</RaButton>
      <RaButton v-if="canGiveUp" variant="ghost" @click="showAnswer">Show answer</RaButton>
    </div>

    <div v-else class="mt-4 rounded-(--ra-md) bg-(--bg-3) px-3.5 py-3 text-[13px] text-(--fg-2)" aria-live="polite">
      <div class="mb-1 font-semibold" :class="result!.correct ? 'text-(--success)' : 'text-(--fg-1)'">
        {{ result!.correct ? 'All labelled correctly!' : 'Here are the correct labels.' }}
      </div>
      <div v-if="block.explanation" class="rich-text leading-[1.6]" v-html="renderRichText(block.explanation)" />
    </div>
  </div>
</template>
