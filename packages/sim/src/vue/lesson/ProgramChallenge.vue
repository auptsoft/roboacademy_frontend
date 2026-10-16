<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Loader2, Play } from 'lucide-vue-next'
import { RaButton, normaliseOutput, renderRichText, type BlockResult, type ProgramBlock } from '@roboacademy/ui'
import CodeEditor from '../CodeEditor.vue'
import BlocksEditor from '../BlocksEditor.vue'
import { runForOutput } from '../../runtime/run-output'
import { LANGUAGE_LABELS } from '../../languages/types'
import { getCapability } from '../../robots'
import { lessonToolbox } from './lesson-toolbox'
import { useDark } from './use-dark'

/**
 * A coding check: the learner edits the program until it prints the expected output. It runs in
 * the browser, in the simulator's sandboxed workers, with no robot. Formative like the other
 * checks - "Show answer" after two misses swaps in the author's solution.
 *
 * Once resolved, the editor stays open for experimenting: the result and the answer saved with it
 * are fixed, later runs just show their output, and "Reset to my answer" brings the answer back.
 */
const props = defineProps<{ block: ProgramBlock; result: BlockResult | null }>()
const emit = defineEmits<{ resolved: [result: BlockResult] }>()

const MAX_SAVED_SOURCE = 3_000

const restored = props.result?.answer
const restoredSource = restored && 'source' in restored ? restored.source : null
// Reactive, not read once: in admin's live preview the author can switch the task's language
// (and edit its starter code) while this stays mounted.
const isBlocks = computed(() => props.block.language === 'blocks')
// Text: the source. Blocks: the workspace as JSON (only saved while it fits the answer size).
const source = ref(restoredSource ?? (isBlocks.value ? '' : (props.block.starter ?? '')))
const workspace = ref<object | null>(isBlocks.value ? parseWorkspace(restoredSource) : null)
// The code the result was recorded with (text source, or Blocks workspace JSON). Empty when a
// Blocks workspace was too big to save.
const answerSource = ref<string | null>(restoredSource)
// Blocks only: the workspace differs from the answer. Compared, not just "a change happened":
// Blockly reports the blocks it loads as changes too. (Text compares sources directly.)
const blocksChanged = ref(false)
const blocksEditor = ref<InstanceType<typeof BlocksEditor> | null>(null)
// BlocksEditor needs a robot capability for its sensor dropdowns; the lesson toolbox has no robot blocks.
const capability = getCapability('diff-drive')!
const toolbox = lessonToolbox()
const textLanguage = computed(() => (props.block.language === 'blocks' ? 'javascript' : props.block.language))
const editorKey = ref(0)
const running = ref(false)
const output = ref<string | null>(null)
const error = ref<{ message: string; line: number | null } | null>(null)
const attempts = ref(0)
const dark = useDark()

const resolved = computed(() => props.result !== null)
const canReset = computed(() => resolved.value && !!answerSource.value
  && (isBlocks.value ? blocksChanged.value : source.value !== answerSource.value))
const canGiveUp = computed(() => !resolved.value && attempts.value >= 2)
const passed = computed(() => output.value !== null && !error.value
  && normaliseOutput(output.value) === normaliseOutput(props.block.expectedOutput))

function parseWorkspace(json: string | null): object | null {
  if (!json) return null
  try {
    return JSON.parse(json) as object
  } catch {
    return null
  }
}

// A different language or starter is a different task: start it afresh, with a new editor
// (both editors read their language and content only when they mount).
watch(() => [props.block.language, props.block.starter], () => {
  source.value = isBlocks.value ? '' : (props.block.starter ?? '')
  workspace.value = null
  output.value = null
  error.value = null
  attempts.value = 0
  answerSource.value = null
  blocksChanged.value = false
  editorKey.value++
})

/** Blocks: the workspace as JSON for saving ('' when too big), and its generated code. */
function captureBlocks(): { saved: string; code: string } {
  const json = JSON.stringify(blocksEditor.value?.save() ?? null)
  return { saved: json.length <= MAX_SAVED_SOURCE ? json : '', code: blocksEditor.value?.generate() ?? '' }
}

async function run() {
  let code = source.value
  if (isBlocks.value) {
    const captured = captureBlocks()
    code = captured.code
    source.value = captured.saved
    if (!code.trim()) {
      output.value = null
      error.value = { message: 'Add some blocks first. Use a "print" block to show output.', line: null }
      return
    }
  }
  running.value = true
  error.value = null
  try {
    const result = await runForOutput(props.block.language, code)
    output.value = result.output
    if (!result.ok) error.value = { message: result.error, line: result.line }
  } finally {
    running.value = false
  }
  // Already resolved: this is experimenting, and nothing is recorded.
  if (resolved.value) return
  attempts.value++
  if (passed.value) resolve(true)
}

