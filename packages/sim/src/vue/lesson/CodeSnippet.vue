<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, lineNumbers } from '@codemirror/view'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { StreamLanguage, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/legacy-modes/mode/clike'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { Check, Copy } from 'lucide-vue-next'
import type { CodeBlock } from '@roboacademy/ui'
import { useDark } from './use-dark'

/** Read-only, highlighted code with a copy button - e.g. an Arduino sketch to study or reuse. */
const props = defineProps<{ block: CodeBlock }>()

const host = ref<HTMLDivElement | null>(null)
const copied = ref(false)
const dark = useDark()
const themeSlot = new Compartment()
let view: EditorView | null = null

function language(): Extension {
  switch (props.block.language) {
    case 'cpp': return StreamLanguage.define(cpp)
    case 'lua': return StreamLanguage.define(lua)
    case 'python': return python()
    case 'javascript': return javascript()
    default: return []
  }
}

function theme(isDark: boolean): Extension {
  return EditorView.theme({
    '&': { fontSize: '13px', backgroundColor: 'var(--bg-3)', color: 'var(--fg-1)' },
    '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.6', overflowX: 'auto' },
    '.cm-gutters': { backgroundColor: 'var(--bg-3)', color: 'var(--fg-4)', border: 'none' },
    '&.cm-focused': { outline: 'none' },
  }, { dark: isDark })
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.block.code,
      extensions: [
        lineNumbers(),
        language(),
        syntaxHighlighting(defaultHighlightStyle),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        themeSlot.of(theme(dark.value)),
      ],
    }),
  })
})

watch(dark, value => view?.dispatch({ effects: themeSlot.reconfigure(theme(value)) }))
onBeforeUnmount(() => view?.destroy())

async function copy() {
  try {
    await navigator.clipboard.writeText(props.block.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard blocked (e.g. insecure context): the code can still be selected by hand.
  }
}
</script>

<template>
  <figure class="m-0">
    <div class="relative overflow-hidden rounded-(--ra-lg) border border-(--line-1)">
      <div ref="host" />
      <button
        type="button"
        class="absolute top-2 right-2 flex cursor-pointer items-center gap-1 rounded-(--ra-sm) border border-(--line-2) bg-(--bg-2) px-2 py-1 text-xs text-(--fg-2) hover:text-(--fg-1)"
        :aria-label="copied ? 'Copied' : 'Copy code'"
        @click="copy"
      >
        <Check v-if="copied" :size="12" /><Copy v-else :size="12" /> {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>
    <figcaption v-if="block.caption" class="mt-2 text-[13px] text-(--fg-3)">{{ block.caption }}</figcaption>
  </figure>
</template>
