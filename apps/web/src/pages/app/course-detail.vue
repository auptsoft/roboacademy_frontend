<script setup lang="ts">
import { computed, defineAsyncComponent, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  RaChip, RaProgress, RaCard, RaButton, RaInteractiveLesson,
  celebrate, isQuizResponseComplete, parseInteractiveContent, type QuizResponse,
} from '@roboacademy/ui'
import {
  CheckCircle2, PlayCircle, Lock, ChevronLeft, ChevronRight, ChevronDown, Layers, List,
  Loader2, AlertTriangle, Compass, ArrowRight, ExternalLink, CloudOff,
  Video, BookOpen, Puzzle, Cpu, FileText,
  ClipboardCheck, PenLine, UploadCloud, Paperclip, Sparkles, PanelLeftClose, MessagesSquare,
} from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { getCourse, getCourseResumePoint, recordLessonProgress, getLessonPlaybackUrl, combinedProgressPercent, type CourseDetail, type CourseLessonDetail, type CourseResumePoint } from '@/api/learning'
import TutorPanel from '@/components/tutor/TutorPanel.vue'
import CourseQAPanel from '@/components/community/CourseQAPanel.vue'
import { brandingKey, featureConfirmed } from '@/branding'
import { useAIAvailability } from '@/composables/useAIAvailability'
import { useLessonAnswers } from '@/composables/useLessonAnswers'
import { useAttemptDraft } from '@/composables/useAttemptDraft'
import AttemptTimer from '@/components/assessment/AttemptTimer.vue'
import QuizForm from '@/components/assessment/QuizForm.vue'
import { useLessonAssets } from '@/composables/useLessonAssets'
// Tiny: each player inside loads only when a lesson has that block.
import { lessonBlockRenderers } from '@roboacademy/sim/lesson'
import { enqueue, pendingSyncCount } from '@/lib/offline-sync'
import { kvGet, kvSet } from '@/lib/offline-store'
import { getCurrentUser } from '@/store/auth'
import { renderRichText } from '@/lib/rich-text'
import {
  listModuleAssessments, getAssessment, listMyAttempts, startAttempt, submitAttempt, getAttemptFileUploadUrl, saveAttemptDraft,
  type AssessmentSummary, type AssessmentDetail, type AttemptSummary,
} from '@/api/assessment'
import { useAchievements } from '@/composables/useAchievements'

const route = useRoute()
const router = useRouter()
const { checkSoon: checkAchievementsSoon } = useAchievements()
const showCurriculum = ref(false)

// Desktop-only: lets learners hide the curriculum to give the lesson full width. Mobile uses the
// showCurriculum drawer instead. Remembered across visits as a per-browser convenience.
const CURRICULUM_COLLAPSED_KEY = 'ra.courseCurriculumCollapsed'
const curriculumCollapsed = ref(readCurriculumCollapsed())

