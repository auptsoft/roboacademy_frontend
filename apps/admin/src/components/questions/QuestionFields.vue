<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, MapPin, Plus, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import AssetField from '@/components/lesson-content/AssetField.vue'
import { useOptionalAssetContext, type UploadedAsset } from '@/components/lesson-content/asset-context'
import { UNPLACED, newId } from '@/lib/lesson-blocks'
import type { GradedQuestion } from './question-kinds'

/**
 * Editor for the question types lessons and quizzes share: put in order, fill in the blanks,
 * match the pairs, number answer. Used by the lesson editor's block cards, quiz question rows and
 * the question bank. Errors are keyed relative to the question ("pairs", "items[1].text").
 */
const question = defineModel<GradedQuestion>('question', { required: true })
const props = defineProps<{ errors?: Record<string, string[]> }>()

const field = 'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4) aria-invalid:border-(--danger)'
const codeArea = 'w-full resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-2 font-mono text-[13px] text-(--fg-2) outline-none aria-invalid:border-(--danger)'
const iconButton = 'size-7 shrink-0'

const CODE_LANGUAGES = { cpp: 'Arduino / C++', python: 'Python', javascript: 'JavaScript', lua: 'Lua', text: 'Plain text' }

// Diagrams need somewhere to upload to: the lesson editor, or a quiz or question bank page.
const assets = useOptionalAssetContext()

function err(key: string): string[] {
  return props.errors?.[key] ?? []
}

function invalid(key: string): boolean {
  return err(key).length > 0
}

function move<T>(list: T[], index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= list.length) return
  ;[list[index], list[target]] = [list[target]!, list[index]!]
}

// Code builder: the author edits the program as text; each non-blank row is a line. Rows that are
// unchanged keep their ids (learner answers don't depend on them, but stable ids keep Vue's lists calm).
function setParsonsLines(field: 'lines' | 'distractors', text: string) {
  if (question.value.type !== 'parsons') return
  const previous = question.value[field] ?? []
  question.value[field] = text.split('\n').map(line => line.replace(/\s+$/, '')).filter(line => line.trim())
    .map((line, i) => ({ id: previous[i]?.text === line ? previous[i]!.id : newId(), text: line }))
}

// The diagram keeps its phone-sized copy alongside; a replaced image drops the old one.
function setDiagram(uploaded: UploadedAsset) {
  if (question.value.type !== 'label-diagram') return
  question.value.asset = uploaded.key
  question.value.assetSmall = uploaded.smallKey
}

// Label diagram: pick a label, then click the diagram where it belongs.
const placingLabelId = ref<string | null>(null)
const diagramUrl = computed(() =>
  question.value.type === 'label-diagram' && question.value.asset ? assets?.urls.value[question.value.asset] : undefined)

function placeLabel(event: MouseEvent) {
  if (question.value.type !== 'label-diagram' || !placingLabelId.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const label = question.value.labels.find(l => l.id === placingLabelId.value)
  if (!label) return
  label.x = Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10
  label.y = Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10
  const next = question.value.labels.find(l => l.x === UNPLACED)
  placingLabelId.value = next?.id ?? null
}

function isPlaced(label: { x: number; y: number }): boolean {
  return label.x >= 0 && label.y >= 0
}

// An emptied optional number field means "not set", not "" (which the server would reject).
function optionalNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value)
}
</script>

