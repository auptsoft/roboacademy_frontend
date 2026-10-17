<script setup lang="ts">
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import QuestionOptionsEditor from '@/components/QuestionOptionsEditor.vue'
import QuestionFields from './QuestionFields.vue'
import QuestionPreview from './QuestionPreview.vue'
import type { BankItemForm } from './bank-item-form'
import { QUIZ_KIND_LABELS, newGradedQuestion, type QuizKind } from './question-kinds'

/** A question bank item's fields, for any question type. Errors are the server's, as returned. */
const form = defineModel<BankItemForm>({ required: true })
defineProps<{ errors: Record<string, string[]>; idPrefix: string }>()

function setKind(kind: QuizKind) {
  form.value.kind = kind
  if (kind !== 'choice' && form.value.definition?.type !== kind) form.value.definition = newGradedQuestion(kind)
}

/** Definition errors, keyed relative to it ("Definition.pairs" -> "pairs"). */
function definitionErrors(errors: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith('Definition.')).map(([k, v]) => [k.slice(11), v]))
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Label :for="`${idPrefix}-kind`">Question type</Label>
    <select
      :id="`${idPrefix}-kind`"
      :value="form.kind"
      class="h-9 w-56 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
      @change="setKind(($event.target as HTMLSelectElement).value as QuizKind)"
    >
      <option v-for="(label, kind) in QUIZ_KIND_LABELS" :key="kind" :value="kind">{{ label }}</option>
    </select>
  </div>

  <template v-if="form.kind === 'choice'">
    <div class="flex flex-col gap-1.5">
      <Label :for="`${idPrefix}-text`">Question Text</Label>
      <textarea
        :id="`${idPrefix}-text`"
        v-model="form.text"
        rows="2"
        required
        class="w-full resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-sans text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)"
      />
      <p v-for="msg in errors.Text" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
    </div>
    <div class="flex flex-col gap-1.5">
      <Label>Options</Label>
      <QuestionOptionsEditor
        :options="form.options"
        :correct-option-index="form.correctOptionIndex"
        @update:options="(v) => (form.options = v)"
        @update:correct-option-index="(v) => (form.correctOptionIndex = v)"
      />
    </div>
  </template>
  <QuestionFields v-else-if="form.definition" v-model:question="form.definition" :errors="definitionErrors(errors)" />
  <QuestionPreview
    :kind="form.kind"
    :question="form.definition"
    :text="form.text"
    :options="form.options"
    :correct-option-index="form.correctOptionIndex"
  />

  <div class="flex flex-col gap-1.5">
    <Label :for="`${idPrefix}-tags`">Tags (comma-separated, optional)</Label>
    <Input :id="`${idPrefix}-tags`" v-model="form.tags" placeholder="algebra, chapter-1" />
  </div>
</template>
