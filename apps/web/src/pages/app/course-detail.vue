<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RaChip, RaProgress, RaCard, RaButton } from '@roboacademy/ui'
import {
  CheckCircle2, PlayCircle, Lock, ChevronRight, ChevronDown, Layers, List,
  Loader2, AlertTriangle, Compass, ArrowRight, ExternalLink,
  Video, BookOpen, Puzzle, Cpu, FileText,
  ClipboardCheck, PenLine, UploadCloud, Paperclip,
} from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { getCourse, getCourseResumePoint, recordLessonProgress, getLessonPlaybackUrl, combinedProgressPercent, type CourseDetail, type CourseLessonDetail, type CourseResumePoint } from '@/api/learning'
import { getLabSession, requestLabSession } from '@/api/robotics-lab'
import SimulationFrame from '@/components/simulation/SimulationFrame.vue'
import {
  listModuleAssessments, getAssessment, listMyAttempts, startAttempt, submitAttempt, getAttemptFileUploadUrl,
  type AssessmentSummary, type AssessmentDetail, type AttemptSummary,
} from '@/api/assessment'

const route = useRoute()
const router = useRouter()
const showCurriculum = ref(false)

const lessonTypeIcon = { Video, Reading: BookOpen, Interactive: Puzzle, Simulation: Cpu, Pdf: FileText } as const
const assessmentTypeIcon = { Quiz: ClipboardCheck, Written: PenLine, FileSubmission: UploadCloud } as const

const status = ref<'loading' | 'idle' | 'error' | 'not-found'>('loading')
const errorMessage = ref('')
const course = ref<CourseDetail | null>(null)
const resume = ref<CourseResumePoint | null>(null)
const assessmentsByModule = ref<Map<string, AssessmentSummary[]>>(new Map())

type SelectedItem = { kind: 'lesson'; id: string } | { kind: 'assessment'; id: string }
const selectedItem = ref<SelectedItem | null>(null)

const completeState = ref<'idle' | 'saving' | 'error'>('idle')
const completeError = ref('')

const expandedModuleIds = ref<Set<string>>(new Set())

function toggleModule(moduleId: string) {
  const next = new Set(expandedModuleIds.value)
  if (next.has(moduleId)) next.delete(moduleId)
  else next.add(moduleId)
  expandedModuleIds.value = next
}

async function load() {
  status.value = 'loading'
  errorMessage.value = ''
  selectedItem.value = null
  assessmentsByModule.value = new Map()
  try {
    const courseId = route.params.id as string
    const [courseResult, resumeResult] = await Promise.all([
      getCourse(courseId),
      getCourseResumePoint(courseId),
    ])
    course.value = courseResult
    resume.value = resumeResult
    expandedModuleIds.value = new Set(courseResult.modules.map(m => m.id))
    status.value = 'idle'

    // Assessments are supplementary — tolerate per-module failures rather than blocking the
    // lesson player if one module's assessment list can't be fetched.
    const assessmentEntries = await Promise.all(
      courseResult.modules.map(async (mod): Promise<[string, AssessmentSummary[]]> => [
        mod.id,
        await listModuleAssessments(mod.id).catch(() => []),
      ]),
    )
    assessmentsByModule.value = new Map(assessmentEntries)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      status.value = 'not-found'
    } else {
      status.value = 'error'
      errorMessage.value = err instanceof ApiError ? err.message : 'Something went wrong.'
    }
  }
}

type ModuleItem =
  | { kind: 'lesson'; order: number; lesson: CourseLessonDetail }
  | { kind: 'assessment'; order: number; assessment: AssessmentSummary }

const moduleItems = computed<Map<string, ModuleItem[]>>(() => {
  const map = new Map<string, ModuleItem[]>()
  if (!course.value) return map
  for (const mod of course.value.modules) {
    const items: ModuleItem[] = [
      ...mod.lessons.map(lesson => ({ kind: 'lesson' as const, order: lesson.order, lesson })),
      ...(assessmentsByModule.value.get(mod.id) ?? []).map(assessment => ({ kind: 'assessment' as const, order: assessment.order, assessment })),
    ]
    items.sort((a, b) => a.order - b.order)
    map.set(mod.id, items)
  }
  return map
})

interface FlatLesson { lesson: CourseLessonDetail; moduleId: string; moduleTitle: string; index: number }

const flatLessons = computed<FlatLesson[]>(() => {
  if (!course.value) return []
  const result: FlatLesson[] = []
  for (const mod of course.value.modules) {
    for (const lesson of mod.lessons) {
      result.push({ lesson, moduleId: mod.id, moduleTitle: mod.title, index: result.length })
    }
  }
  return result
})

type LessonState = 'done' | 'active' | 'locked'

function lessonState(lessonId: string): LessonState {
  if (!resume.value) return 'locked'
  if (resume.value.courseCompleted) return 'done'
  if (lessonId === resume.value.nextLessonId) return 'active'
  const flatIds = flatLessons.value.map(f => f.lesson.id)
  const nextIndex = resume.value.nextLessonId ? flatIds.indexOf(resume.value.nextLessonId) : -1
  const thisIndex = flatIds.indexOf(lessonId)
  if (nextIndex === -1) return 'done'
  return thisIndex < nextIndex ? 'done' : 'locked'
}

const contentKind = computed<'lesson' | 'assessment'>(() => selectedItem.value?.kind === 'assessment' ? 'assessment' : 'lesson')

