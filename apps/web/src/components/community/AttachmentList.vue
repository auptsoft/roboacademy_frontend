<script setup lang="ts">
import { computed } from 'vue'
import { Bot, Code2, Star } from 'lucide-vue-next'
import type { Attachment, SharedRun } from '@/api/community'

// Images, code snippets and shared simulation runs on a post or reply. Code and run programs are
// shown as text in <pre> - never rendered as HTML.

const props = defineProps<{ attachments: Attachment[] }>()

const images = computed(() => props.attachments.filter((a) => a.kind === 'Image' && a.url))
const others = computed(() => props.attachments.filter((a) => a.kind !== 'Image'))

const OUTCOMES: Record<string, string> = {
  objectives_met: 'Met every objective',
  objectives_failed: "Didn't meet every objective",
  completed: 'Ran to the end',
  runtime_error: 'Stopped with an error',
  timeout: 'Ran out of time',
  stopped: 'Stopped early',
}

function runCode(run: SharedRun): string {
  if (run.generatedCode) return run.generatedCode
  if (!run.program) return ''
  try {
    const parsed = JSON.parse(run.program) as { source?: string }
    return typeof parsed.source === 'string' ? parsed.source : ''
  } catch {
    return ''
  }
}
</script>

<template>
  <div v-if="attachments.length" class="flex flex-col gap-3">
    <div v-if="images.length" class="flex flex-wrap gap-2">
      <a v-for="image in images" :key="image.id" :href="image.url!" target="_blank" rel="noopener noreferrer" class="block">
        <img :src="image.url!" :alt="image.fileName ?? 'Attached image'" class="h-36 max-w-full rounded-(--ra-md) border border-(--line-1) object-cover" loading="lazy" />
      </a>
    </div>

    <template v-for="item in others" :key="item.id">
      <div v-if="item.kind === 'Code'" class="rounded-(--ra-md) border border-(--line-1) bg-(--bg-2) overflow-hidden">
        <div class="flex items-center gap-1.5 border-b border-(--line-1) px-3 py-1.5 text-xs font-semibold text-(--fg-3)">
          <Code2 :size="13" /> {{ item.codeLanguage }}
        </div>
        <pre class="m-0 max-h-80 overflow-auto px-3 py-2.5 text-[12.5px] leading-relaxed text-(--fg-1)"><code>{{ item.code }}</code></pre>
      </div>

      <div v-else-if="item.kind === 'SimulationRun'" class="rounded-(--ra-md) border border-(--line-1) bg-(--bg-2) overflow-hidden">
        <template v-if="item.run">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-(--line-1) px-3 py-2 text-xs text-(--fg-2)">
            <span class="inline-flex items-center gap-1.5 font-semibold text-(--fg-1)"><Bot :size="14" /> {{ item.run.sceneName }}</span>
            <span>{{ item.run.mode === 'graded' ? 'Graded run' : 'Practice run' }} · {{ item.run.language }}</span>
            <span :class="item.run.passed ? 'text-(--success)' : 'text-(--fg-3)'">{{ OUTCOMES[item.run.outcome ?? ''] ?? item.run.outcome }}</span>
            <span v-if="item.run.stars !== null" class="inline-flex items-center gap-0.5" :aria-label="`${item.run.stars} of 3 stars`">
              <Star v-for="n in 3" :key="n" :size="12" :class="n <= item.run.stars ? 'fill-current text-(--warning)' : 'text-(--fg-4)'" />
            </span>
          </div>
          <pre v-if="runCode(item.run)" class="m-0 max-h-80 overflow-auto px-3 py-2.5 text-[12.5px] leading-relaxed text-(--fg-1)"><code>{{ runCode(item.run) }}</code></pre>
        </template>
        <p v-else class="m-0 px-3 py-2 text-xs text-(--fg-3)">This simulation run isn't available any more.</p>
      </div>
    </template>
  </div>
</template>