<template>
  <div class="flex flex-col gap-3">
      <!-- Order steps -->
      <template v-if="question.type === 'order'">
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Instruction
          <input v-model="question.prompt" :class="field" :aria-invalid="invalid('prompt')" placeholder="e.g. Put the wiring steps in order.">
        </label>
        <p v-for="msg in err('prompt')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>

        <div class="flex flex-col gap-2">
          <span class="text-xs text-(--fg-3)">Steps, in the correct order (learners see them shuffled)</span>
          <div v-for="(item, j) in question.items" :key="item.id" class="flex items-center gap-2">
            <span class="w-5 shrink-0 text-center text-xs font-semibold text-(--fg-3)">{{ j + 1 }}</span>
            <input v-model="item.text" :class="field" :aria-invalid="invalid(`items[${j}].text`)" :placeholder="`Step ${j + 1}`">
            <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="j === 0" aria-label="Move step up" @click="move(question.items, j, -1)"><ArrowUp :size="14" /></Button>
            <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="j === question.items.length - 1" aria-label="Move step down" @click="move(question.items, j, 1)"><ArrowDown :size="14" /></Button>
            <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="question.items.length <= 2" aria-label="Remove step" @click="question.items.splice(j, 1)"><X :size="14" /></Button>
          </div>
          <Button variant="ghost" size="sm" type="button" class="self-start" @click="question.items.push({ id: newId(), text: '' })"><Plus :size="14" /> Add step</Button>
          <p v-for="msg in err('items')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        </div>

        <label class="grid gap-1 text-xs text-(--fg-3)">
          Explanation (shown once answered)
          <input v-model="question.explanation" :class="field" placeholder="Optional">
        </label>
      </template>

      <!-- Fill in the blanks -->
      <template v-else-if="question.type === 'cloze'">
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Instruction
          <input v-model="question.prompt" :class="field" placeholder="Optional, e.g. Complete the sentence.">
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Content
            <select v-model="question.mode" :class="field">
              <option value="text">Text</option>
              <option value="code">Code</option>
            </select>
          </label>
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Learners answer by
            <select v-model="question.input" :class="field">
              <option value="bank">Tapping a word bank</option>
              <option value="typed">Typing</option>
            </select>
          </label>
        </div>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Text, with each blank in double brackets
          <textarea
            v-model="question.text"
            rows="4"
            spellcheck="false"
            :aria-invalid="invalid('text')"
            :class="question.mode === 'code' ? codeArea : codeArea.replace('font-mono text-[13px]', 'text-sm')"
            :placeholder="question.mode === 'code' ? 'pinMode([[13]], [[OUTPUT]]);' : 'Current is measured in [[amps|amperes]].'"
          />
        </label>
        <p class="m-0 text-xs text-(--fg-4)">
          Write the answer inside the brackets. Accept other answers with a bar: [[amps|amperes]].
          {{ question.mode === 'code' ? 'Code answers ignore spaces.' : 'Answers ignore capitals and extra spaces.' }}
        </p>
        <p v-for="msg in err('text')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label v-if="question.input === 'bank'" class="grid gap-1 text-xs text-(--fg-3)">
          Extra wrong words for the bank (comma-separated)
          <input
            :value="(question.distractors ?? []).join(', ')"
            :class="field"
            placeholder="e.g. watts, ohms"
            @change="question.distractors = ($event.target as HTMLInputElement).value.split(',').map(w => w.trim()).filter(Boolean)"
          >
        </label>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Explanation (shown once answered)
          <input v-model="question.explanation" :class="field" placeholder="Optional">
        </label>
      </template>

      <!-- Match the pairs -->
      <template v-else-if="question.type === 'match'">
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Instruction
          <input v-model="question.prompt" :class="field" :aria-invalid="invalid('prompt')" placeholder="e.g. Match each part to what it does.">
        </label>
        <p v-for="msg in err('prompt')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <span class="text-xs text-(--fg-3)">Pairs (learners see both columns shuffled)</span>
        <div v-for="(pair, j) in question.pairs" :key="pair.id" class="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
          <input v-model="pair.left" :class="field" :aria-invalid="invalid(`pairs[${j}].left`)" :placeholder="`Item ${j + 1}`">
          <span class="text-(--fg-4)" aria-hidden="true">→</span>
          <input v-model="pair.right" :class="field" :aria-invalid="invalid(`pairs[${j}].right`)" placeholder="Its match">
          <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="question.pairs.length <= 2" aria-label="Remove pair" @click="question.pairs.splice(j, 1)"><X :size="14" /></Button>
        </div>
        <Button variant="ghost" size="sm" type="button" class="self-start" :disabled="question.pairs.length >= 8" @click="question.pairs.push({ id: newId(), left: '', right: '' })"><Plus :size="14" /> Add pair</Button>
        <p v-for="msg in err('pairs')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Explanation (shown once answered)
          <input v-model="question.explanation" :class="field" placeholder="Optional">
        </label>
      </template>

      <!-- Number answer -->
      <template v-else-if="question.type === 'number'">
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Question
          <input v-model="question.prompt" :class="field" :aria-invalid="invalid('prompt')" placeholder="e.g. With 5 V across 250 Ω, what current flows?">
        </label>
        <p v-for="msg in err('prompt')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <div class="grid grid-cols-3 gap-2">
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Answer
            <input v-model.number="question.answer" type="number" step="any" :class="field" :aria-invalid="invalid('answer')">
          </label>
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Accept ±
            <input
              :value="question.tolerance ?? ''"
              type="number"
              step="any"
              min="0"
              :class="field"
              :aria-invalid="invalid('tolerance')"
              placeholder="0"
              @change="question.tolerance = optionalNumber(($event.target as HTMLInputElement).value)"
            >
          </label>
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Unit
            <input v-model="question.unit" :class="field" placeholder="e.g. mA">
          </label>
        </div>
        <p v-for="msg in [...err('answer'), ...err('tolerance')]" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Working (shown once answered)
          <input v-model="question.explanation" :class="field" placeholder="Optional, e.g. I = V ÷ R = 5 ÷ 250 = 0.02 A = 20 mA">
        </label>
      </template>
      <!-- Label the diagram -->
      <template v-else-if="question.type === 'label-diagram'">
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Instruction
          <input v-model="question.prompt" :class="field" :aria-invalid="invalid('prompt')">
        </label>
        <AssetField v-if="assets" kind="image" label="Diagram" :asset-key="question.asset" :invalid="invalid('asset')" @uploaded="setDiagram" />
        <p v-else class="m-0 text-xs text-(--fg-3)">Images can't be uploaded here.</p>
        <p v-for="msg in err('asset')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Description (alt text)
          <input v-model="question.alt" :class="field" :aria-invalid="invalid('alt')" placeholder="e.g. Top view of an Arduino Uno">
        </label>

        <div v-if="diagramUrl" class="flex flex-col gap-1.5">
          <span class="text-xs text-(--fg-3)">
            {{ placingLabelId ? 'Click the diagram where this label belongs.' : 'Choose "Place" on a label, then click the diagram.' }}
          </span>
          <div
            class="relative overflow-hidden rounded-(--ra-md) border border-(--line-2)"
            :class="placingLabelId ? 'cursor-crosshair' : ''"
            @click="placeLabel"
          >
            <img :src="diagramUrl" :alt="question.alt" class="block h-auto w-full select-none" draggable="false">
            <span
              v-for="label in question.labels.filter(isPlaced)"
              :key="label.id"
              class="pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow"
              :class="label.id === placingLabelId ? 'bg-(--warning)' : 'bg-(--brand-blue)'"
              :style="{ left: `${label.x}%`, top: `${label.y}%` }"
              :title="label.text"
            >
              {{ question.labels.indexOf(label) + 1 }}
            </span>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-xs text-(--fg-3)">Labels (learners see them as a list and match each to a marker)</span>
          <div v-for="(label, j) in question.labels" :key="label.id" class="flex items-center gap-2">
            <span class="w-5 shrink-0 text-center text-xs font-semibold text-(--fg-3)">{{ j + 1 }}</span>
            <input v-model="label.text" :class="field" :aria-invalid="invalid(`labels[${j}].text`) || invalid(`labels[${j}]`)" :placeholder="`Label ${j + 1}`">
            <Button
              :variant="placingLabelId === label.id ? 'default' : 'outline'"
              size="sm"
              type="button"
              :disabled="!diagramUrl"
              @click="placingLabelId = placingLabelId === label.id ? null : label.id"
            >
              <MapPin :size="12" /> {{ isPlaced(label) ? 'Move' : 'Place' }}
            </Button>
            <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="question.labels.length <= 2" aria-label="Remove label" @click="question.labels.splice(j, 1)"><X :size="14" /></Button>
          </div>
          <Button variant="ghost" size="sm" type="button" class="self-start" @click="question.labels.push({ id: newId(), text: '', x: UNPLACED, y: UNPLACED })"><Plus :size="14" /> Add label</Button>
          <p v-for="msg in err('labels')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          <p v-if="question.labels.some((_, j) => invalid(`labels[${j}]`))" class="m-0 text-xs text-(--danger)">Place every label on the diagram.</p>
        </div>

        <label class="grid gap-1 text-xs text-(--fg-3)">
          Explanation (shown once answered)
          <input v-model="question.explanation" :class="field" placeholder="Optional">
        </label>
      </template>

      <!-- Code builder -->
      <template v-else-if="question.type === 'parsons'">
        <div class="grid grid-cols-[1fr_160px] gap-2 max-md:grid-cols-1">
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Task
            <input v-model="question.prompt" :class="field" :aria-invalid="invalid('prompt')" placeholder="e.g. Build a program that blinks the LED.">
          </label>
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Language
            <select v-model="question.language" :class="field">
              <option v-for="(label, value) in CODE_LANGUAGES" :key="value" :value="value">{{ label }}</option>
            </select>
          </label>
        </div>
        <p v-for="msg in err('prompt')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          The program, one line per row, in the right order (indent with spaces)
          <textarea
            :value="question.lines.map(l => l.text).join('\n')"
            rows="7"
            spellcheck="false"
            :aria-invalid="invalid('lines')"
            :class="codeArea"
            placeholder="void loop() {&#10;  digitalWrite(13, HIGH);&#10;  delay(500);&#10;}"
            @change="setParsonsLines('lines', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <p v-for="msg in err('lines')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Distractor lines that don't belong (optional, one per row)
          <textarea
            :value="(question.distractors ?? []).map(l => l.text).join('\n')"
            rows="3"
            spellcheck="false"
            :class="codeArea"
            placeholder="analogRead(13);"
            @change="setParsonsLines('distractors', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <p class="m-0 text-xs text-(--fg-4)">Blank rows are ignored. Each line keeps its indentation; duplicate lines must each be placed exactly.</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Explanation (shown once answered)
          <input v-model="question.explanation" :class="field" placeholder="Optional">
        </label>
      </template>
  </div>
</template>