function readCurriculumCollapsed() {
  try {
    return localStorage.getItem(CURRICULUM_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

watch(curriculumCollapsed, (collapsed) => {
  try {
    localStorage.setItem(CURRICULUM_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // Storage unavailable (private mode etc.) — the toggle still works for this visit.
  }
})

function openCurriculum() {
  showCurriculum.value = true
  curriculumCollapsed.value = false
}

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

// The last good copy of the course and progress is kept on the device, so a lesson already opened
// can be reopened on a flaky connection. Only a network failure falls back to it - a 404 or 403
// from the server still means what it says.
const offlineCopy = ref(false)

async function loadCourseAndProgress(courseId: string): Promise<[CourseDetail, CourseResumePoint]> {
  const userId = getCurrentUser()?.userId
  try {
    const result = await Promise.all([getCourse(courseId), getCourseResumePoint(courseId)])
    offlineCopy.value = false
    if (userId) void kvSet(userId, `course:${courseId}`, result)
    return result
  } catch (err) {
    const cached = !(err instanceof ApiError) && userId
      ? await kvGet<[CourseDetail, CourseResumePoint]>(userId, `course:${courseId}`)
      : undefined
    if (!cached) throw err
    offlineCopy.value = true
    return cached
  }
}

async function load() {
  status.value = 'loading'
  errorMessage.value = ''
  selectedItem.value = null
  assessmentsByModule.value = new Map()
  try {
    const courseId = route.params.id as string
    const [courseResult, resumeResult] = await loadCourseAndProgress(courseId)
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

// ── Celebrations ─────────────────────────────────────────────────────────────
// Passes are celebrated as they happen on this page, never for what was already done on arrival.

/** courseCompleted alone is lesson-only; finishing the course also means its required assessments. */
function fullyComplete(r: CourseResumePoint) {
  return r.courseCompleted && r.completedAssessments >= r.totalAssessments
}

watch(resume, (next, prev) => {
  if (!next || !prev || next.courseId !== prev.courseId) return
  // Progress earns XP and badges, worked out in the background: look for any shortly.
  if (next.completedLessons > prev.completedLessons || next.completedAssessments > prev.completedAssessments) {
    checkAchievementsSoon()
  }
  if (fullyComplete(next) && !fullyComplete(prev)) {
    celebrate({ size: 'grand', title: 'Course complete!', subtitle: course.value ? `You finished ${course.value.title}.` : undefined })
  }
})

async function refreshResume() {
  if (!course.value) return
  try {
    resume.value = await getCourseResumePoint(course.value.id)
  } catch {
    // Progress catches up on the next load; a failed refresh isn't worth an error here.
  }
}

// Assessment passes the learner has already been celebrated for, so a teacher-graded pass is
// celebrated once, the first time they open it. Per browser, which is enough for a one-off moment.
const CELEBRATED_KEY = 'ra.celebratedAttempts'

function celebratedKey() {
  return `${CELEBRATED_KEY}.${getCurrentUser()?.userId ?? 'anon'}`
}

function celebratedAttempts(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(celebratedKey()) ?? '[]')
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

function celebrateAssessmentPass(attempt: AttemptSummary) {
  try {
    const ids = celebratedAttempts().filter(id => id !== attempt.id)
    localStorage.setItem(celebratedKey(), JSON.stringify([...ids, attempt.id].slice(-200)))
  } catch {
    // Storage unavailable - worst case the same pass is celebrated again on a later visit.
  }
  celebrate({
    size: 'major',
    title: 'Assessment passed!',
    subtitle: attempt.score != null ? `You scored ${attempt.score}%.` : selectedAssessmentContext.value?.summary.title,
  })
}

/** Old passes aren't news: only celebrate a teacher's grade that landed recently. */
const LATE_GRADE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function selectLesson(lessonId: string) {
  if (lessonState(lessonId) === 'locked') return
  selectedItem.value = { kind: 'lesson', id: lessonId }
}

function lessonNumber(lessonId: string): number {
  return flatLessons.value.findIndex(f => f.lesson.id === lessonId) + 1
}

// ── Previous / next ──────────────────────────────────────────────────────────
// Steps through lessons and assessments in curriculum order, the same sequence as the sidebar.

const orderedItems = computed<ModuleItem[]>(() =>
  course.value ? course.value.modules.flatMap(mod => moduleItems.value.get(mod.id) ?? []) : [])

function itemId(item: ModuleItem) {
  return item.kind === 'lesson' ? item.lesson.id : item.assessment.id
}

/** The item on screen, which is the active lesson until the learner picks something. */
const currentItem = computed<SelectedItem | null>(() => selectedItem.value?.kind === 'assessment'
  ? selectedItem.value
  : selectedFlat.value ? { kind: 'lesson', id: selectedFlat.value.lesson.id } : null)

const currentItemIndex = computed(() => {
  const current = currentItem.value
  if (!current) return -1
  return orderedItems.value.findIndex(item => item.kind === current.kind && itemId(item) === current.id)
})

const previousItem = computed(() => currentItemIndex.value > 0 ? orderedItems.value[currentItemIndex.value - 1] : null)
const nextItem = computed(() => currentItemIndex.value >= 0 ? orderedItems.value[currentItemIndex.value + 1] ?? null : null)

function itemTitle(item: ModuleItem) {
  return item.kind === 'lesson'
    ? `${String(lessonNumber(item.lesson.id)).padStart(2, '0')}. ${item.lesson.title}`
    : item.assessment.title
}

/** Lessons unlock in order; assessments are open from the start, as in the sidebar. */
function itemLocked(item: ModuleItem) {
  return item.kind === 'lesson' && lessonState(item.lesson.id) === 'locked'
}

function goToItem(item: ModuleItem) {
  if (itemLocked(item)) return
  if (item.kind === 'lesson') selectLesson(item.lesson.id)
  else selectAssessment(item.assessment.id)
}

// Moving to another item starts it from the top, wherever the move came from.
const contentPane = ref<HTMLElement | null>(null)
watch(() => currentItem.value && `${currentItem.value.kind}:${currentItem.value.id}`, (next, prev) => {
  if (!prev || next === prev || !contentPane.value) return
  contentPane.value.scrollTop = 0
  contentPane.value.scrollIntoView({ block: 'start' })
})

async function markComplete() {
  if (!course.value || !selectedFlat.value) return
  const courseId = course.value.id
  const lesson = selectedFlat.value
  completeState.value = 'saving'
  completeError.value = ''
  try {
    // Answers first: the server won't complete an Interactive lesson without them.
    if (interactiveContent.value && !(await flushAnswers())) throw new TypeError('offline')
    await recordLessonProgress(courseId, [lesson.lesson.id])
    resume.value = await getCourseResumePoint(courseId)
    selectedItem.value = resume.value.nextLessonId ? { kind: 'lesson', id: resume.value.nextLessonId } : null
    completeState.value = 'idle'
  } catch (err) {
    if (err instanceof ApiError) {
      completeState.value = 'error'
      completeError.value = err.message
      return
    }
    // No connection: queue the completion behind its answers, and move on here as the server will.
    await enqueue({ kind: 'progress', courseId, lessonId: lesson.lesson.id })
    advanceLocally(lesson.lesson)
    completeState.value = 'idle'
  }
}

/** The resume point as the server will have it once a queued completion arrives. */
function advanceLocally(completed: CourseLessonDetail) {
  if (!resume.value) return
  const index = flatLessons.value.findIndex(f => f.lesson.id === completed.id)
  const next = flatLessons.value[index + 1]?.lesson ?? null
  resume.value = {
    ...resume.value,
    nextLessonId: next?.id ?? null,
    completedLessons: resume.value.completedLessons + (completed.isRequired ? 1 : 0),
  }
  selectedItem.value = next ? { kind: 'lesson', id: next.id } : null
}

// ── Simulation lessons ───────────────────────────────────────────────────────
//
// A simulation lesson is completed by passing it, not by self-reporting. A graded run is scored on
// the server, which records the lesson itself. We deliberately never call recordLessonProgress
// here - doing so would let any client claim a pass without running anything.

// Loaded on demand: the simulator (physics WASM, Blockly, three.js) is several megabytes, and
// only Simulation lessons need it.
const SimulationLesson = defineAsyncComponent(() => import('@/components/simulation/SimulationLesson.vue'))
const simGraded = ref<{ score: number; passed: boolean } | null>(null)

// Lesson types arrive from the backend enum in PascalCase, but have been compared both ways in
// this file's template. Normalise once so every branch of the content dispatch agrees.
const lessonType = computed(() => selectedFlat.value?.lesson.type?.toLowerCase() ?? '')

const isSimulationLesson = computed(() => lessonType.value === 'simulation')

// ── Interactive lessons ──────────────────────────────────────────────────────
// Lessons with content blocks hold "Mark Complete" back until every required check is resolved.
// That gate is client-side only: the checks are formative, unlike simulation grading.
const interactiveContent = computed(() =>
  lessonType.value === 'interactive' ? parseInteractiveContent(selectedFlat.value?.lesson.content) : null)
const interactiveComplete = ref(false)
// Cards lessons end on a finish card, which carries the Mark Complete button instead of the page.
const interactiveCards = computed(() => interactiveContent.value?.display === 'cards')

// The lesson reports its state as soon as it mounts, already complete when saved answers finish it.
// Only a change after that first report is the learner finishing the checks now.
let interactiveReported = false

function onInteractiveProgress(state: { complete: boolean }) {
  const justFinished = interactiveReported && !interactiveComplete.value && state.complete
  interactiveReported = true
  interactiveComplete.value = state.complete
  if (justFinished) {
    celebrate({
      size: selectedState.value === 'done' ? 'light' : 'standard',
      title: 'All checks done!',
      subtitle: selectedState.value === 'active' ? 'Mark the lesson complete to continue.' : undefined,
    })
  }
}

// Answers are saved as each check resolves, and loaded back so a lesson left part-way reopens
// where the learner was. The lesson mounts once they've loaded, so restored blocks don't jump.
const { restored: restoredAnswers, load: loadAnswers, record: recordAnswer, flush: flushAnswers } = useLessonAnswers()
// Media blocks' files: signed URLs for the open lesson, refreshed before they expire.
const { urls: lessonAssetUrls, load: loadLessonAssets, clear: clearLessonAssets } = useLessonAssets()
watch(
  () => (interactiveContent.value && course.value ? selectedFlat.value?.lesson.id : undefined),
  (lessonId) => {
    if (!lessonId || !course.value || !interactiveContent.value) {
      clearLessonAssets()
      return
    }
    void loadAnswers(course.value.id, lessonId)
    void loadLessonAssets(course.value.id, lessonId, interactiveContent.value)
  },
  { immediate: true },
)

// ── AI tutor ─────────────────────────────────────────────────────────────────
// Offered on non-simulation lessons when the school's plan and settings include it (simulation
// lessons get their own hints later). The panel owns its conversation; this page only opens it and
// follows citation clicks to the cited lesson.
const aiAvailability = useAIAvailability()
const tutorOpen = ref(false)
const showTutorButton = computed(() =>
  aiAvailability.tutorAvailable.value && contentKind.value === 'lesson' && !!selectedFlat.value && !isSimulationLesson.value)

// ── Community Q&A ────────────────────────────────────────────────────────────
// Questions about the open lesson, when the school's plan includes course Q&A.
const branding = inject(brandingKey, null)
const qaOpen = ref(false)
const showQAButton = computed(() =>
  featureConfirmed(branding?.value, 'community_qa') && contentKind.value === 'lesson' && !!selectedFlat.value)

/**
 * The backend records progress for a passing graded run just after scoring it (the event goes
 * through the outbox), so refresh the resume point a few times until this lesson shows as done.
 */
async function onSimulationGraded(result: { score: number; passed: boolean }) {
  simGraded.value = result
  if (!result.passed || !course.value) return
  // Re-running a lesson that's already done still deserves a nod, just a smaller one.
  const firstPass = selectedState.value !== 'done'
  celebrate({
    size: firstPass ? 'standard' : 'light',
    title: firstPass ? 'Simulation passed!' : 'Passed again!',
    subtitle: `You scored ${result.score}%.`,
  })
  const courseId = course.value.id
  for (const delay of [800, 2000, 4000]) {
    await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      resume.value = await getCourseResumePoint(courseId)
    } catch {
      // Keep trying: a transient read failure is not a grading failure.
    }
    if (selectedState.value === 'done') return
  }
}

watch(() => selectedFlat.value?.lesson.id, () => (simGraded.value = null))
// Each mount of the interactive lesson (new lesson, or answers reloaded) starts a fresh baseline.
watch([() => selectedFlat.value?.lesson.id, restoredAnswers], () => (interactiveReported = false))

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
// Live while in progress and in time. The countdown (AttemptTimer) sets timeUp at zero; on load,
// the server's clock judges an attempt whose time already ran out.
const attemptIsLive = computed(() => {
  const attempt = currentAttempt.value
  if (!attempt || attempt.status !== 'InProgress' || timeUp.value) return false
  if (!attempt.expiresAt) return true
  const serverOffset = Date.parse(attempt.serverNow) - attemptsLoadedAt.value
  return Date.parse(attempt.expiresAt) > Date.now() + serverOffset
})
// When the attempts were fetched, to turn their serverNow into a clock offset.
const attemptsLoadedAt = ref(Date.now())

// One response per question: an option index for multiple choice, else what RaQuizQuestion collects.
const quizAnswers = ref<QuizResponse[]>([])
const writtenResponse = ref('')
const selectedFile = ref<File | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)
// File submissions upload as soon as a file is picked, so a time-up can still hand the file in.
const uploadedFileKey = ref<string | null>(null)
// One-at-a-time quizzes: the question on screen (questions.length is the review screen), and the furthest reached.
const currentQuestion = ref(0)
const furthestQuestion = ref(0)
// The countdown reached zero: the form locks and whatever is answered is handed in.
const timeUp = ref(false)
const timeUpError = ref('')

function resetAnswerState() {
  quizAnswers.value = assessmentDetail.value ? assessmentDetail.value.questions.map(() => null) : []
  writtenResponse.value = ''
  selectedFile.value = null
  uploadedFileKey.value = null
  currentQuestion.value = 0
  furthestQuestion.value = 0
  timeUp.value = false
  timeUpError.value = ''
}

/** Brings back what was saved on an attempt still in progress (after a reload, or on another device). */
function restoreDraft(attempt: AttemptSummary | null) {
  if (!attempt || attempt.status !== 'InProgress' || !assessmentDetail.value) return
  const draft = attempt.draft
  const count = assessmentDetail.value.questions.length
  if (draft?.responses) quizAnswers.value = Array.from({ length: count }, (_, i) => draft.responses![i] ?? null)
  if (draft?.responseText) writtenResponse.value = draft.responseText
  if (draft?.fileReference) uploadedFileKey.value = draft.fileReference
  currentQuestion.value = Math.min(attempt.currentQuestion ?? 0, count)
  furthestQuestion.value = Math.min(attempt.furthestQuestion ?? 0, count)
}

// Saves the answers as the learner works (see useAttemptDraft).
const attemptDraft = useAttemptDraft(async ({ keepalive }) => {
  const attempt = currentAttempt.value
  const detail = assessmentDetail.value
  if (!attempt || attempt.status !== 'InProgress' || !detail) return
  const draft = detail.type === 'Quiz' ? { responses: quizAnswers.value }
    : detail.type === 'Written' ? { responseText: writtenResponse.value }
    : { fileReference: uploadedFileKey.value ?? undefined }
  const position = detail.type === 'Quiz' && detail.questionDisplay === 'OneAtATime'
    ? { currentQuestion: currentQuestion.value, furthestQuestion: furthestQuestion.value }
    : {}
  await saveAttemptDraft(attempt.id, { draft, ...position }, { keepalive })
})

watch([quizAnswers, writtenResponse, uploadedFileKey], () => {
  if (attemptIsLive.value) attemptDraft.schedule()
}, { deep: true })

/** Moving between questions saves straight away: the position is what locks earlier answers. */
function onQuizNavigate() {
  attemptDraft.schedule()
  void attemptDraft.flush()
}

async function refreshMyAttempts(assessmentId: string) {
  myAttempts.value = await listMyAttempts(assessmentId)
  attemptsLoadedAt.value = Date.now()
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
    attemptsLoadedAt.value = Date.now()
    resetAnswerState()
    restoreDraft(attempts[0] ?? null)
    assessmentDetailState.value = 'loaded'

    // Quizzes are celebrated on submit; written and file work is graded later by a teacher.
    const latest = attempts[0]
    if (
      detail.type !== 'Quiz' && latest?.status === 'Graded' && latest.passed && latest.gradedAt
      && Date.now() - new Date(latest.gradedAt).getTime() < LATE_GRADE_WINDOW_MS
      && !celebratedAttempts().includes(latest.id)
    ) {
      celebrateAssessmentPass(latest)
    }
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
    // Starting again on an attempt still in time resumes it, answers and all.
    restoreDraft(currentAttempt.value)
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

// Uploaded straight away (not at submit), so the file is safe even if time runs out first.
async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file || !currentAttempt.value) return
  selectedFile.value = file
  uploadState.value = 'uploading'
  submitError.value = ''
  try {
    const { uploadUrl, objectKey } = await getAttemptFileUploadUrl(currentAttempt.value.id, file.type || 'application/octet-stream', file.name)
    const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } })
    if (!put.ok) throw new Error('Upload failed.')
    uploadedFileKey.value = objectKey
    attemptDraft.schedule()
    await attemptDraft.flush()
  } catch (err) {
    selectedFile.value = null
    submitState.value = 'error'
    submitError.value = err instanceof ApiError ? err.message : "The file couldn't be uploaded. Check your connection and try again."
  } finally {
    uploadState.value = 'idle'
  }
}

