<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { Compartment, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, type DecorationSet } from '@codemirror/view'
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { javascript, javascriptLanguage } from '@codemirror/lang-javascript'
import { ROBOT_JS_API } from '../languages/javascript/api'
import type { ProgramLanguage } from '../languages/types'

/**
 * The text editor for JavaScript (and, later, Python) programs: CodeMirror with autocomplete for
 * the `robot` API, the running line highlighted, and the line an error came from marked.
 */
const props = defineProps<{
  /** Read once on mount; later edits flow out through `change`. */
  source: string
  language: Exclude<ProgramLanguage, 'blocks'>
  readonly?: boolean
  /** The line running now, 1-based. */
  runningLine?: number | null
  /** The line an error came from, 1-based. */
  errorLine?: number | null
  dark?: boolean
}>()

const emit = defineEmits<{ change: [source: string] }>()

const host = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null
let changeTimer: ReturnType<typeof setTimeout> | undefined
const readOnly = new Compartment()
const themeSlot = new Compartment()

const setLines = StateEffect.define<{ running: number | null; error: number | null }>()

/** Line decorations for the running line and the error line. */
const lineMarks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    let next = marks.map(tr.changes)
    for (const effect of tr.effects) {
      if (!effect.is(setLines)) continue
      const ranges = []
      const doc = tr.state.doc
      const { running, error } = effect.value
      if (error && error <= doc.lines) ranges.push(Decoration.line({ class: 'cm-sim-error' }).range(doc.line(error).from))
      if (running && running <= doc.lines && running !== error) {
        ranges.push(Decoration.line({ class: 'cm-sim-running' }).range(doc.line(running).from))
      }
      next = Decoration.set(ranges.sort((a, b) => a.from - b.from))
    }
    return next
  },
  provide: (field) => EditorView.decorations.from(field),
})

/** `robot.` completions, with signatures and descriptions. */
function robotCompletions(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/robot\.\w*/)
  if (!word) return null
  return {
    from: word.from + 'robot.'.length,
    options: ROBOT_JS_API.map((entry) => ({
      label: entry.name,
      detail: entry.signature.slice(entry.name.length),
      info: entry.info,
      apply: entry.apply,
      type: 'method',
    })),
  }
}

function languageExtension(): Extension {
  // Python editing arrives with the Python runtime (step 2).
  return [javascript(), javascriptLanguage.data.of({ autocomplete: robotCompletions })]
}

function theme(dark: boolean): Extension {
  return EditorView.theme(
    {
      '&': { height: '100%', fontSize: '13px', backgroundColor: 'var(--bg-2)', color: 'var(--fg-1)' },
      '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.55' },
      '.cm-gutters': { backgroundColor: 'var(--bg-3)', color: 'var(--fg-4)', borderRight: '1px solid var(--line-1)' },
      '.cm-activeLineGutter, .cm-activeLine': { backgroundColor: 'transparent' },
      '.cm-sim-running': { backgroundColor: dark ? 'rgba(255, 210, 63, 0.18)' : 'rgba(255, 210, 63, 0.35)' },
      '.cm-sim-error': { backgroundColor: 'var(--danger-soft)' },
      '&.cm-focused': { outline: 'none' },
    },
    { dark },
  )
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.source,
      extensions: [
        basicSetup,
        languageExtension(),
        lineMarks,
        readOnly.of(EditorState.readOnly.of(props.readonly ?? false)),
        themeSlot.of(theme(props.dark ?? false)),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return
          clearTimeout(changeTimer)
          changeTimer = setTimeout(() => view && emit('change', view.state.doc.toString()), 400)
        }),
      ],
    }),
  })
  applyLines()
})

function applyLines() {
  view?.dispatch({ effects: setLines.of({ running: props.runningLine ?? null, error: props.errorLine ?? null }) })
}

watch(() => [props.runningLine, props.errorLine], applyLines)
watch(() => props.readonly, (value) => view?.dispatch({ effects: readOnly.reconfigure(EditorState.readOnly.of(value ?? false)) }))
watch(() => props.dark, (value) => view?.dispatch({ effects: themeSlot.reconfigure(theme(value ?? false)) }))

onBeforeUnmount(() => {
  clearTimeout(changeTimer)
  view?.destroy()
  view = null
})

defineExpose({
  getSource: (): string => view?.state.doc.toString() ?? props.source,
  /** Scrolls to a line and puts the cursor on it, e.g. the one an error came from. */
  focusLine: (line: number) => {
    if (!view || line < 1 || line > view.state.doc.lines) return
    const at = view.state.doc.line(line).from
    view.dispatch({ selection: { anchor: at }, effects: EditorView.scrollIntoView(at, { y: 'center' }) })
    view.focus()
  },
})
</script>

<template>
  <div ref="host" class="sim-code" />
</template>

<style scoped>
.sim-code {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.sim-code :deep(.cm-editor) {
  height: 100%;
}
</style>
