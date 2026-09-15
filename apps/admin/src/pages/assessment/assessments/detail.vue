<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { Plus, Trash2, Copy, ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import Pagination from '@/components/Pagination.vue'
import QuestionOptionsEditor from '@/components/QuestionOptionsEditor.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import CopyAssessmentToTenantDialog from '@/components/CopyAssessmentToTenantDialog.vue'
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import { useCanCopyCrossTenant } from '@/composables/useCanCopyCrossTenant'
import { getCourse } from '@/api/learning'
import {
  getAssessmentForAuthor,
  updateAssessment,
  updateAssessmentContent,
  cloneAssessment,
  listAttempts,
  gradeAttempt,
  listQuestionBank,
  type AuthoredAssessment,
  type AttemptItem,
  type QuestionBankItemSummary,
  type UpdateAssessmentContentRequest,
} from '@/api/assessment'

const route = useRoute()
const router = useRouter()
const assessmentId = computed(() => String(route.params.assessmentId))

const assessment = ref<AuthoredAssessment | null>(null)
const courseTitle = ref('')
const loading = ref(true)
const notFound = ref(false)

// Collapsed by default - each section owns its own collapse state.
const generalOpen = ref(false)
const contentOpen = ref(false)
const submissionsOpen = ref(false)

const sections = computed(() => {
  const base = [{ id: 'general', label: 'General' }]
  if (assessment.value?.type === 'Quiz') base.push({ id: 'content', label: 'Questions' })
  else base.push({ id: 'content', label: 'Prompt & Config' })
  base.push({ id: 'submissions', label: 'Submissions' })
  return base
})

async function loadAssessment() {
  loading.value = true
  notFound.value = false
  try {
    assessment.value = await getAssessmentForAuthor(assessmentId.value)
    generalForm.title = assessment.value.title
    generalForm.isRequired = assessment.value.isRequired
    generalForm.allowUnenrolled = assessment.value.allowUnenrolled
    generalForm.order = assessment.value.order
    generalForm.preText = assessment.value.preText ?? ''
    generalForm.postText = assessment.value.postText ?? ''
    resetContentForm()
    try {
      const course = await getCourse(assessment.value.courseId)
      courseTitle.value = course.title
    } catch {
      courseTitle.value = assessment.value.courseId
    }
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load assessment.')
    }
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAssessment()
  loadAttempts()
  loadQuestionBank()
})
watch(assessmentId, () => {
  loadAssessment()
  loadAttempts()
})

// --- General (title / required / order / pre/post text) ---
const generalForm = reactive({
  title: '', isRequired: true, allowUnenrolled: false, order: 1, preText: '', postText: '',
})
const generalSubmitting = ref(false)
const generalErrors = ref<Record<string, string[]>>({})

async function submitGeneral() {
  generalErrors.value = {}
  generalSubmitting.value = true
  try {
    const updated = await updateAssessment(assessmentId.value, {
      title: generalForm.title,
      isRequired: generalForm.isRequired,
      allowUnenrolled: generalForm.allowUnenrolled,
      order: Number(generalForm.order),
      preText: generalForm.preText || null,
      postText: generalForm.postText || null,
    })
    if (assessment.value) {
      assessment.value = {
        ...assessment.value, title: updated.title, isRequired: updated.isRequired,
        allowUnenrolled: updated.allowUnenrolled, order: updated.order,
      }
    }
    toast.success('Assessment updated.')
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      generalErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update assessment.')
    }
  } finally {
    generalSubmitting.value = false
  }
}

// --- Type-specific content (only editable while attemptCount === 0 - see
// updateAssessmentContent's Conflict case) ---
const questionBank = ref<QuestionBankItemSummary[]>([])

async function loadQuestionBank() {
  const result = await listQuestionBank(undefined, 1, 100)
  questionBank.value = result.items
}

interface QuestionRow {
  source: 'bank' | 'inline'
  bankItemId: string
  text: string
  options: string[]
  correctOptionIndex: number
}