/** The countdown hit zero: lock the form, save what's there, and hand it in. */
async function onTimeUp() {
  timeUp.value = true
  await attemptDraft.flush(true)
  await submitCurrentAttempt({ timeUp: true })
}

async function submitCurrentAttempt(options: { timeUp?: boolean } = {}) {
  if (!currentAttempt.value || !assessmentDetail.value || !selectedAssessmentContext.value) return

  // When time's up, whatever is there is handed in - unanswered questions just score nothing.
  const questions = assessmentDetail.value.questions
  if (!options.timeUp) {
    if (assessmentDetail.value.type === 'Quiz'
      && questions.some((q, i) => !isQuizResponseComplete(q.kind ?? 'choice', q.definition, quizAnswers.value[i] ?? null))) {
      submitState.value = 'error'
      submitError.value = 'Answer every question before submitting.'
      return
    }
    if (assessmentDetail.value.type === 'Written' && !writtenResponse.value.trim()) {
      submitState.value = 'error'
      submitError.value = 'Write a response before submitting.'
      return
    }
    if (assessmentDetail.value.type === 'FileSubmission' && !uploadedFileKey.value) {
      submitState.value = 'error'
      submitError.value = 'Choose a file before submitting.'
      return
    }
  } else if (assessmentDetail.value.type === 'FileSubmission' && !uploadedFileKey.value) {
    // Nothing to hand in from here; the server closes the attempt on its own.
    timeUpError.value = "Time's up. No file was uploaded, so this attempt will be closed without one."
    return
  }

  submitState.value = 'submitting'
  submitError.value = ''
  try {
    const attemptId = currentAttempt.value.id
    const summary = selectedAssessmentContext.value.summary
    const assessmentId = summary.id
    if (assessmentDetail.value.type === 'Quiz') {
      await submitAttempt(attemptId, { responses: quizAnswers.value })
    } else if (assessmentDetail.value.type === 'Written') {
      await submitAttempt(attemptId, { responseText: writtenResponse.value })
    } else {
      await submitAttempt(attemptId, { fileReference: uploadedFileKey.value! })
    }
    attemptDraft.stop()
    await refreshMyAttempts(assessmentId)
    submitState.value = 'idle'

    const graded = currentAttempt.value
    if (graded?.id === attemptId && graded.status === 'Graded' && graded.passed) {
      celebrateAssessmentPass(graded)
      summary.passed = true
      // A required assessment may have been the last thing left in the course.
      void refreshResume()
    }
  } catch (err) {
    uploadState.value = 'idle'
    if (options.timeUp) {
      // Offline, or past the grace period: the saved answers are handed in by the server instead.
      submitState.value = 'idle'
      timeUpError.value = "Time's up. Your saved answers will be submitted automatically."
      return
    }
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
    <div class="text-sm font-semibold text-(--fg-1)">Course not available</div>
    <p class="m-0 text-[13px] text-(--fg-3) max-w-80">This course may have been removed, isn't published yet, or is only available through your school.</p>
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
      :class="[showCurriculum ? 'max-md:translate-x-0' : 'max-md:-translate-x-full', curriculumCollapsed && 'md:hidden']"
    >
      <div class="px-4.5 py-5 border-b border-(--line-1) shrink-0">
        <div class="flex justify-between items-center gap-2 mb-1">
          <span class="text-[15px] font-bold text-(--fg-1)">Course Curriculum</span>
          <div class="flex items-center gap-1.5">
            <RaChip tone="overlay">{{ flatLessons.length ? (flatLessons.findIndex(f => f.lesson.id === selectedFlat?.lesson.id) + 1) : 0 }}/{{ flatLessons.length }}</RaChip>
            <button
              type="button"
              class="inline-flex items-center justify-center w-7 h-7 rounded-(--ra-md) bg-transparent border-0 text-(--fg-3) cursor-pointer hover:bg-(--bg-3) hover:text-(--fg-1) max-md:hidden"
              title="Hide curriculum"
              aria-label="Hide curriculum"
              @click="curriculumCollapsed = true"
            >
              <PanelLeftClose :size="16" />
            </button>
          </div>
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
    <div ref="contentPane" class="flex-1 overflow-y-auto px-12 pt-8 pb-12 max-md:px-4 max-md:pt-5 max-md:pb-8">
      <button
        type="button"
        class="hidden items-center gap-2 mb-4 py-2 px-3.5 rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) text-(--fg-2) text-[13px] font-semibold cursor-pointer hover:text-(--fg-1) max-md:inline-flex"
        :class="curriculumCollapsed && 'md:inline-flex'"
        @click="openCurriculum"
      >
        <List :size="14" /> Curriculum
      </button>
      <p
        v-if="offlineCopy || pendingSyncCount > 0"
        class="mt-0 mb-4 flex items-center gap-2 rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3.5 py-2.5 text-[13px] text-(--fg-2)"
        role="status"
      >
        <CloudOff :size="14" class="shrink-0 text-(--fg-3)" />
        <template v-if="offlineCopy">You're offline, so this is the copy saved on your device.</template>
        <template v-if="pendingSyncCount > 0">
          {{ pendingSyncCount === 1 ? '1 change is' : `${pendingSyncCount} changes are` }} saved on this device and will sync when you're back online.
        </template>
      </p>
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
          <button
            v-if="showTutorButton"
            type="button"
            class="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3 py-1.5 text-[13px] font-semibold text-(--fg-1) hover:border-(--brand-blue)"
            @click="tutorOpen = true"
          >
            <Sparkles :size="14" class="text-(--brand-blue)" /> Ask the tutor
          </button>
          <button
            v-if="showQAButton"
            type="button"
            :class="[showTutorButton ? '' : 'ml-auto', 'inline-flex cursor-pointer items-center gap-1.5 rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3 py-1.5 text-[13px] font-semibold text-(--fg-1) hover:border-(--brand-blue)']"
            @click="qaOpen = true"
          >
            <MessagesSquare :size="14" class="text-(--brand-blue)" /> Questions
          </button>
        </div>

        <h1 class="m-0 text-[32px] font-bold text-(--fg-1) tracking-[-0.01em]">{{ String(selectedFlat.index + 1).padStart(2, '0') }}. {{ selectedFlat.lesson.title }}</h1>

        <hr class="my-8 border-0 border-t border-(--line-1)" />

        <div v-if="selectedFlat.lesson.context" class="rich-text text-(--fg-2) leading-[1.7]" v-html="renderRichText(selectedFlat.lesson.context)"></div>

        <template v-if="interactiveContent">
          <RaInteractiveLesson
            v-if="restoredAnswers"
            :key="selectedFlat.lesson.id"
            :content="interactiveContent"
            :initial-results="restoredAnswers"
            :asset-urls="lessonAssetUrls"
            :renderers="lessonBlockRenderers"
            :class="selectedFlat.lesson.context && 'mt-8'"
            @progress="onInteractiveProgress"
            @answer="(blockId, result) => recordAnswer(course!.id, selectedFlat!.lesson.id, blockId, result)"
          >
            <template #finish>
              <RaChip v-if="selectedState === 'done'" tone="student" class="py-2.5! px-4!">Completed</RaChip>
              <template v-else-if="selectedState === 'active'">
                <RaButton :disabled="completeState === 'saving' || !interactiveComplete" @click="markComplete">
                  {{ completeState === 'saving' ? 'Saving…' : 'Mark Complete & Continue' }}
                  <template #icon-right>
                    <Loader2 v-if="completeState === 'saving'" :size="14" class="animate-spin" />
                    <ArrowRight v-else :size="14" />
                  </template>
                </RaButton>
                <p v-if="completeState === 'error'" class="m-0 text-xs text-(--danger)">{{ completeError }}</p>
              </template>
            </template>
          </RaInteractiveLesson>
          <p v-else class="mt-8 mb-0 inline-flex items-center gap-2 text-[13px] text-(--fg-3)">
            <Loader2 :size="14" class="animate-spin" /> Loading your answers…
          </p>
        </template>

        <!--
          Simulation is checked first on purpose. A simulation lesson carries its scene id in
          contentReference, so any generic contentReference branch placed above this one would
          swallow it and offer an "Open Content" link to a scene id instead of running the lesson.
        -->
        <SimulationLesson
          v-if="isSimulationLesson"
          :key="selectedFlat.lesson.id"
          :lesson-id="selectedFlat.lesson.id"
          @graded="onSimulationGraded"
          @open-lesson="selectLesson"
        />

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

        <RaCard v-else-if="!selectedFlat.lesson.contentReference && !selectedFlat.lesson.context && selectedFlat.lesson.type != 'Interactive'" :padding="28" class="text-center mt-6">
          <div class="text-sm font-semibold text-(--fg-1) mb-2">Content isn't available yet</div>
          <p class="m-0 text-[13px] text-(--fg-3) max-w-120 mx-auto">This lesson's {{ selectedFlat.lesson.type.toLowerCase() }} content will be available once delivery is set up.</p>
        </RaCard>

        <div v-if="!interactiveCards" class="mt-8">
          <RaChip v-if="selectedState === 'done'" tone="student" class="py-2.5! px-4!">Completed</RaChip>
          <!--
            A simulation lesson is completed by passing it, not by self-reporting: Submit in the
            simulator runs a graded attempt, and the server records the lesson for a pass.
          -->
          <p v-else-if="isSimulationLesson" class="m-0 text-[13px] text-(--fg-3)">
            {{ simGraded?.passed ? 'Passed! Recording your progress…' : 'Use Submit in the simulator to complete this lesson.' }}
          </p>
          <template v-else-if="selectedState === 'active'">
            <RaButton :disabled="completeState === 'saving' || (!!interactiveContent && !interactiveComplete)" @click="markComplete">
              {{ completeState === 'saving' ? 'Saving…' : 'Mark Complete & Continue' }}
              <template #icon-right>
                <Loader2 v-if="completeState === 'saving'" :size="14" class="animate-spin" />
                <ArrowRight v-else :size="14" />
              </template>
            </RaButton>
            <p v-if="interactiveContent && !interactiveComplete" class="mt-2 mb-0 text-xs text-(--fg-3)">Finish the checks above to complete this lesson.</p>
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
          <div v-if="assessmentDetail.preText" class="rich-text text-(--fg-2) leading-[1.7]" v-html="renderRichText(assessmentDetail.preText)"></div>

          <div class="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-(--fg-4) mb-5">
            <span v-if="assessmentDetail.maxAttempts != null">Attempts: {{ myAttempts.length }}/{{ assessmentDetail.maxAttempts }}</span>
            <span v-if="assessmentDetail.timeLimitMinutes != null">Time allowed: {{ assessmentDetail.timeLimitMinutes }} min once you start</span>
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
            <p v-if="currentAttempt.submittedAutomatically" class="m-0 mb-2 text-[13px] text-(--fg-3)">Submitted automatically when time ran out.</p>
            <p v-if="currentAttempt.feedback" class="m-0 text-[13px] text-(--fg-2) leading-[1.6]">{{ currentAttempt.feedback }}</p>
            <RaButton v-if="canStartAttempt" variant="secondary" class="mt-4" :disabled="startState === 'starting'" @click="startAttemptFlow">
              {{ startState === 'starting' ? 'Starting…' : 'Try Again' }}
            </RaButton>
            <p v-if="startState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ startError }}</p>
          </RaCard>

          <!-- Submitted (Written/FileSubmission): awaiting a human grade -->
          <RaCard v-else-if="currentAttempt?.status === 'Submitted'" :padding="28">
            <div class="text-sm font-semibold text-(--fg-1) mb-2">Submitted — awaiting grading</div>
            <p v-if="currentAttempt.submittedAutomatically" class="m-0 mb-2 text-[13px] text-(--fg-3)">Submitted automatically when time ran out.</p>
            <p v-if="currentAttempt.responseText" class="m-0 text-[13px] text-(--fg-2) leading-[1.6] whitespace-pre-wrap">{{ currentAttempt.responseText }}</p>
            <p v-else-if="currentAttempt.fileReference" class="m-0 text-[13px] text-(--fg-2) flex items-center gap-1.5"><Paperclip :size="13" /> File submitted</p>
          </RaCard>

          <!-- Time's up on this page: locked, being handed in -->
          <RaCard v-else-if="timeUp && currentAttempt?.status === 'InProgress'" :padding="28" class="text-center" role="status">
            <div class="mb-2 text-sm font-semibold text-(--fg-1)">Time's up</div>
            <p class="m-0 text-[13px] text-(--fg-3)">{{ timeUpError || 'Submitting your answers…' }}</p>
          </RaCard>

          <!-- In-progress and not expired: the answer form -->
          <template v-else-if="attemptIsLive">
            <AttemptTimer
              v-if="currentAttempt?.expiresAt"
              :expires-at="currentAttempt.expiresAt"
              :server-now="currentAttempt.serverNow"
              @expired="onTimeUp"
            />
            <QuizForm
              v-if="assessmentDetail.type === 'Quiz'"
              v-model:answers="quizAnswers"
              v-model:current="currentQuestion"
              v-model:furthest="furthestQuestion"
              :questions="assessmentDetail.questions"
              :display="assessmentDetail.questionDisplay ?? 'AllOnOnePage'"
              :allow-back="assessmentDetail.allowBackNavigation ?? true"
              :disabled="submitState === 'submitting'"
              @navigate="onQuizNavigate"
            />

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
              <RaButton variant="secondary" :disabled="uploadState === 'uploading'" @click="pickFile">
                <template #icon><Loader2 v-if="uploadState === 'uploading'" :size="14" class="animate-spin" /><Paperclip v-else :size="14" /></template>
                {{ uploadState === 'uploading' ? 'Uploading…' : selectedFile ? selectedFile.name : uploadedFileKey ? 'Replace file' : 'Choose File' }}
              </RaButton>
              <p v-if="uploadedFileKey && uploadState !== 'uploading'" class="mt-2 mb-0 text-xs text-(--success)">File uploaded. Submit when you're ready.</p>
            </RaCard>

            <RaButton
              v-if="assessmentDetail.type !== 'Quiz' || assessmentDetail.questionDisplay !== 'OneAtATime' || currentQuestion >= assessmentDetail.questions.length"
              class="mt-6"
              :disabled="submitState === 'submitting' || uploadState === 'uploading'"
              @click="submitCurrentAttempt()"
            >
              {{ uploadState === 'uploading' ? 'Uploading…' : submitState === 'submitting' ? 'Submitting…' : 'Submit' }}
              <template #icon-right>
                <Loader2 v-if="submitState === 'submitting' || uploadState === 'uploading'" :size="14" class="animate-spin" />
                <ArrowRight v-else :size="14" />
              </template>
            </RaButton>
            <p v-if="submitState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ submitError }}</p>
            <p class="mt-2 mb-0 text-xs text-(--fg-4)" aria-live="polite">
              {{ attemptDraft.status.value === 'saving' ? 'Saving…' : attemptDraft.status.value === 'saved' ? 'Your answers are saved.' : attemptDraft.status.value === 'error' ? "Couldn't save just now; we'll keep trying." : '' }}
            </p>
          </template>

          <!-- No live attempt: expired or never started -->
          <RaCard v-else :padding="28" class="text-center">
            <div class="text-sm font-semibold text-(--fg-1) mb-2">Ready to begin?</div>
            <p v-if="currentAttempt?.status === 'InProgress'" class="m-0 mb-4 text-[13px] text-(--fg-3)">
              Time ran out on your last attempt. Your saved answers are being submitted automatically.
            </p>
            <p v-else-if="assessmentDetail.timeLimitMinutes != null" class="m-0 mb-4 text-[13px] text-(--fg-3)">
              You'll have {{ assessmentDetail.timeLimitMinutes }} minutes once you start. Your answers are saved as you go.
            </p>
            <RaButton v-if="canStartAttempt" :disabled="startState === 'starting'" @click="startAttemptFlow">
              {{ startState === 'starting' ? 'Starting…' : assessmentDetail.timeLimitMinutes != null ? 'Start (the timer begins)' : 'Start Attempt' }}
              <template #icon-right>
                <Loader2 v-if="startState === 'starting'" :size="14" class="animate-spin" />
                <ArrowRight v-else :size="14" />
              </template>
            </RaButton>
            <p v-else class="m-0 text-[13px] text-(--fg-3)">No attempts remaining.</p>
            <p v-if="startState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ startError }}</p>
          </RaCard>

          <div v-if="assessmentDetail.postText" class="rich-text mt-4 text-(--fg-2) leading-[1.7]" v-html="renderRichText(assessmentDetail.postText)"></div>
        </template>
      </template>

      <p v-else class="m-0 text-[13px] text-(--fg-3)">This course has no lessons yet.</p>

      <nav
        v-if="currentItemIndex !== -1 && (previousItem || nextItem)"
        aria-label="Lesson navigation"
        class="grid grid-cols-2 gap-3 mt-10 pt-6 border-t border-(--line-1)"
      >
        <button
          v-if="previousItem"
          type="button"
          class="group flex items-center gap-3 min-w-0 px-4 py-3 rounded-(--ra-lg) border border-(--line-2) bg-(--bg-2) text-left cursor-pointer transition-colors duration-(--dur-1) ease-(--ease-out) hover:border-(--brand-blue)"
          @click="goToItem(previousItem)"
        >
          <ChevronLeft :size="18" class="shrink-0 text-(--fg-3) group-hover:text-(--brand-blue)" />
          <span class="min-w-0">
            <span class="block text-[11px] font-semibold uppercase tracking-wide text-(--fg-4)">Previous</span>
            <span class="block truncate text-[13px] font-semibold text-(--fg-1)">{{ itemTitle(previousItem) }}</span>
          </span>
        </button>
        <span v-else />

        <button
          v-if="nextItem"
          type="button"
          class="group flex items-center justify-end gap-3 min-w-0 px-4 py-3 rounded-(--ra-lg) border border-(--line-2) bg-(--bg-2) text-right transition-colors duration-(--dur-1) ease-(--ease-out)"
          :class="itemLocked(nextItem) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-(--brand-blue)'"
          :disabled="itemLocked(nextItem)"
          :title="itemLocked(nextItem) ? 'Complete this lesson to unlock the next one' : undefined"
          @click="goToItem(nextItem)"
        >
          <span class="min-w-0">
            <span class="block text-[11px] font-semibold uppercase tracking-wide text-(--fg-4)">
              {{ itemLocked(nextItem) ? 'Locked' : 'Next' }}
            </span>
            <span class="block truncate text-[13px] font-semibold text-(--fg-1)">{{ itemTitle(nextItem) }}</span>
          </span>
          <Lock v-if="itemLocked(nextItem)" :size="16" class="shrink-0 text-(--fg-4)" />
          <ChevronRight v-else :size="18" class="shrink-0 text-(--fg-3) group-hover:text-(--brand-blue)" />
        </button>
      </nav>
    </div>
  </div>

  <TutorPanel
    v-if="course"
    v-model:open="tutorOpen"
    :course-id="course.id"
    :lesson-id="selectedFlat?.lesson.id ?? null"
    @open-lesson="selectLesson"
  />

  <CourseQAPanel
    v-if="course"
    v-model:open="qaOpen"
    :course-id="course.id"
    :lesson-id="selectedFlat?.lesson.id ?? null"
  />
</template>