const selectedFlat = computed(() => {
  if (!flatLessons.value.length) return null
  if (selectedItem.value?.kind === 'lesson') {
    const found = flatLessons.value.find(f => f.lesson.id === selectedItem.value!.id)
    if (found) return found
  } else if (selectedItem.value?.kind === 'assessment') {
    return null
  }
  const active = flatLessons.value.find(f => lessonState(f.lesson.id) === 'active')
  if (active) return active
  return flatLessons.value[flatLessons.value.length - 1]
})

const selectedState = computed(() => selectedFlat.value ? lessonState(selectedFlat.value.lesson.id) : 'locked')

function findAssessmentContext(assessmentId: string): { summary: AssessmentSummary; moduleTitle: string } | null {
  if (!course.value) return null
  for (const mod of course.value.modules) {
    const found = assessmentsByModule.value.get(mod.id)?.find(a => a.id === assessmentId)
    if (found) return { summary: found, moduleTitle: mod.title }
  }
  return null
}

const selectedAssessmentContext = computed(() => {
  if (selectedItem.value?.kind !== 'assessment') return null
  return findAssessmentContext(selectedItem.value.id)
})

const progressPercent = computed(() => resume.value ? combinedProgressPercent(resume.value) : 0)

function selectLesson(lessonId: string) {
  if (lessonState(lessonId) === 'locked') return
  selectedItem.value = { kind: 'lesson', id: lessonId }
}

function lessonNumber(lessonId: string): number {
  return flatLessons.value.findIndex(f => f.lesson.id === lessonId) + 1
}

async function markComplete() {
  if (!course.value || !selectedFlat.value) return
  completeState.value = 'saving'
  completeError.value = ''
  try {
    await recordLessonProgress(course.value.id, [selectedFlat.value.lesson.id])
    resume.value = await getCourseResumePoint(course.value.id)
    selectedItem.value = resume.value.nextLessonId ? { kind: 'lesson', id: resume.value.nextLessonId } : null
    completeState.value = 'idle'
  } catch (err) {
    completeState.value = 'error'
    completeError.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  }
}

// ── Simulation lessons ───────────────────────────────────────────────────────
//
// A simulation lesson is completed by passing it, not by self-reporting. The engine submits its
// result to the simulation service, which notifies this backend over its own channel; that path
// records the lesson. We deliberately never call recordLessonProgress here - doing so would let
// any client claim a pass without running anything.

const simFrame = ref<InstanceType<typeof SimulationFrame> | null>(null)
const simSessionId = ref<string | null>(null)
const simState = ref<'idle' | 'opening' | 'ready' | 'submitting' | 'recording' | 'error'>('idle')
const simError = ref('')
const simResult = ref<{ score: number; passed: boolean } | null>(null)

// Lesson types arrive from the backend enum in PascalCase, but have been compared both ways in
// this file's template. Normalise once so every branch of the content dispatch agrees.
const lessonType = computed(() => selectedFlat.value?.lesson.type?.toLowerCase() ?? '')

const isSimulationLesson = computed(() => lessonType.value === 'simulation')

const simButtonLabel = computed(() => {
  if (simState.value === 'submitting') return 'Submitting…'
  if (simState.value === 'recording') return 'Recording result…'
  return simResult.value && !simResult.value.passed ? 'Submit again' : 'Submit for grading'
})

async function openSimulation() {
  if (!course.value || !selectedFlat.value) return
  simState.value = 'opening'
  simError.value = ''
  simResult.value = null
  simSessionId.value = null
  try {
    // Simulation sessions are provisioned and scheduled in this one call, so the returned id
    // can be joined immediately.
    const session = await requestLabSession({
      courseId: course.value.id,
      lessonId: selectedFlat.value.lesson.id,
      mode: 'Simulation',
    })
    simSessionId.value = session.id
    simState.value = 'ready'
  } catch (err) {
    simState.value = 'error'
    simError.value = err instanceof ApiError ? err.message : 'This simulation could not be opened.'
  }
}

function submitSimulation() {
  simState.value = 'submitting'
  simError.value = ''
  simFrame.value?.requestSubmit()
}

/**
 * The engine's `graded` message is optimistic UI only. The authoritative record arrives
 * asynchronously via the simulation service, so poll the session until the backend agrees
 * before refreshing progress.
 */
async function onSimulationGraded(result: { score: number; passed: boolean }) {
  simResult.value = result
  if (!result.passed) {
    simState.value = 'ready'
    return
  }

  simState.value = 'recording'
  const sessionId = simSessionId.value
  if (!sessionId || !course.value) return

  const deadline = Date.now() + 15_000
  let delay = 500
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, delay))
    delay = Math.min(delay * 2, 4_000)
    try {
      const session = await getLabSession(sessionId)
      if (session.status === 'Completed') {
        resume.value = await getCourseResumePoint(course.value.id)
        simState.value = 'ready'
        return
      }
    } catch {
      // Keep polling: a transient read failure is not a grading failure.
    }
  }

  // The result is stored on the simulation service either way, so this is a delay, not a loss.
  simState.value = 'ready'
  simError.value = 'Your result is being recorded and will appear shortly.'
}

function onSimulationError(error: { code: string; message: string; recoverable: boolean }) {
  simState.value = error.recoverable ? 'ready' : 'error'
  simError.value = error.message
}