function newQuestionRow(): QuestionRow {
  return { source: 'inline', bankItemId: '', text: '', options: ['', ''], correctOptionIndex: 0 }
}

const contentForm = reactive({
  maxAttempts: '', timeLimitMinutes: '',
  passMark: 50,
  prompt: '',
  acceptedContentTypes: '', maxFileSizeBytes: '',
})
const contentQuestionRows = ref<QuestionRow[]>([newQuestionRow()])
const contentSubmitting = ref(false)
const contentErrors = ref<Record<string, string[]>>({})

function resetContentForm() {
  if (!assessment.value) return
  contentForm.maxAttempts = assessment.value.maxAttempts ? String(assessment.value.maxAttempts) : ''
  contentForm.timeLimitMinutes = assessment.value.timeLimitMinutes ? String(assessment.value.timeLimitMinutes) : ''
  contentForm.passMark = assessment.value.passMark ?? 50
  contentForm.prompt = assessment.value.prompt ?? ''
  contentForm.acceptedContentTypes = assessment.value.acceptedContentTypes?.join(', ') ?? ''
  contentForm.maxFileSizeBytes = assessment.value.maxFileSizeBytes ? String(assessment.value.maxFileSizeBytes) : ''
  contentQuestionRows.value = assessment.value.questions.length > 0
    ? assessment.value.questions.map((q) => ({
        source: q.bankItemId ? 'bank' as const : 'inline' as const,
        bankItemId: q.bankItemId ?? '',
        text: q.text,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
      }))
    : [newQuestionRow()]
}

function addContentQuestionRow() {
  contentQuestionRows.value.push(newQuestionRow())
}

function removeContentQuestionRow(index: number) {
  contentQuestionRows.value.splice(index, 1)
}

async function submitContent() {
  if (!assessment.value) return
  contentErrors.value = {}
  contentSubmitting.value = true
  try {
    const request: UpdateAssessmentContentRequest = {
      maxAttempts: contentForm.maxAttempts ? Number(contentForm.maxAttempts) : undefined,
      timeLimitMinutes: contentForm.timeLimitMinutes ? Number(contentForm.timeLimitMinutes) : undefined,
    }

    if (assessment.value.type === 'Quiz') {
      request.passMark = Number(contentForm.passMark)
      request.questions = contentQuestionRows.value.map((row) =>
        row.source === 'bank'
          ? { bankItemId: row.bankItemId }
          : { text: row.text, options: row.options, correctOptionIndex: row.correctOptionIndex },
      )
    } else if (assessment.value.type === 'Written') {
      request.prompt = contentForm.prompt
    } else {
      request.acceptedContentTypes = contentForm.acceptedContentTypes
        ? contentForm.acceptedContentTypes.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined
      request.maxFileSizeBytes = contentForm.maxFileSizeBytes ? Number(contentForm.maxFileSizeBytes) : undefined
    }

    await updateAssessmentContent(assessmentId.value, request)
    toast.success('Content updated.')
    await loadAssessment()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      contentErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update content.')
    }
  } finally {
    contentSubmitting.value = false
  }
}

// --- Clone (the escape hatch once attemptCount > 0 makes content read-only) ---
const cloning = ref(false)

// --- Copy to a tenant ---
const canCopyCrossTenant = useCanCopyCrossTenant()
const copyDialogOpen = ref(false)

async function submitClone() {
  cloning.value = true
  try {
    const clone = await cloneAssessment(assessmentId.value)
    toast.success('Assessment cloned — now editing the copy.')
    router.push(`/assessment/assessments/${clone.id}`)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to clone assessment.')
  } finally {
    cloning.value = false
  }
}

