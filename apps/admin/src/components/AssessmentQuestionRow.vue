<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import QuestionOptionsEditor from '@/components/QuestionOptionsEditor.vue'
import QuestionFields from '@/components/questions/QuestionFields.vue'
import QuestionPreview from '@/components/questions/QuestionPreview.vue'
import { QUIZ_KIND_LABELS, newGradedQuestion, type QuizKind } from '@/components/questions/question-kinds'
import type { QuestionBankItemSummary } from '@/api/assessment'
import type { QuestionRow } from '@/components/questions/question-rows'

/** One quiz question: from the bank, or written inline as any question type. */
const row = defineModel<QuestionRow>({ required: true })
defineProps<{
  questionBank: QuestionBankItemSummary[]
  removable: boolean
  /** Server errors for this question's definition, keyed relative to it. */
  errors?: Record<string, string[]>
}>()
defineEmits<{ remove: [] }>()

function setKind(kind: QuizKind) {
  row.value.kind = kind
  // Keep what's been written if switching back to the same kind; start a new one otherwise.
  if (kind !== 'choice' && row.value.definition?.type !== kind) row.value.definition = newGradedQuestion(kind)
}
</script>

<template>
  <div class="rounded-(--ra-md) border border-(--line-2) p-3">
    <div class="mb-2 flex items-center justify-between">
      <div class="flex gap-3 text-xs">
        <label class="flex items-center gap-1.5">
          <input v-model="row.source" type="radio" value="inline" class="accent-(--brand-blue)"> Inline
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="row.source" type="radio" value="bank" class="accent-(--brand-blue)"> From Question Bank
        </label>
      </div>
      <Button
        v-if="removable"
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Remove question"
        @click="$emit('remove')"
      >
        <Trash2 :size="14" />
      </Button>
    </div>

    <template v-if="row.source === 'bank'">
      <select
        v-model="row.bankItemId"
        required
        class="h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
      >
        <option value="" disabled>Select a question</option>
        <option v-for="qb in questionBank" :key="qb.id" :value="qb.id">
          {{ qb.kind && qb.kind !== 'choice' ? `[${QUIZ_KIND_LABELS[qb.kind]}] ` : '' }}{{ qb.text }}
        </option>
      </select>
    </template>
    <template v-else>
      <label class="mb-2 grid gap-1 text-xs text-(--fg-3)">
        Question type
        <select
          :value="row.kind"
          class="h-9 w-56 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
          @change="setKind(($event.target as HTMLSelectElement).value as QuizKind)"
        >
          <option v-for="(label, kind) in QUIZ_KIND_LABELS" :key="kind" :value="kind">{{ label }}</option>
        </select>
      </label>
      <template v-if="row.kind === 'choice'">
        <textarea
          v-model="row.text"
          rows="2"
          placeholder="Question text"
          required
          class="mb-2 w-full resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-sans text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)"
        />
        <QuestionOptionsEditor
          :options="row.options"
          :correct-option-index="row.correctOptionIndex"
          @update:options="(v) => (row.options = v)"
          @update:correct-option-index="(v) => (row.correctOptionIndex = v)"
        />
      </template>
      <QuestionFields v-else-if="row.definition" v-model:question="row.definition" :errors="errors" />
      <QuestionPreview
        :kind="row.kind"
        :question="row.definition"
        :text="row.text"
        :options="row.options"
        :correct-option-index="row.correctOptionIndex"
      />
    </template>
  </div>
</template>