// Opening a different lesson tears the frame down and books a fresh session. Destroying the
// iframe is the teardown: it frees the WebGL context, physics heap and socket in one step.
watch(
  () => selectedFlat.value?.lesson.id,
  () => {
    simSessionId.value = null
    simResult.value = null
    simError.value = ''
    simState.value = 'idle'
    if (isSimulationLesson.value) void openSimulation()
  },
)

const videoState = ref<'idle' | 'loading' | 'playing' | 'error'>('idle')
const videoUrl = ref<string | null>(null)
const videoError = ref('')

async function playLessonVideo() {
  if (!course.value || !selectedFlat.value) return
  videoState.value = 'loading'
  videoError.value = ''
  try {
    const result = await getLessonPlaybackUrl(course.value.id, selectedFlat.value.moduleId, selectedFlat.value.lesson.id)
    videoUrl.value = result.url
    videoState.value = 'playing'
  } catch (err) {
    videoState.value = 'error'
    videoError.value = err instanceof ApiError ? err.message : 'Unable to load video.'
  }
}

const openContentState = ref<'idle' | 'loading' | 'error'>('idle')
const openContentError = ref('')

async function openLessonContent() {
  if (!course.value || !selectedFlat.value) return
  openContentState.value = 'loading'
  openContentError.value = ''
  try {
    const result = await getLessonPlaybackUrl(course.value.id, selectedFlat.value.moduleId, selectedFlat.value.lesson.id)
    window.open(result.url, '_blank', 'noopener')
    openContentState.value = 'idle'
  } catch (err) {
    openContentState.value = 'error'
    openContentError.value = err instanceof ApiError ? err.message : 'Unable to open content.'
  }
}


const openPdfState = ref<'idle' | 'loading' | 'error' | 'open'>('idle')
const openPdfError = ref('')
const pdfUrl = ref<string | null>(null);
async function openPdf() {
  if (!course.value || !selectedFlat.value) return
  openPdfState.value = 'loading'
  pdfUrl.value = null
  try {
    const result = await getLessonPlaybackUrl(course.value.id, selectedFlat.value.moduleId, selectedFlat.value.lesson.id)
    pdfUrl.value = result.url
    openPdfState.value = 'open'
  } catch (err) {
    openPdfState.value = 'error'
    pdfUrl.value = null
    openPdfError.value = err instanceof ApiError ? err.message : 'Unable to open PDF.'
  }
}

watch(selectedItem, () => {
  videoState.value = 'idle'
  videoUrl.value = null
  videoError.value = ''
  openContentState.value = 'idle'
  openContentError.value = ''
  openPdfState.value = 'idle'
  openPdfError.value = ''
  pdfUrl.value = null
})

const assessmentDetailState = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')
const assessmentDetailError = ref('')
const assessmentDetail = ref<AssessmentDetail | null>(null)

const myAttempts = ref<AttemptSummary[]>([])
const currentAttempt = computed(() => myAttempts.value[0] ?? null)
const attemptsRemaining = computed(() => {
  const max = assessmentDetail.value?.maxAttempts
  if (max == null) return null
  return Math.max(0, max - myAttempts.value.length)
})
const canStartAttempt = computed(() => attemptsRemaining.value === null || attemptsRemaining.value > 0)
const attemptIsLive = computed(() => {
  const attempt = currentAttempt.value
  if (!attempt || attempt.status !== 'InProgress') return false
  return !attempt.expiresAt || new Date(attempt.expiresAt).getTime() > Date.now()
})

const quizAnswers = ref<(number | null)[]>([])
const writtenResponse = ref('')
const selectedFile = ref<File | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)

function resetAnswerState() {
  quizAnswers.value = assessmentDetail.value ? assessmentDetail.value.questions.map(() => null) : []
  writtenResponse.value = ''
  selectedFile.value = null
}

async function refreshMyAttempts(assessmentId: string) {
  myAttempts.value = await listMyAttempts(assessmentId)
}

async function loadAssessmentDetail(assessmentId: string) {
  assessmentDetailState.value = 'loading'
  assessmentDetailError.value = ''
  assessmentDetail.value = null
  myAttempts.value = []
  startState.value = 'idle'
  startError.value = ''
  submitState.value = 'idle'
  submitError.value = ''
  try {
    const [detail, attempts] = await Promise.all([
      getAssessment(assessmentId),
      listMyAttempts(assessmentId).catch(() => []),
    ])
    assessmentDetail.value = detail
    myAttempts.value = attempts
    resetAnswerState()
    assessmentDetailState.value = 'loaded'
  } catch (err) {
    assessmentDetailState.value = 'error'
    assessmentDetailError.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  }
}

function selectAssessment(assessmentId: string) {
  selectedItem.value = { kind: 'assessment', id: assessmentId }
  loadAssessmentDetail(assessmentId)
}

const startState = ref<'idle' | 'starting' | 'error'>('idle')
const startError = ref('')

async function startAttemptFlow() {
  if (!selectedAssessmentContext.value) return
  startState.value = 'starting'
  startError.value = ''
  try {
    const assessmentId = selectedAssessmentContext.value.summary.id
    await startAttempt(assessmentId)
    await refreshMyAttempts(assessmentId)
    resetAnswerState()
    startState.value = 'idle'
  } catch (err) {
    startState.value = 'error'
    startError.value = err instanceof ApiError ? err.message : 'Unable to start attempt.'
  }
}