// --- Submissions / attempts ---
const {
  items: attempts,
  loading: attemptsLoading,
  page: attemptsPage,
  pageSize: attemptsPageSize,
  meta: attemptsMeta,
  totalPages: attemptsTotalPages,
  load: loadAttempts,
  goToPage: goToAttemptsPage,
  setPageSize: setAttemptsPageSize,
} = usePagedList(
  (page, pageSize) => listAttempts({ assessmentId: assessmentId.value }, page, pageSize),
  { initialPageSize: 20, errorMessage: 'Failed to load submissions.' },
)

const statusTone: Record<AttemptItem['status'], 'neutral' | 'info'> = {
  InProgress: 'neutral',
  Submitted: 'info',
  Graded: 'neutral',
}

// --- Grade dialog ---
const gradingAttempt = ref<AttemptItem | null>(null)
const gradeSubmitting = ref(false)
const gradeForm = reactive({ passed: true, score: '', feedback: '' })

function openGrade(attempt: AttemptItem) {
  gradingAttempt.value = attempt
  gradeForm.passed = true
  gradeForm.score = ''
  gradeForm.feedback = ''
}

async function submitGrade() {
  if (!gradingAttempt.value) return
  gradeSubmitting.value = true
  try {
    await gradeAttempt(gradingAttempt.value.id, {
      passed: gradeForm.passed,
      score: gradeForm.score ? Number(gradeForm.score) : undefined,
      feedback: gradeForm.feedback || undefined,
    })
    toast.success('Attempt graded.')
    gradingAttempt.value = null
    await loadAttempts()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to grade attempt.')
  } finally {
    gradeSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-6 pt-8 px-8 pb-16 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading assessment…</p>

    <template v-else-if="notFound">
      <RaCard class="p-10 text-center">
        <p class="m-0 text-sm text-(--fg-3)">Assessment not found.</p>
      </RaCard>
    </template>

    <template v-else-if="assessment">
      <div class="flex items-start justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">{{ assessment.title }}</h1>
            <RaChip tone="neutral">{{ assessment.type }}</RaChip>
            <RaChip :tone="assessment.isRequired ? 'info' : 'neutral'">{{ assessment.isRequired ? 'Required' : 'Optional' }}</RaChip>
            <RaChip tone="neutral">{{ assessment.attemptCount }} attempt{{ assessment.attemptCount === 1 ? '' : 's' }}</RaChip>
          </div>
          <p class="mt-1.5 text-sm text-(--fg-3)">{{ courseTitle }}</p>
        </div>
        <Button v-if="canCopyCrossTenant" variant="outline" @click="copyDialogOpen = true">
          <Copy :size="14" /> Copy to tenant…
        </Button>
      </div>

      <CopyAssessmentToTenantDialog v-model:open="copyDialogOpen" :assessment-id="assessmentId" />

      <div class="grid grid-cols-[180px_1fr] gap-8 max-xl:grid-cols-1 max-xl:gap-6">
        <nav class="sticky top-0 flex h-fit flex-col gap-1 max-xl:hidden">
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="rounded-(--ra-md) px-3 py-2 text-sm text-(--fg-3) transition-colors hover:bg-(--bg-3) hover:text-(--fg-1)"
          >
            {{ section.label }}
          </a>
        </nav>

        <div class="flex flex-col gap-6">
          <!-- General -->
          <RaCard id="general" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="generalOpen">
              <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
                <div>
                  <h3 class="m-0 text-lg font-bold text-(--fg-1)">General</h3>
                  <p class="m-0 mt-1 text-xs text-(--fg-3)">
                    Title, required flag, and order can be changed at any time. Type-specific settings (pass mark, prompt,
                    file config, questions) are fixed at creation.
                  </p>
                </div>
                <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="generalOpen && 'rotate-180'" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="py-5 px-6">
                  <form class="flex flex-col gap-4" @submit.prevent="submitGeneral">
                    <div class="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
                      <div class="flex flex-col gap-1.5">
                        <Label for="assessment-title">Title</Label>
                        <Input id="assessment-title" v-model="generalForm.title" required />
                        <p v-for="msg in generalErrors.Title" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <Label for="assessment-order">Order</Label>
                        <Input id="assessment-order" v-model="generalForm.order" type="number" min="1" required />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <Label>Max Attempts</Label>
                        <p class="m-0 text-sm text-(--fg-1)">{{ assessment.maxAttempts ?? 'Unlimited' }}</p>
                      </div>
                    </div>
                    <label class="flex items-center gap-1.5 text-sm text-(--fg-2)">
                      <input v-model="generalForm.isRequired" type="checkbox" class="size-4 accent-(--brand-blue)"> Required to proceed
                    </label>

                    <label class="flex items-center gap-1.5 text-sm text-(--fg-2)">
                      <input v-model="generalForm.allowUnenrolled" type="checkbox" class="size-4 accent-(--brand-blue)"> Allow un-enrolled learners
                    </label>

                    <div class="flex flex-col gap-1.5">
                      <Label>Pre-Text (shown before attempting, e.g. instructions)</Label>
                      <RichTextEditor v-model="generalForm.preText" placeholder="Instructions for the learner…" :rows="4" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label>Post-Text (shown after attempting, e.g. result messaging)</Label>
                      <RichTextEditor v-model="generalForm.postText" placeholder="Message shown after submitting…" :rows="4" />
                    </div>

                    <div class="flex justify-end">
                      <Button type="submit" :disabled="generalSubmitting">
                        {{ generalSubmitting ? 'Saving…' : 'Save Changes' }}
                      </Button>
                    </div>
                  </form>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </RaCard>

          <!-- Type-specific content -->
          <RaCard id="content" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="contentOpen">
              <div class="flex items-start justify-between gap-3 border-b border-(--line-1) py-5 px-6">
                <CollapsibleTrigger class="flex flex-1 items-start justify-between gap-3 text-left">
                  <div>
                    <h3 class="m-0 text-lg font-bold text-(--fg-1)">
                      {{ assessment.type === 'Quiz' ? 'Questions' : 'Prompt & Config' }}
                    </h3>
                    <p class="m-0 mt-1 text-xs text-(--fg-3)">
                      <template v-if="assessment.attemptCount === 0">
                        Editable — no one has attempted this assessment yet.
                      </template>
                      <template v-else>
                        Locked — {{ assessment.attemptCount }} attempt{{ assessment.attemptCount === 1 ? '' : 's' }} already
                        exist. Clone this assessment to edit its content; the original's grading history stays intact.
                      </template>
                    </p>
                  </div>
                  <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="contentOpen && 'rotate-180'" />
                </CollapsibleTrigger>
                <Button size="sm" variant="outline" :disabled="cloning" @click="submitClone">
                  <Copy :size="14" /> {{ cloning ? 'Cloning…' : 'Clone' }}
                </Button>
              </div>

              <CollapsibleContent>
                <!-- Editable while attemptCount === 0 -->
                <form v-if="assessment.attemptCount === 0" class="flex flex-col gap-4 py-5 px-6" @submit.prevent="submitContent">
                  <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                    <div class="flex flex-col gap-1.5">
                      <Label for="content-max-attempts">Max Attempts (optional)</Label>
                      <Input id="content-max-attempts" v-model="contentForm.maxAttempts" type="number" min="1" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="content-time-limit">Time Limit, min (optional)</Label>
                      <Input id="content-time-limit" v-model="contentForm.timeLimitMinutes" type="number" min="1" />
                    </div>
                  </div>

                  <template v-if="assessment.type === 'Quiz'">
                    <div class="flex flex-col gap-1.5">
                      <Label for="content-pass-mark">Pass Mark (%)</Label>
                      <Input id="content-pass-mark" v-model="contentForm.passMark" type="number" min="0" max="100" required />
                    </div>

                    <div class="flex flex-col gap-3">
                      <Label>Questions</Label>
                      <div
                        v-for="(row, index) in contentQuestionRows"
                        :key="index"
                        class="rounded-(--ra-md) border border-(--line-2) p-3"
                      >
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
                            v-if="contentQuestionRows.length > 1"
                            variant="ghost"
                            size="icon-sm"
                            type="button"
                            aria-label="Remove question"
                            @click="removeContentQuestionRow(index)"
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
                            <option v-for="qb in questionBank" :key="qb.id" :value="qb.id">{{ qb.text }}</option>
                          </select>
                        </template>
                        <template v-else>
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
                      </div>
                      <Button variant="outline" size="sm" type="button" class="self-start" @click="addContentQuestionRow">
                        <Plus :size="14" /> Add Question
                      </Button>
                    </div>
                  </template>

                  <div v-else-if="assessment.type === 'Written'" class="flex flex-col gap-1.5">
                    <Label for="content-prompt">Prompt</Label>
                    <textarea
                      id="content-prompt"
                      v-model="contentForm.prompt"
                      rows="4"
                      required
                      class="w-full resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-sans text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)"
                    />
                  </div>

                  <div v-else class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                    <div class="flex flex-col gap-1.5">
                      <Label for="content-accepted-types">Accepted Content Types (optional, comma-separated)</Label>
                      <Input id="content-accepted-types" v-model="contentForm.acceptedContentTypes" placeholder="application/pdf, image/png" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="content-max-file-size">Max File Size, bytes (optional)</Label>
                      <Input id="content-max-file-size" v-model="contentForm.maxFileSizeBytes" type="number" min="1" />
                    </div>
                  </div>

                  <div class="flex justify-end">
                    <Button type="submit" :disabled="contentSubmitting">
                      {{ contentSubmitting ? 'Saving…' : 'Save Content' }}
                    </Button>
                  </div>
                </form>

                <!-- Read-only once attemptCount > 0 -->
                <div v-else class="py-5 px-6">
                  <template v-if="assessment.type === 'Quiz'">
                    <p v-if="assessment.questions.length === 0" class="m-0 text-[13px] text-(--fg-3)">No questions.</p>
                    <div class="flex flex-col gap-4">
                      <div v-for="q in assessment.questions" :key="q.id" class="rounded-(--ra-md) border border-(--line-2) p-3">
                        <p class="m-0 text-sm font-semibold text-(--fg-1)">{{ q.order }}. {{ q.text }}</p>
                        <ul class="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                          <li
                            v-for="(option, index) in q.options"
                            :key="index"
                            class="flex items-center gap-2 text-sm"
                            :class="index === q.correctOptionIndex ? 'font-semibold text-(--success)' : 'text-(--fg-2)'"
                          >
                            <span>{{ option }}</span>
                            <RaChip v-if="index === q.correctOptionIndex" tone="info">Correct</RaChip>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <p class="m-0 mt-3 text-xs text-(--fg-4)">Pass Mark: {{ assessment.passMark }}%</p>
                  </template>
                  <template v-else-if="assessment.type === 'Written'">
                    <Label>Prompt</Label>
                    <p class="m-0 mt-1.5 text-sm text-(--fg-1) whitespace-pre-wrap">{{ assessment.prompt }}</p>
                  </template>
                  <template v-else>
                    <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                      <div class="flex flex-col gap-1.5">
                        <Label>Accepted Content Types</Label>
                        <p class="m-0 text-sm text-(--fg-1)">
                          {{ assessment.acceptedContentTypes?.length ? assessment.acceptedContentTypes.join(', ') : 'Any' }}
                        </p>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <Label>Max File Size</Label>
                        <p class="m-0 text-sm text-(--fg-1)">
                          {{ assessment.maxFileSizeBytes ? `${Math.round(assessment.maxFileSizeBytes / 1024 / 1024)} MB` : 'Unlimited' }}
                        </p>
                      </div>
                    </div>
                  </template>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </RaCard>

          <!-- Submissions -->
          <RaCard id="submissions" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="submissionsOpen">
              <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
                <div>
                  <h3 class="m-0 text-lg font-bold text-(--fg-1)">Submissions</h3>
                  <p class="m-0 mt-1 text-xs text-(--fg-3)">
                    Every attempt on this assessment.
                    <template v-if="assessment.type !== 'Quiz'"> Grade a Submitted attempt Pass/Fail below.</template>
                  </p>
                </div>
                <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="submissionsOpen && 'rotate-180'" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="grid grid-cols-[1.5fr_100px_100px_100px_100px] border-b border-(--line-1) py-3 px-6 text-xs text-(--fg-3) max-md:hidden">
                  <span>Learner</span>
                  <span>Status</span>
                  <span>Score</span>
                  <span>Passed</span>
                  <span></span>
                </div>

                <p v-if="attemptsLoading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading submissions…</p>
                <p v-else-if="attempts.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No attempts yet.</p>

                <div
                  v-for="(attempt, i) in attempts"
                  :key="attempt.id"
                  :class="['grid grid-cols-[1.5fr_100px_100px_100px_100px] items-center py-3.5 px-6 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4', i < attempts.length - 1 && 'border-b border-(--line-1)']"
                >
                  <span class="font-mono text-[13px] text-(--fg-2)">{{ attempt.userId }}</span>
                  <RaChip :tone="statusTone[attempt.status]">{{ attempt.status }}</RaChip>
                  <span class="text-sm text-(--fg-2)">{{ attempt.score ?? '—' }}</span>
                  <span class="text-sm text-(--fg-2)">
                    <template v-if="attempt.passed === null">—</template>
                    <template v-else>{{ attempt.passed ? 'Yes' : 'No' }}</template>
                  </span>
                  <Button
                    v-if="attempt.status === 'Submitted'"
                    size="sm"
                    variant="outline"
                    @click="openGrade(attempt)"
                  >
                    Grade
                  </Button>
                </div>

                <Pagination
                  :page="attemptsPage"
                  :page-size="attemptsPageSize"
                  :total-pages="attemptsTotalPages"
                  :total-count="attemptsMeta?.totalCount ?? 0"
                  @update:page="goToAttemptsPage"
                  @update:page-size="setAttemptsPageSize"
                />
              </CollapsibleContent>
            </Collapsible>
          </RaCard>
        </div>
      </div>
    </template>

    <!-- Grade dialog -->
    <Dialog :open="gradingAttempt !== null" @update:open="(v) => !v && (gradingAttempt = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grade Submission</DialogTitle>
          <DialogDescription>Only Passed matters for certification eligibility — score and feedback are for record-keeping.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitGrade">
          <div v-if="gradingAttempt?.responseText" class="flex flex-col gap-1.5">
            <Label>Response</Label>
            <p class="m-0 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) p-3 text-sm text-(--fg-1) whitespace-pre-wrap">
              {{ gradingAttempt.responseText }}
            </p>
          </div>
          <div v-if="gradingAttempt?.fileReference" class="flex flex-col gap-1.5">
            <Label>File Reference</Label>
            <p class="m-0 font-mono text-[13px] text-(--fg-2)">{{ gradingAttempt.fileReference }}</p>
          </div>

          <div class="flex gap-4 text-sm">
            <label class="flex items-center gap-1.5">
              <input v-model="gradeForm.passed" type="radio" :value="true" class="accent-(--brand-blue)"> Pass
            </label>
            <label class="flex items-center gap-1.5">
              <input v-model="gradeForm.passed" type="radio" :value="false" class="accent-(--brand-blue)"> Fail
            </label>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="grade-score">Score (optional)</Label>
            <Input id="grade-score" v-model="gradeForm.score" type="number" min="0" max="100" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="grade-feedback">Feedback (optional)</Label>
            <textarea
              id="grade-feedback"
              v-model="gradeForm.feedback"
              rows="3"
              class="w-full resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-sans text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="gradingAttempt = null">Cancel</Button>
            <Button type="submit" :disabled="gradeSubmitting">
              {{ gradeSubmitting ? 'Saving…' : 'Save Grade' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
