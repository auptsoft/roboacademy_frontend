<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, Eye } from 'lucide-vue-next'
import { RaQuizQuestion, isQuizResponseComplete, quizPreview, type QuizResponse } from '@roboacademy/ui'
import { Button } from '@/components/ui/button'
import { useOptionalAssetContext } from '@/components/lesson-content/asset-context'
import type { GradedQuestion, QuizKind } from './question-kinds'

/**
 * "Preview as learner" for a quiz question being written: the question as learners will see it
 * in the quiz, built from the draft as it's edited, and "Check" to see what an answer would score -
 * the quickest way to catch a wrong answer key before saving.
 */
const props = defineProps<{
  kind: QuizKind
  /** Non-choice kinds. */
  question?: GradedQuestion | null
  /** Multiple choice. */
  text?: string
  options?: string[]
  correctOptionIndex?: number
}>()

const open = ref(false)
const response = ref<QuizResponse>(null)
const score = ref<number | null>(null)
const assets = useOptionalAssetContext()

const preview = computed(() =>
  props.kind !== 'choice' && props.question
    ? quizPreview(props.kind, props.question as Parameters<typeof quizPreview>[1], assets?.urls.value)
    : null)

// Any edit to the question starts the preview afresh: an old answer may no longer fit it.
const signature = computed(() => JSON.stringify([props.kind, props.question, props.text, props.options, props.correctOptionIndex]))
const previewKey = ref(0)
watch(signature, () => reset())

function reset() {
  response.value = null
  score.value = null
  previewKey.value++
}

const complete = computed(() => isQuizResponseComplete(props.kind, preview.value?.definition ?? null, response.value))

function check() {
  score.value = props.kind === 'choice'
    ? (response.value === props.correctOptionIndex ? 1 : 0)
    : preview.value?.grade(response.value) ?? 0
}

const scoreText = computed(() => {
  if (score.value === null) return ''
  const percent = Math.round(score.value * 100)
  return percent === 100 ? 'Correct: this answer scores 100%.' : percent === 0 ? 'This answer scores 0%.' : `Partly right: this answer scores ${percent}%.`
})
</script>

<template>
  <div class="mt-3 rounded-(--ra-md) border border-(--line-1) bg-(--bg-2)">
    <button
      type="button"
      class="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-xs font-semibold text-(--fg-2)"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Eye :size="13" /> Preview as learner
      <ChevronDown :size="13" class="ml-auto transition-transform" :class="open && 'rotate-180'" />
    </button>
    <div v-if="open" class="flex flex-col gap-3 border-t border-(--line-1) p-3">
      <template v-if="kind === 'choice'">
        <div class="text-sm font-semibold text-(--fg-1)">{{ text || 'Your question' }}</div>
        <label v-for="(option, i) in options ?? []" :key="i" class="flex cursor-pointer items-center gap-2 text-[13px] text-(--fg-2)">
          <input type="radio" :name="`preview-${previewKey}`" :checked="response === i" @change="response = i"> {{ option || `Option ${i + 1}` }}
        </label>
      </template>
      <RaQuizQuestion
        v-else-if="preview"
        :key="previewKey"
        v-model="response"
        :kind="kind"
        :definition="preview.definition"
      />

      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" type="button" :disabled="!complete" @click="check">Check</Button>
        <Button size="sm" variant="ghost" type="button" @click="reset">Start over</Button>
        <span
          v-if="score !== null"
          class="text-xs font-semibold"
          :class="score === 1 ? 'text-(--success)' : score === 0 ? 'text-(--danger)' : 'text-(--warning)'"
          aria-live="polite"
        >{{ scoreText }}</span>
      </div>
      <p class="m-0 text-xs text-(--fg-4)">Learners see this without any marking until they submit the quiz.</p>
    </div>
  </div>
</template>