function showAnswer() {
  if (isBlocks.value) {
    source.value = captureBlocks().saved
  } else if (props.block.solution) {
    source.value = props.block.solution
    editorKey.value++
  }
  resolve(false)
}

function resolve(correct: boolean) {
  answerSource.value = source.value.slice(0, MAX_SAVED_SOURCE)
  blocksChanged.value = false
  emit('resolved', { correct, attempts: attempts.value, answer: { source: answerSource.value } })
}

function resetToAnswer() {
  if (!answerSource.value) return
  if (isBlocks.value) workspace.value = parseWorkspace(answerSource.value)
  source.value = answerSource.value
  blocksChanged.value = false
  output.value = null
  error.value = null
  editorKey.value++
}
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between gap-2">
      <div class="rich-text text-[15px] font-semibold text-(--fg-1)" v-html="renderRichText(block.prompt)" />
      <span class="shrink-0 rounded-(--ra-sm) bg-(--bg-3) px-2 py-0.5 text-[11px] font-semibold text-(--fg-3)">
        {{ LANGUAGE_LABELS[block.language] }}
      </span>
    </div>

    <div v-if="isBlocks" class="h-80 overflow-hidden rounded-(--ra-md) border border-(--line-2)">
      <BlocksEditor
        :key="`blocks-${editorKey}`"
        ref="blocksEditor"
        :program="workspace"
        :capability="capability"
        :toolbox="toolbox"
        :dark="dark"
        @change="(program: object) => (blocksChanged = JSON.stringify(program) !== answerSource)"
      />
    </div>
    <div v-else class="h-56 overflow-hidden rounded-(--ra-md) border border-(--line-2)">
      <CodeEditor
        :key="`${block.language}-${editorKey}`"
        :source="source"
        :language="textLanguage"
        :dark="dark"
        :error-line="error?.line ?? null"
        @change="source = $event"
      />
    </div>

    <div class="mt-3 grid grid-cols-2 gap-3 max-md:grid-cols-1">
      <div>
        <span class="text-xs text-(--fg-3)">Expected output</span>
        <pre class="m-0 mt-1 min-h-12 overflow-x-auto rounded-(--ra-md) bg-(--bg-3) p-2.5 font-mono text-xs text-(--fg-2)">{{ block.expectedOutput }}</pre>
      </div>
      <div>
        <span class="text-xs text-(--fg-3)">Your output</span>
        <pre
          class="m-0 mt-1 min-h-12 overflow-x-auto rounded-(--ra-md) p-2.5 font-mono text-xs"
          :class="output === null ? 'bg-(--bg-3) text-(--fg-4)' : passed ? 'bg-(--success-soft) text-(--fg-1)' : 'bg-(--danger-soft) text-(--fg-1)'"
          aria-live="polite"
        >{{ output === null ? 'Run your program to see its output.' : output || '(nothing printed)' }}</pre>
      </div>
    </div>
    <p v-if="error" class="mt-2 mb-0 text-[13px] text-(--danger)" aria-live="polite">
      {{ error.line ? `Line ${error.line}: ` : '' }}{{ error.message }}
    </p>
    <p v-else-if="output !== null && !passed && !resolved" class="mt-2 mb-0 text-[13px] text-(--danger)" aria-live="polite">
      Not quite - compare your output with the expected output.
    </p>

    <div v-if="!resolved" class="mt-4 flex items-center gap-2">
      <RaButton :disabled="running" @click="run">
        <template #icon><Loader2 v-if="running" :size="14" class="animate-spin" /><Play v-else :size="14" /></template>
        {{ running ? 'Running…' : 'Run' }}
      </RaButton>
      <RaButton v-if="canGiveUp" variant="ghost" @click="showAnswer">Show answer</RaButton>
    </div>
    <div v-else class="mt-4 rounded-(--ra-md) bg-(--bg-3) px-3.5 py-3 text-[13px] text-(--fg-2)" aria-live="polite">
      <div class="mb-1 font-semibold" :class="result!.correct ? 'text-(--success)' : 'text-(--fg-1)'">
        {{ result!.correct ? 'Your program works!' : block.solution && !isBlocks ? "Here's a working answer." : 'Moving on.' }}
      </div>
      <div v-if="block.explanation" class="rich-text leading-[1.6]" v-html="renderRichText(block.explanation)" />
      <p class="mt-1 mb-0 text-xs text-(--fg-3)">Your answer is saved. Keep experimenting if you like: changes from here aren't recorded.</p>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <RaButton variant="secondary" :disabled="running" @click="run">
          <template #icon><Loader2 v-if="running" :size="14" class="animate-spin" /><Play v-else :size="14" /></template>
          {{ running ? 'Running…' : 'Run' }}
        </RaButton>
        <RaButton v-if="canReset" variant="ghost" :disabled="running" @click="resetToAnswer">Reset to my answer</RaButton>
      </div>
    </div>
  </div>
</template>
