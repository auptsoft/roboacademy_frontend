<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import Pagination from '@/components/Pagination.vue'
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import { listAttempts, gradeAttempt, type AttemptItem } from '@/api/assessment'

const router = useRouter()

const {
  items: attempts,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList(
  (page, pageSize) => listAttempts({ status: 'Submitted' }, page, pageSize),
  { initialPageSize: 20, errorMessage: 'Failed to load the grading queue.' },
)

onMounted(load)

function openAssessment(assessmentId: string) {
  router.push(`/assessment/assessments/${assessmentId}`)
}

const rowClass =
  'grid grid-cols-[2fr_100px_1.5fr_120px] items-center py-3.5 px-6 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

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
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to grade attempt.')
  } finally {
    gradeSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Grading Queue</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Every Submitted Written or File Submission attempt awaiting grading, across every assessment.
      </p>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="grid grid-cols-[2fr_100px_1.5fr_120px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Assessment</span>
        <span>Type</span>
        <span>Learner</span>
        <span></span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading grading queue…</p>
      <p v-else-if="attempts.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
        Nothing pending — every submission has been graded.
      </p>

      <div
        v-for="(attempt, i) in attempts"
        :key="attempt.id"
        :class="[rowClass, i < attempts.length - 1 && 'border-b border-(--line-1)']"
      >
        <button
          type="button"
          class="bg-transparent border-0 p-0 cursor-pointer text-left text-sm font-semibold text-(--fg-1) underline-offset-2 hover:underline"
          @click="openAssessment(attempt.assessmentId)"
        >
          {{ attempt.assessmentTitle }}
        </button>
        <div><RaChip tone="neutral">{{ attempt.assessmentType }}</RaChip></div>
        <div class="font-mono text-[13px] text-(--fg-2)">{{ attempt.userId }}</div>
        <Button size="sm" variant="outline" @click="openGrade(attempt)">Grade</Button>
      </div>

      <Pagination
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-count="meta?.totalCount ?? 0"
        @update:page="goToPage"
        @update:page-size="setPageSize"
      />
    </RaCard>

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
