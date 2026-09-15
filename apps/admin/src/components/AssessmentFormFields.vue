<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import AssessmentQuestionRow from '@/components/AssessmentQuestionRow.vue'
import { ASSESSMENT_TYPES, type AssessmentType, type QuestionBankItemSummary } from '@/api/assessment'

export interface QuestionRow {
  source: 'bank' | 'inline'
  bankItemId: string
  text: string
  options: string[]
  correctOptionIndex: number
}

export interface AssessmentFormState {
  type: AssessmentType
  title: string
  isRequired: boolean
  allowUnenrolled: boolean
  order: number
  maxAttempts: string
  timeLimitMinutes: string
  passMark: number
  prompt: string
  acceptedContentTypes: string
  maxFileSizeBytes: string
  questions: QuestionRow[]
}

function newQuestionRow(): QuestionRow {
  return { source: 'inline', bankItemId: '', text: '', options: ['', ''], correctOptionIndex: 0 }
}

const form = defineModel<AssessmentFormState>({ required: true })
defineProps<{ questionBank: QuestionBankItemSummary[]; errors: Record<string, string[]> }>()

function addQuestionRow() {
  form.value.questions.push(newQuestionRow())
}

function removeQuestionRow(index: number) {
  form.value.questions.splice(index, 1)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Label>Type</Label>
    <div class="flex gap-3 text-sm">
      <label v-for="type in ASSESSMENT_TYPES" :key="type" class="flex items-center gap-1.5">
        <input v-model="form.type" type="radio" :value="type" class="accent-(--brand-blue)"> {{ type }}
      </label>
    </div>
  </div>

  <div class="flex flex-col gap-1.5">
    <Label for="assessment-title">Title</Label>
    <Input id="assessment-title" v-model="form.title" required />
    <p v-for="msg in errors.Title" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
  </div>

  <div class="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
    <div class="flex flex-col gap-1.5">
      <Label for="assessment-order">Order</Label>
      <Input id="assessment-order" v-model="form.order" type="number" min="1" required />
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="assessment-max-attempts">Max Attempts (optional)</Label>
      <Input id="assessment-max-attempts" v-model="form.maxAttempts" type="number" min="1" />
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="assessment-time-limit">Time Limit, min (optional)</Label>
      <Input id="assessment-time-limit" v-model="form.timeLimitMinutes" type="number" min="1" />
    </div>
  </div>

  <label class="flex items-center gap-1.5 text-sm text-(--fg-2)">
    <input v-model="form.isRequired" type="checkbox" class="size-4 accent-(--brand-blue)"> Required to proceed
  </label>

  <label class="flex items-center gap-1.5 text-sm text-(--fg-2)">
    <input v-model="form.allowUnenrolled" type="checkbox" class="size-4 accent-(--brand-blue)"> Allow un-enrolled learners
  </label>

  <!-- Quiz -->
  <template v-if="form.type === 'Quiz'">
    <div class="flex flex-col gap-1.5">
      <Label for="assessment-pass-mark">Pass Mark (%)</Label>
      <Input id="assessment-pass-mark" v-model="form.passMark" type="number" min="0" max="100" required />
    </div>

    <div class="flex flex-col gap-3">
      <Label>Questions</Label>
      <AssessmentQuestionRow
        v-for="(_, index) in form.questions"
        :key="index"
        v-model="form.questions[index]"
        :question-bank="questionBank"
        :removable="form.questions.length > 1"
        @remove="removeQuestionRow(index)"
      />
      <Button variant="outline" size="sm" type="button" class="self-start" @click="addQuestionRow">
        <Plus :size="14" /> Add Question
      </Button>
    </div>
  </template>

  <!-- Written -->
  <div v-else-if="form.type === 'Written'" class="flex flex-col gap-1.5">
    <Label for="assessment-prompt">Prompt</Label>
    <textarea
      id="assessment-prompt"
      v-model="form.prompt"
      rows="4"
      required
      placeholder="Instructions shown to the learner"
      class="w-full resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-sans text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)"
    />
  </div>

  <!-- FileSubmission -->
  <div v-else class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
    <div class="flex flex-col gap-1.5">
      <Label for="assessment-content-types">Accepted Content Types (optional, comma-separated)</Label>
      <Input id="assessment-content-types" v-model="form.acceptedContentTypes" placeholder="application/pdf, image/png" />
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="assessment-max-file-size">Max File Size, bytes (optional)</Label>
      <Input id="assessment-max-file-size" v-model="form.maxFileSizeBytes" type="number" min="1" />
    </div>
  </div>
</template>