const submitState = ref<'idle' | 'submitting' | 'error'>('idle')
const submitError = ref('')
const uploadState = ref<'idle' | 'uploading'>('idle')

function pickFile() {
  fileInputEl.value?.click()
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
}

async function submitCurrentAttempt() {
  if (!currentAttempt.value || !assessmentDetail.value || !selectedAssessmentContext.value) return

  if (assessmentDetail.value.type === 'Quiz' && quizAnswers.value.some(a => a === null)) {
    submitState.value = 'error'
    submitError.value = 'Answer every question before submitting.'
    return
  }
  if (assessmentDetail.value.type === 'Written' && !writtenResponse.value.trim()) {
    submitState.value = 'error'
    submitError.value = 'Write a response before submitting.'
    return
  }
  if (assessmentDetail.value.type === 'FileSubmission' && !selectedFile.value) {
    submitState.value = 'error'
    submitError.value = 'Select a file before submitting.'
    return
  }

  submitState.value = 'submitting'
  submitError.value = ''
  try {
    const attemptId = currentAttempt.value.id
    const assessmentId = selectedAssessmentContext.value.summary.id
    if (assessmentDetail.value.type === 'Quiz') {
      await submitAttempt(attemptId, { answers: quizAnswers.value as number[] })
    } else if (assessmentDetail.value.type === 'Written') {
      await submitAttempt(attemptId, { responseText: writtenResponse.value })
    } else {
      const file = selectedFile.value!
      uploadState.value = 'uploading'
      const { uploadUrl, objectKey } = await getAttemptFileUploadUrl(attemptId, file.type || 'application/octet-stream', file.name)
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } })
      uploadState.value = 'idle'
      await submitAttempt(attemptId, { fileReference: objectKey })
    }
    await refreshMyAttempts(assessmentId)
    submitState.value = 'idle'
  } catch (err) {
    uploadState.value = 'idle'
    submitState.value = 'error'
    submitError.value = err instanceof ApiError ? err.message : 'Unable to submit attempt.'
  }
}

watch(selectedItem, () => {
  videoState.value = 'idle'
  videoUrl.value = null
  videoError.value = ''
  openContentState.value = 'idle'
  openContentError.value = ''
})

watch(() => route.params.id, load, { immediate: true })
</script>

<template>
  <div v-if="status === 'loading'" class="flex flex-col items-center gap-3 py-24 text-center">
    <Loader2 :size="22" class="animate-spin text-(--fg-4)" />
    <p class="m-0 text-[13px] text-(--fg-3)">Loading course…</p>
  </div>

  <div v-else-if="status === 'not-found'" class="flex flex-col items-center gap-3 py-24 text-center">
    <div class="w-12 h-12 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-4)"><Compass :size="22" /></div>
    <div class="text-sm font-semibold text-(--fg-1)">Course not found</div>
    <p class="m-0 text-[13px] text-(--fg-3) max-w-80">This course may have been removed, or the link is incorrect.</p>
    <RaButton variant="secondary" @click="router.push('/app/courses')">Back to Courses</RaButton>
  </div>

  <div v-else-if="status === 'error'" class="flex flex-col items-center gap-3 py-24 text-center">
    <div class="w-12 h-12 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="22" /></div>
    <div class="text-sm font-semibold text-(--fg-1)">Something went wrong</div>
    <p class="m-0 text-[13px] text-(--fg-3) max-w-80">{{ errorMessage }}</p>
    <RaButton variant="secondary" @click="load">Try again</RaButton>
  </div>

  <div v-else-if="course && resume" class="flex h-[calc(100vh-var(--topbar-h)-49px)] overflow-hidden max-md:block max-md:h-auto max-md:overflow-visible">
    <!-- Left: curriculum -->
    <div
      class="hidden fixed inset-0 bg-black/50 z-[39] opacity-0 transition-opacity duration-(--dur-2) ease-(--ease-out) pointer-events-none"
      :class="showCurriculum && 'max-md:block max-md:opacity-100 max-md:pointer-events-auto'"
      @click="showCurriculum = false"
    />
    <div
      class="w-80 shrink-0 border-r border-(--line-1) flex flex-col overflow-hidden max-md:fixed max-md:top-0 max-md:bottom-0 max-md:left-0 max-md:w-[85%] max-md:max-w-80 max-md:z-40 max-md:bg-(--bg-0) max-md:border-r max-md:border-(--line-1) max-md:transition-transform max-md:duration-(--dur-2) max-md:ease-(--ease-out)"
      :class="showCurriculum ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'"
    >
      <div class="px-4.5 py-5 border-b border-(--line-1) shrink-0">
        <div class="flex justify-between items-center mb-1">
          <span class="text-[15px] font-bold text-(--fg-1)">Course Curriculum</span>
          <RaChip tone="overlay">{{ flatLessons.length ? (flatLessons.findIndex(f => f.lesson.id === selectedFlat?.lesson.id) + 1) : 0 }}/{{ flatLessons.length }}</RaChip>
        </div>
        <p class="m-0 text-xs text-(--fg-3)">{{ course.title }}</p>
      </div>

      <div class="flex-1 overflow-y-auto px-2 py-2.5 flex flex-col gap-3">
        <div v-for="mod in course.modules" :key="mod.id" class="flex flex-col gap-1">
          <button
            class="flex items-center justify-between gap-2 px-3.5 pt-1.5 pb-1 bg-transparent border-0 cursor-pointer text-left"
            @click="toggleModule(mod.id)"
          >
            <span class="text-[11px] font-bold uppercase tracking-wide text-(--fg-4)">
              {{ String(mod.order).padStart(2, '0') }}. {{ mod.title }}
            </span>
            <ChevronDown
              :size="13"
              class="text-(--fg-4) shrink-0 transition-transform duration-(--dur-1) ease-(--ease-out)"
              :class="!expandedModuleIds.has(mod.id) && '-rotate-90'"
            />
          </button>
          <template v-for="item in (moduleItems.get(mod.id) ?? [])" :key="item.kind + '-' + (item.kind === 'lesson' ? item.lesson.id : item.assessment.id)">
            <div
              v-if="item.kind === 'lesson'"
              v-show="expandedModuleIds.has(mod.id)"
              class="py-3 px-3.5 rounded-(--ra-md) border-l-2 border-transparent transition-colors duration-(--dur-1) ease-(--ease-out)"
              :class="[
                lessonState(item.lesson.id) === 'locked' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-(--bg-3)',
                item.lesson.id === selectedFlat?.lesson.id && 'bg-[rgba(59,130,246,0.08)] border-l-(--brand-blue)',
              ]"
              @click="selectLesson(item.lesson.id)"
            >
              <div class="flex items-center gap-2.5">
                <CheckCircle2 v-if="lessonState(item.lesson.id) === 'done'"        :size="16" class="text-(--success) shrink-0" />
                <PlayCircle   v-else-if="lessonState(item.lesson.id) === 'active'" :size="16" class="text-(--brand-blue) shrink-0" />
                <Lock         v-else                                          :size="16" class="text-(--fg-4) shrink-0" />
                <span
                  class="text-[13px] font-medium"
                  :class="item.lesson.id === selectedFlat?.lesson.id ? 'text-(--fg-1) font-semibold' : 'text-(--fg-2)'"
                >
                  {{ String(lessonNumber(item.lesson.id)).padStart(2, '0') }}. {{ item.lesson.title }}
                </span>
              </div>
              <div class="flex gap-2.5 mt-1.5 ml-6.5 text-[11px] text-(--fg-4)">
                <span class="inline-flex items-center gap-1"><component :is="lessonTypeIcon[item.lesson.type]" :size="11" /> {{ item.lesson.type.toUpperCase() }}</span>
                <span v-if="!item.lesson.isRequired">Optional</span>
              </div>
            </div>

            <div
              v-else
              v-show="expandedModuleIds.has(mod.id)"
              class="py-3 px-3.5 rounded-(--ra-md) border-l-2 border-transparent cursor-pointer transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--bg-3)"
              :class="selectedItem?.kind === 'assessment' && selectedItem.id === item.assessment.id && 'bg-[rgba(59,130,246,0.08)] border-l-(--brand-blue)'"
              @click="selectAssessment(item.assessment.id)"
            >
              <div class="flex items-center gap-2.5">
                <CheckCircle2 v-if="item.assessment.passed" :size="16" class="text-(--success) shrink-0" />
                <component :is="assessmentTypeIcon[item.assessment.type]" v-else :size="16" class="text-(--fg-4) shrink-0" />
                <span
                  class="text-[13px] font-medium"
                  :class="selectedItem?.kind === 'assessment' && selectedItem.id === item.assessment.id ? 'text-(--fg-1) font-semibold' : 'text-(--fg-2)'"
                >
                  {{ item.assessment.title }}
                </span>
              </div>
              <div class="flex gap-2.5 mt-1.5 ml-6.5 text-[11px] text-(--fg-4)">
                <span v-if="item.assessment.type === 'Quiz'">{{ item.assessment.questionCount }} questions</span>
                <span v-else-if="item.assessment.type === 'Written'">Written response</span>
                <span v-else>File submission</span>
                <span v-if="!item.assessment.isRequired">Optional</span>
              </div>
            </div>
          </template>
          <p v-if="!(moduleItems.get(mod.id) ?? []).length" v-show="expandedModuleIds.has(mod.id)" class="px-3.5 py-2 m-0 text-[13px] text-(--fg-3)">No lessons in this module yet.</p>
        </div>
        <p v-if="!flatLessons.length" class="px-3.5 py-3 m-0 text-[13px] text-(--fg-3)">No lessons in this course yet.</p>
      </div>

      <div class="px-4.5 py-3.5 border-t border-(--line-1) shrink-0">
        <div class="flex justify-between text-xs text-(--fg-3) mb-1.5">
          <span>Course Progress</span>
          <span class="text-(--fg-1) font-semibold">{{ progressPercent }}%</span>
        </div>
        <RaProgress :value="progressPercent" />
        <p class="mt-1.5 mb-0 text-[11px] text-(--fg-4)">
          {{ resume.completedLessons }}/{{ resume.totalLessons }} required lessons
          <template v-if="resume.totalAssessments > 0"> · {{ resume.completedAssessments }}/{{ resume.totalAssessments }} required assessments</template>
        </p>
      </div>
    </div>

    <!-- Right: lesson body -->
    <div class="flex-1 overflow-y-auto px-12 pt-8 pb-12 max-md:px-4 max-md:pt-5 max-md:pb-8">
      <button
        class="hidden items-center gap-2 mb-4 py-2 px-3.5 rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) text-(--fg-2) text-[13px] font-semibold cursor-pointer max-md:inline-flex"
        @click="showCurriculum = true"
      >
        <List :size="14" /> Curriculum
      </button>
      <div class="flex items-center gap-2 text-[13px] text-(--fg-3) mb-3.5">
        <button class="bg-transparent border-0 p-0 cursor-pointer text-(--fg-3) hover:text-(--fg-1)" @click="router.push('/app/courses')">Courses</button>
        <ChevronRight :size="12" />
        <span>{{ course.title }}</span>
        <template v-if="contentKind === 'lesson' && selectedFlat">
          <ChevronRight :size="12" />
          <span class="text-(--fg-1)">Lesson {{ selectedFlat.index + 1 }}</span>
        </template>
        <template v-else-if="contentKind === 'assessment'">
          <ChevronRight :size="12" />
          <span class="text-(--fg-1)">Assessment</span>
        </template>
      </div>

      <template v-if="contentKind === 'lesson' && selectedFlat">
        <div class="flex items-center gap-3 mb-3">
          <RaChip tone="info">{{ selectedFlat.moduleTitle }}</RaChip>
          <span v-if="course.level" class="inline-flex items-center gap-1.5 text-xs text-(--fg-3)"><Layers :size="12" /> {{ course.level }}</span>
          <RaChip :tone="selectedFlat.lesson.isRequired ? 'student' : 'neutral'">{{ selectedFlat.lesson.isRequired ? 'Required' : 'Optional' }}</RaChip>
        </div>

        <h1 class="m-0 text-[32px] font-bold text-(--fg-1) tracking-[-0.01em]">{{ String(selectedFlat.index + 1).padStart(2, '0') }}. {{ selectedFlat.lesson.title }}</h1>

        <hr class="my-8 border-0 border-t border-(--line-1)" />

        <div v-if="selectedFlat.lesson.context" class="text-(--fg-2) leading-[1.7]" v-html="selectedFlat.lesson.context"></div>

        <!--
          Simulation is checked first on purpose. A simulation lesson carries its scene id in
          contentReference, so any generic contentReference branch placed above this one would
          swallow it and offer an "Open Content" link to a scene id instead of running the lesson.
        -->
        <template v-if="isSimulationLesson">
          <SimulationFrame
            v-if="simSessionId"
            ref="simFrame"
            :key="simSessionId"
            :session-id="simSessionId"
            mode="graded"
            height="min(70vh, 620px)"
            class="mt-6"
            @graded="onSimulationGraded"
            @frame-error="onSimulationError"
          />
          <RaCard v-else :padding="28" class="text-center mt-6">
            <div class="text-sm font-semibold text-(--fg-1) mb-2">
              {{ simState === 'error' ? 'This simulation could not be opened' : 'Preparing your simulation…' }}
            </div>
            <p v-if="simError" class="m-0 text-[13px] text-(--danger) max-w-120 mx-auto">{{ simError }}</p>
            <RaButton v-if="simState === 'error'" variant="secondary" class="mt-3" @click="openSimulation">Try again</RaButton>
          </RaCard>
        </template>

        <div v-else-if="lessonType === 'video' && selectedFlat.lesson.contentReference" class="mt-6">
          <div v-if="videoState === 'playing' && videoUrl" class="rounded-(--ra-xl) border border-(--line-1) overflow-hidden bg-black">
            <video :src="videoUrl" controls autoplay class="block w-full h-auto max-h-[70vh] mx-auto" />
          </div>
          <RaCard v-else :padding="28" class="text-center aspect-video flex flex-col items-center justify-center mt-6">
            <button
              class="w-14 h-14 rounded-full bg-(--bg-3) border border-(--line-1) flex items-center justify-center mx-auto cursor-pointer"
              :disabled="videoState === 'loading'"
              @click="playLessonVideo"
            >
              <Loader2 v-if="videoState === 'loading'" :size="22" class="animate-spin text-(--fg-3)" />
              <PlayCircle v-else :size="22" class="text-(--fg-2)" />
            </button>
            <p class="mt-3 mb-0 text-[13px] text-(--fg-3)">Play video lesson</p>
          </RaCard>
          <p v-if="videoState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ videoError }}</p>
        </div>

        <RaCard v-else-if="lessonType === 'pdf' && selectedFlat.lesson.contentReference" :padding="0" class="text-center mt-6">
          <template v-if="openPdfState != 'open'">
            <div class="text-sm mt-8 font-semibold text-(--fg-1) mb-2">This lesson includes {{ selectedFlat.lesson.type.toLowerCase() }} content</div>
            <RaButton class="mb-8"  variant="secondary" :disabled="openPdfState === 'loading'" @click="openPdf">
              {{ openPdfState === 'loading' ? 'Opening…' : 'Open Content' }}
              <template #icon-right>
                <Loader2 v-if="openPdfState === 'loading'" :size="14" class="animate-spin" />
                <ExternalLink v-else :size="14" />
              </template>
            </RaButton>
          </template>
          <p v-if="openPdfState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ openPdfError }}</p>
          <iframe v-if="openPdfState == 'open' && pdfUrl" :src="pdfUrl" class="w-full h-[calc(100vh-200px)]  rounded-lg" />
        </RaCard>

        <RaCard v-else-if="selectedFlat.lesson.contentReference" :padding="28" class="text-center mt-6">
          <div class="text-sm font-semibold text-(--fg-1) mb-2">This lesson includes {{ selectedFlat.lesson.type.toLowerCase() }} content</div>
          <RaButton variant="secondary" :disabled="openContentState === 'loading'" @click="openLessonContent">
            {{ openContentState === 'loading' ? 'Opening…' : 'Open Content' }}
            <template #icon-right>
              <Loader2 v-if="openContentState === 'loading'" :size="14" class="animate-spin" />
              <ExternalLink v-else :size="14" />
            </template>
          </RaButton>
          <p v-if="openContentState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ openContentError }}</p>
        </RaCard>

        <RaCard v-else-if="!selectedFlat.lesson.contentReference && !selectedFlat.lesson.context" :padding="28" class="text-center mt-6">
          <div class="text-sm font-semibold text-(--fg-1) mb-2">Content isn't available yet</div>
          <p class="m-0 text-[13px] text-(--fg-3) max-w-120 mx-auto">This lesson's {{ selectedFlat.lesson.type.toLowerCase() }} content will be available once delivery is set up.</p>
        </RaCard>

        <div class="mt-8">
          <RaChip v-if="selectedState === 'done'" tone="student" class="py-2.5! px-4!">Completed</RaChip>
          <!--
            A simulation lesson is completed by passing it, not by self-reporting. The engine
            reports its result to the simulation service, which tells this backend over its own
            channel; the button below only asks the engine to submit.
          -->
          <template v-else-if="isSimulationLesson">
            <div v-if="simSessionId">
              <RaButton :disabled="simState === 'submitting' || simState === 'recording'" @click="submitSimulation">
                {{ simButtonLabel }}
                <template #icon-right>
                  <Loader2 v-if="simState === 'submitting' || simState === 'recording'" :size="14" class="animate-spin" />
                  <ArrowRight v-else :size="14" />
                </template>
              </RaButton>
              <p v-if="simResult" class="mt-2 mb-0 text-xs" :class="simResult.passed ? 'text-(--success)' : 'text-(--danger)'">
                Scored {{ simResult.score }}% &mdash; {{ simResult.passed ? 'passed' : 'not passed yet, try again' }}.
              </p>
              <p v-if="simError" class="mt-2 mb-0 text-xs text-(--danger)">{{ simError }}</p>
            </div>
            <p v-else class="m-0 text-[13px] text-(--fg-3)">This simulation will be gradable once it opens.</p>
          </template>
          <template v-else-if="selectedState === 'active'">
            <RaButton :disabled="completeState === 'saving'" @click="markComplete">
              {{ completeState === 'saving' ? 'Saving…' : 'Mark Complete & Continue' }}
              <template #icon-right>
                <Loader2 v-if="completeState === 'saving'" :size="14" class="animate-spin" />
                <ArrowRight v-else :size="14" />
              </template>
            </RaButton>
            <p v-if="completeState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ completeError }}</p>
          </template>
        </div>
      </template>

      <template v-else-if="contentKind === 'assessment' && selectedAssessmentContext">
        <div class="flex items-center gap-3 mb-3">
          <RaChip tone="info">{{ selectedAssessmentContext.moduleTitle }}</RaChip>
          <RaChip :tone="selectedAssessmentContext.summary.isRequired ? 'student' : 'neutral'">{{ selectedAssessmentContext.summary.isRequired ? 'Required' : 'Optional' }}</RaChip>
        </div>

        <h1 class="m-0 text-[32px] font-bold text-(--fg-1) tracking-[-0.01em]">{{ selectedAssessmentContext.summary.title }}</h1>

        <hr class="my-8 border-0 border-t border-(--line-1)" />

        <div v-if="assessmentDetailState === 'loading'" class="flex flex-col items-center gap-3 py-16 text-center">
          <Loader2 :size="20" class="animate-spin text-(--fg-4)" />
          <p class="m-0 text-[13px] text-(--fg-3)">Loading assessment…</p>
        </div>

        <div v-else-if="assessmentDetailState === 'error'" class="flex flex-col items-center gap-3 py-16 text-center">
          <div class="w-12 h-12 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="20" /></div>
          <p class="m-0 text-[13px] text-(--fg-3)">{{ assessmentDetailError }}</p>
          <RaButton variant="secondary" @click="loadAssessmentDetail(selectedAssessmentContext.summary.id)">Try again</RaButton>
        </div>

        <template v-else-if="assessmentDetail">
          <p v-if="assessmentDetail.preText" class="text-(--fg-2) leading-[1.7]">{{ assessmentDetail.preText }}</p>

          <div class="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-(--fg-4) mb-5">
            <span v-if="assessmentDetail.maxAttempts != null">Attempts: {{ myAttempts.length }}/{{ assessmentDetail.maxAttempts }}</span>
            <span v-if="assessmentDetail.timeLimitMinutes != null">Time limit: {{ assessmentDetail.timeLimitMinutes }} min</span>
            <span v-if="assessmentDetail.passMark != null">Pass mark: {{ assessmentDetail.passMark }}%</span>
          </div>

          <!-- Graded: show the result -->
          <RaCard v-if="currentAttempt?.status === 'Graded'" :padding="28">
            <div class="flex items-center gap-3 mb-3">
              <span
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-(--ra-pill) text-[12px] font-semibold"
                :class="currentAttempt.passed ? 'bg-(--success-soft) text-(--success)' : 'bg-(--danger-soft) text-(--danger)'"
              >
                {{ currentAttempt.passed ? 'Passed' : 'Not Passed' }}
              </span>
              <span v-if="currentAttempt.score != null" class="text-[13px] text-(--fg-3)">Score: {{ currentAttempt.score }}%</span>
            </div>
            <p v-if="currentAttempt.feedback" class="m-0 text-[13px] text-(--fg-2) leading-[1.6]">{{ currentAttempt.feedback }}</p>
            <RaButton v-if="canStartAttempt" variant="secondary" class="mt-4" :disabled="startState === 'starting'" @click="startAttemptFlow">
              {{ startState === 'starting' ? 'Starting…' : 'Try Again' }}
            </RaButton>
            <p v-if="startState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ startError }}</p>
          </RaCard>

          <!-- Submitted (Written/FileSubmission): awaiting a human grade -->
          <RaCard v-else-if="currentAttempt?.status === 'Submitted'" :padding="28">
            <div class="text-sm font-semibold text-(--fg-1) mb-2">Submitted — awaiting grading</div>
            <p v-if="currentAttempt.responseText" class="m-0 text-[13px] text-(--fg-2) leading-[1.6] whitespace-pre-wrap">{{ currentAttempt.responseText }}</p>
            <p v-else-if="currentAttempt.fileReference" class="m-0 text-[13px] text-(--fg-2) flex items-center gap-1.5"><Paperclip :size="13" /> File submitted</p>
          </RaCard>

          <!-- In-progress and not expired: the answer form -->
          <template v-else-if="attemptIsLive">
            <div v-if="assessmentDetail.type === 'Quiz'" class="flex flex-col gap-5">
              <div v-for="(q, i) in assessmentDetail.questions" :key="q.id">
                <div class="text-sm font-semibold text-(--fg-1) mb-2">{{ i + 1 }}. {{ q.text }}</div>
                <div class="flex flex-col gap-1.5">
                  <label v-for="(opt, oi) in q.options" :key="oi" class="flex items-center gap-2 text-[13px] text-(--fg-2) cursor-pointer">
                    <input type="radio" :name="'q-' + q.id" :checked="quizAnswers[i] === oi" @change="quizAnswers[i] = oi" />
                    {{ opt }}
                  </label>
                </div>
              </div>
            </div>

            <template v-else-if="assessmentDetail.type === 'Written'">
              <textarea
                v-model="writtenResponse"
                rows="8"
                placeholder="Write your response…"
                class="w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-4 py-3 text-sm text-(--fg-1) placeholder:text-(--fg-4) resize-y"
              ></textarea>
            </template>

            <RaCard v-else-if="assessmentDetail.type === 'FileSubmission'" :padding="20">
              <div class="text-sm text-(--fg-2) mb-3">
                Accepts: {{ assessmentDetail.acceptedContentTypes?.join(', ') || 'any file type' }}
                <span v-if="assessmentDetail.maxFileSizeBytes"> · Max {{ Math.round(assessmentDetail.maxFileSizeBytes / 1024 / 1024) }} MB</span>
              </div>
              <input ref="fileInputEl" type="file" class="hidden" @change="onFileSelected" />
              <RaButton variant="secondary" @click="pickFile">
                <template #icon><Paperclip :size="14" /></template>
                {{ selectedFile ? selectedFile.name : 'Choose File' }}
              </RaButton>
            </RaCard>

            <RaButton class="mt-6" :disabled="submitState === 'submitting' || uploadState === 'uploading'" @click="submitCurrentAttempt">
              {{ uploadState === 'uploading' ? 'Uploading…' : submitState === 'submitting' ? 'Submitting…' : 'Submit' }}
              <template #icon-right>
                <Loader2 v-if="submitState === 'submitting' || uploadState === 'uploading'" :size="14" class="animate-spin" />
                <ArrowRight v-else :size="14" />
              </template>
            </RaButton>
            <p v-if="submitState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ submitError }}</p>
          </template>

          <!-- No live attempt: expired or never started -->
          <RaCard v-else :padding="28" class="text-center">
            <div class="text-sm font-semibold text-(--fg-1) mb-2">Ready to begin?</div>
            <p v-if="currentAttempt?.status === 'InProgress'" class="m-0 mb-4 text-[13px] text-(--fg-3)">Your previous attempt's time limit expired.</p>
            <RaButton v-if="canStartAttempt" :disabled="startState === 'starting'" @click="startAttemptFlow">
              {{ startState === 'starting' ? 'Starting…' : 'Start Attempt' }}
              <template #icon-right>
                <Loader2 v-if="startState === 'starting'" :size="14" class="animate-spin" />
                <ArrowRight v-else :size="14" />
              </template>
            </RaButton>
            <p v-else class="m-0 text-[13px] text-(--fg-3)">No attempts remaining.</p>
            <p v-if="startState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ startError }}</p>
          </RaCard>

          <p v-if="assessmentDetail.postText" class="mt-4 text-(--fg-2) leading-[1.7]">{{ assessmentDetail.postText }}</p>
        </template>
      </template>

      <p v-else class="m-0 text-[13px] text-(--fg-3)">This course has no lessons yet.</p>
    </div>
  </div>
</template>
