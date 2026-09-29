<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RaButton } from '@roboacademy/ui'
import { Loader2, AlertTriangle, Check, Lock, Circle, PlayCircle, ChevronDown } from 'lucide-vue-next'
import {
  getMyEnrolledCourses, getMyEnrolledPaths, getMyProgressEvents,
  type EnrolledCourseSummary, type EnrolledPathSummary, type PathStepProgress, type ProgressEventItem,
} from '@/api/learning'
import { getAllMyAttempts, type MyAttemptItem } from '@/api/assessment'
import { getMyCertificates } from '@/api/certification'
import StatCard from '@/components/dashboard/StatCard.vue'
import DataTable, { type DataTableColumn } from '@/components/dashboard/DataTable.vue'

type LoadStatus = 'loading' | 'idle' | 'error'

const router = useRouter()

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function openCourse(courseId: string) {
  router.push(`/app/courses/${courseId}`)
}

// Courses
const courses = ref<EnrolledCourseSummary[]>([])
const coursesStatus = ref<LoadStatus>('loading')

async function loadCourses() {
  coursesStatus.value = 'loading'
  try {
    courses.value = await getMyEnrolledCourses()
    coursesStatus.value = 'idle'
  } catch {
    coursesStatus.value = 'error'
  }
}
onMounted(loadCourses)

// Most-progressed first, so the course closest to done is what you see first.
const inProgressCourses = computed(() =>
  courses.value.filter(c => !c.courseCompleted).sort((a, b) => b.progressPercent - a.progressPercent),
)
const completedCourses = computed(() => courses.value.filter(c => c.courseCompleted))
const completedLessons = computed(() => courses.value.reduce((sum, c) => sum + c.completedLessons, 0))
const totalLessons = computed(() => courses.value.reduce((sum, c) => sum + c.totalLessons, 0))
const showCompletedCourses = ref(false)

function isOverdue(c: EnrolledCourseSummary): boolean {
  return !!c.dueAt && Date.parse(c.dueAt) < Date.now()
}

// Learning paths
const paths = ref<EnrolledPathSummary[]>([])
const pathsStatus = ref<LoadStatus>('loading')

async function loadPaths() {
  pathsStatus.value = 'loading'
  try {
    paths.value = await getMyEnrolledPaths()
    pathsStatus.value = 'idle'
  } catch {
    pathsStatus.value = 'error'
  }
}
onMounted(loadPaths)

const completedPathsCount = computed(() =>
  paths.value.filter(p => p.courseCount > 0 && p.completedCourses >= p.courseCount).length,
)

// The step to continue with: one already underway, else the first one that's open.
function nextStep(p: EnrolledPathSummary): PathStepProgress | undefined {
  return p.steps.find(s => s.status === 'InProgress') ?? p.steps.find(s => s.status === 'Unlocked')
}

const stepIcon = { Completed: Check, InProgress: PlayCircle, Unlocked: Circle, Locked: Lock } as const
const stepTone: Record<PathStepProgress['status'], string> = {
  Completed: 'bg-(--success-soft) text-(--success)',
  InProgress: 'bg-(--brand-blue-soft) text-(--brand-blue)',
  Unlocked: 'bg-(--bg-3) text-(--fg-2)',
  Locked: 'bg-(--bg-3) text-(--fg-4)',
}
const stepLabel: Record<PathStepProgress['status'], string> = {
  Completed: 'Completed',
  InProgress: 'In progress',
  Unlocked: 'Ready to start',
  Locked: 'Locked until the previous course is done',
}

// Assessment results
const attempts = ref<MyAttemptItem[]>([])
const attemptsStatus = ref<LoadStatus>('loading')

async function loadAttempts() {
  attemptsStatus.value = 'loading'
  try {
    const { data } = await getAllMyAttempts({ pageSize: 50 })
    attempts.value = data
    attemptsStatus.value = 'idle'
  } catch {
    attemptsStatus.value = 'error'
  }
}
onMounted(loadAttempts)

// An in-progress attempt has no result yet — it belongs to the assessment page, not here.
const results = computed(() => attempts.value.filter(a => a.status !== 'InProgress'))
const gradedResults = computed(() => results.value.filter(a => a.status === 'Graded' && a.score !== null))
const averageScore = computed(() => {
  if (!gradedResults.value.length) return null
  const total = gradedResults.value.reduce((sum, a) => sum + (a.score ?? 0), 0)
  return Math.round(total / gradedResults.value.length)
})
const passedCount = computed(() => gradedResults.value.filter(a => a.passed).length)

function courseTitle(courseId: string): string {
  return courses.value.find(c => c.courseId === courseId)?.title ?? '—'
}

const resultColumns: DataTableColumn[] = [
  { key: 'date', label: 'Date' },
  { key: 'assessmentTitle', label: 'Assessment' },
  { key: 'course', label: 'Course' },
  { key: 'score', label: 'Score', align: 'right' },
  { key: 'result', label: 'Result' },
]

const resultsExpanded = ref(false)
const visibleResults = computed(() => (resultsExpanded.value ? results.value : results.value.slice(0, 5)))

// Certificates — only the count is needed here; the full list lives on the certificates page.
const certificatesCount = ref<number | null>(null)
const certificatesStatus = ref<LoadStatus>('loading')

async function loadCertificates() {
  certificatesStatus.value = 'loading'
  try {
    // Revoked certificates aren't earned any more, so they don't count.
    const { data } = await getMyCertificates({ pageSize: 100 })
    certificatesCount.value = data.filter(c => c.status === 'Issued').length
    certificatesStatus.value = 'idle'
  } catch {
    certificatesStatus.value = 'error'
  }
}
onMounted(loadCertificates)

// Recent activity — lesson completions, paged from the progress event stream.
const events = ref<ProgressEventItem[]>([])
const eventsStatus = ref<LoadStatus>('loading')
const eventsPage = ref(1)
const eventsHasMore = ref(false)
const eventsLoadingMore = ref(false)
const EVENTS_PAGE_SIZE = 10

async function loadEvents() {
  eventsStatus.value = 'loading'
  try {
    const { data, meta } = await getMyProgressEvents({ page: 1, pageSize: EVENTS_PAGE_SIZE })
    events.value = data
    eventsPage.value = 1
    eventsHasMore.value = meta.page < meta.totalPages
    eventsStatus.value = 'idle'
  } catch {
    eventsStatus.value = 'error'
  }
}
onMounted(loadEvents)

async function loadMoreEvents() {
  eventsLoadingMore.value = true
  try {
    const next = eventsPage.value + 1
    const { data, meta } = await getMyProgressEvents({ page: next, pageSize: EVENTS_PAGE_SIZE })
    events.value = [...events.value, ...data]
    eventsPage.value = next
    eventsHasMore.value = meta.page < meta.totalPages
  } finally {
    eventsLoadingMore.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-9 px-12 pt-12 pb-12 max-w-[1440px] mx-auto max-lg:px-8 max-sm:gap-6 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <div>
      <h1 class="m-0 mb-2 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">Progress</h1>
      <p class="m-0 text-sm text-(--fg-3)">How far you've come across your courses, learning paths and assessments.</p>
    </div>

    <!-- KPI row -->
    <div class="grid gap-6 grid-cols-4 max-xl:grid-cols-2 max-md:grid-cols-1 -mt-2">
      <StatCard
        variant="split"
        label="Courses"
        :value="coursesStatus === 'loading' ? '—' : String(completedCourses.length)"
        caption="Completed"
        :secondary-value="coursesStatus === 'loading' ? '—' : String(courses.length)"
        secondary-caption="Enrolled"
      />
      <StatCard
        variant="split"
        label="Lessons"
        :value="coursesStatus === 'loading' ? '—' : String(completedLessons)"
        caption="Completed"
        :secondary-value="coursesStatus === 'loading' ? '—' : String(totalLessons)"
        secondary-caption="Total"
      />
      <StatCard
        label="Average Score"
        :value="attemptsStatus === 'loading' ? '—' : averageScore === null ? '—' : `${averageScore}%`"
        :caption="attemptsStatus === 'error'
          ? 'Couldn\'t load results'
          : gradedResults.length
            ? `${passedCount} of ${gradedResults.length} graded attempts passed`
            : 'No graded assessments yet'"
      />
      <StatCard
        variant="navy"
        label="Certificates Earned"
        :value="certificatesStatus === 'loading' ? '—' : String(certificatesCount ?? 0)"
        :caption="certificatesStatus === 'error'
          ? 'Couldn\'t load certificates'
          : pathsStatus === 'idle' && paths.length
            ? `${completedPathsCount} of ${paths.length} paths completed`
            : 'across courses and paths'"
      />
    </div>

    <!-- Learning paths -->
    <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
      <h2 class="m-0 mb-5 text-[22px] font-medium text-(--heading)">Learning Paths</h2>
      <div v-if="pathsStatus === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Loading…
      </div>
      <div v-else-if="pathsStatus === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your learning paths.</p>
        <RaButton variant="secondary" @click="loadPaths">Try again</RaButton>
      </div>
      <p v-else-if="!paths.length" class="m-0 text-[13px] text-(--fg-3)">
        You haven't started a learning path yet — <button class="bg-transparent border-0 p-0 cursor-pointer text-(--link) underline" @click="router.push('/app/explore?tab=paths')">browse paths</button> to follow a guided sequence of courses.
      </p>
      <div v-else class="flex flex-col gap-4">
        <article v-for="p in paths" :key="p.pathEnrolmentId" class="border border-(--line-2) rounded-(--ra-lg) p-5 max-sm:p-4">
          <div class="flex items-start justify-between gap-4 max-sm:flex-col">
            <div class="min-w-0">
              <button class="bg-transparent border-0 p-0 cursor-pointer text-left text-base font-semibold text-(--heading) hover:underline" @click="router.push(`/app/explore/paths/${p.pathId}`)">{{ p.title }}</button>
              <div class="mt-1 text-[13px] text-(--fg-3)">{{ p.completedCourses }} of {{ p.courseCount }} courses completed</div>
            </div>
            <RaButton
              v-if="nextStep(p)"
              variant="primary"
              class="shrink-0"
              @click="openCourse(nextStep(p)!.courseId)"
            >{{ nextStep(p)!.status === 'InProgress' ? 'Continue' : 'Start next' }}</RaButton>
            <span v-else-if="p.courseCount > 0 && p.completedCourses >= p.courseCount" class="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-(--success)">
              <Check :size="14" /> Path complete
            </span>
          </div>

          <div class="mt-4 flex items-center gap-3">
            <div class="flex-1 h-2 rounded-(--ra-pill) bg-(--bg-3) overflow-hidden" role="progressbar" :aria-valuenow="p.progressPercent" aria-valuemin="0" aria-valuemax="100" :aria-label="`${p.title} progress`">
              <div class="h-full rounded-(--ra-pill) bg-(--success) transition-[width] duration-500" :style="{ width: `${p.progressPercent}%` }" />
            </div>
            <span class="text-[13px] font-semibold tabular-nums text-(--fg-1) w-10 text-right">{{ p.progressPercent }}%</span>
          </div>

          <ol class="list-none m-0 mt-4 p-0 flex flex-wrap gap-2">
            <li v-for="s in p.steps" :key="s.courseId">
              <button
                class="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-(--ra-pill) border-0 text-[13px] font-medium"
                :class="[stepTone[s.status], s.status === 'Locked' ? 'cursor-not-allowed' : 'cursor-pointer hover:brightness-95']"
                :disabled="s.status === 'Locked'"
                :title="stepLabel[s.status]"
                @click="openCourse(s.courseId)"
              >
                <component :is="stepIcon[s.status]" :size="14" />
                <span class="max-w-[220px] truncate">{{ s.order }}. {{ s.courseTitle }}</span>
                <span class="sr-only">— {{ stepLabel[s.status] }}</span>
              </button>
            </li>
          </ol>
        </article>
      </div>
    </section>

    <!-- Courses -->
    <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
      <div class="flex justify-between items-baseline mb-5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <h2 class="m-0 text-[22px] font-medium text-(--heading)">Courses In Progress</h2>
        <button class="text-[13px] font-medium text-(--link) bg-transparent border-0 p-0 cursor-pointer hover:underline" @click="router.push('/app/courses')">My courses</button>
      </div>
      <div v-if="coursesStatus === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Loading…
      </div>
      <div v-else-if="coursesStatus === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your courses.</p>
        <RaButton variant="secondary" @click="loadCourses">Try again</RaButton>
      </div>
      <p v-else-if="!courses.length" class="m-0 text-[13px] text-(--fg-3)">
        No enrolled courses yet — <button class="bg-transparent border-0 p-0 cursor-pointer text-(--link) underline" @click="router.push('/app/explore')">explore the catalog</button> to get started.
      </p>
      <template v-else>
        <p v-if="!inProgressCourses.length" class="m-0 text-[13px] text-(--fg-3)">You've finished every course you're enrolled in.</p>
        <ul v-else class="list-none m-0 p-0 flex flex-col">
          <li v-for="c in inProgressCourses" :key="c.enrolmentId" class="flex items-center gap-5 py-4 border-b border-(--line-2) last:border-b-0 max-md:flex-col max-md:items-stretch max-md:gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <button class="bg-transparent border-0 p-0 cursor-pointer text-left text-[15px] font-semibold text-(--heading) hover:underline" @click="openCourse(c.courseId)">{{ c.title }}</button>
                <span v-if="c.assigned" class="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-(--ra-pill) bg-(--brand-blue-soft) text-(--brand-blue)">Assigned</span>
                <span v-if="c.dueAt" class="text-xs" :class="isOverdue(c) ? 'text-(--danger) font-medium' : 'text-(--fg-3)'">
                  {{ isOverdue(c) ? 'Overdue ·' : 'Due' }} {{ formatShortDate(c.dueAt) }}
                </span>
              </div>
              <div class="mt-1 text-[13px] text-(--fg-3) truncate">
                <template v-if="c.nextLessonTitle">Next: {{ c.nextModuleTitle ? `${c.nextModuleTitle} — ` : '' }}{{ c.nextLessonTitle }}</template>
                <template v-else-if="c.completedLessons >= c.totalLessons && c.totalAssessments > c.completedAssessments">Lessons done — assessments remaining</template>
                <template v-else>Not started</template>
              </div>
              <div class="mt-3 flex items-center gap-3">
                <div class="flex-1 h-2 rounded-(--ra-pill) bg-(--bg-3) overflow-hidden" role="progressbar" :aria-valuenow="c.progressPercent" aria-valuemin="0" aria-valuemax="100" :aria-label="`${c.title} progress`">
                  <div class="h-full rounded-(--ra-pill) bg-(--brand-blue) transition-[width] duration-500" :style="{ width: `${c.progressPercent}%` }" />
                </div>
                <span class="text-[13px] font-semibold tabular-nums text-(--fg-1) w-10 text-right">{{ c.progressPercent }}%</span>
              </div>
              <div class="mt-2 flex gap-4 text-xs text-(--fg-3) tabular-nums">
                <span>{{ c.completedLessons }}/{{ c.totalLessons }} lessons</span>
                <span v-if="c.totalAssessments">{{ c.completedAssessments }}/{{ c.totalAssessments }} assessments</span>
              </div>
            </div>
            <RaButton variant="secondary" class="shrink-0" @click="openCourse(c.courseId)">
              {{ c.completedLessons > 0 ? 'Resume' : 'Start' }}
            </RaButton>
          </li>
        </ul>

        <div v-if="completedCourses.length" class="mt-5 pt-4 border-t border-(--line-2)">
          <button
            class="inline-flex items-center gap-1.5 min-h-9 bg-transparent border-0 p-0 cursor-pointer text-[13px] font-medium text-(--fg-2)"
            :aria-expanded="showCompletedCourses"
            @click="showCompletedCourses = !showCompletedCourses"
          >
            <ChevronDown :size="16" class="transition-transform" :class="showCompletedCourses ? 'rotate-180' : ''" />
            Completed courses ({{ completedCourses.length }})
          </button>
          <ul v-if="showCompletedCourses" class="list-none m-0 mt-2 p-0 flex flex-col gap-1">
            <li v-for="c in completedCourses" :key="c.enrolmentId">
              <button class="flex items-center gap-2 w-full min-h-9 bg-transparent border-0 p-0 cursor-pointer text-left text-sm text-(--fg-1) hover:underline" @click="openCourse(c.courseId)">
                <Check :size="14" class="text-(--success) shrink-0" />
                <span class="truncate">{{ c.title }}</span>
              </button>
            </li>
          </ul>
        </div>
      </template>
    </section>

    <!-- Assessment results + Recent activity -->
    <div class="grid gap-6 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] max-lg:grid-cols-1">
      <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
        <h2 class="m-0 mb-5 text-[22px] font-medium text-(--heading)">Assessment Results</h2>
        <div v-if="attemptsStatus === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
          <Loader2 :size="16" class="animate-spin" /> Loading…
        </div>
        <div v-else-if="attemptsStatus === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
          <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
          <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your results.</p>
          <RaButton variant="secondary" @click="loadAttempts">Try again</RaButton>
        </div>
        <p v-else-if="!results.length" class="m-0 text-[13px] text-(--fg-3)">No submitted assessments yet — results appear here once you complete a quiz or assignment.</p>
        <template v-else>
          <DataTable :columns="resultColumns" :rows="visibleResults" :row-key="row => row.id">
            <template #cell-date="{ row }">{{ formatShortDate(row.submittedAt ?? row.startedAt) }}</template>
            <template #cell-assessmentTitle="{ row }">
              <span class="line-clamp-1 text-(--fg-1) font-medium">{{ row.assessmentTitle }}</span>
            </template>
            <template #cell-course="{ row }">
              <button class="bg-transparent border-0 p-0 cursor-pointer text-left text-(--link) hover:underline line-clamp-1" @click="openCourse(row.courseId)">{{ courseTitle(row.courseId) }}</button>
            </template>
            <template #cell-score="{ row }">
              <span class="tabular-nums">{{ row.score !== null ? `${Math.round(row.score)}%` : '—' }}</span>
            </template>
            <template #cell-result="{ row }">
              <span
                class="inline-flex items-center gap-1.5 text-[13px] font-medium"
                :class="row.status !== 'Graded' ? 'text-(--warning)' : row.passed ? 'text-(--success)' : 'text-(--danger)'"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-current" />
                {{ row.status !== 'Graded' ? 'Awaiting grade' : row.passed ? 'Passed' : 'Not passed' }}
              </span>
            </template>
          </DataTable>
          <button
            v-if="results.length > 5"
            class="mt-4 min-h-9 bg-transparent border-0 p-0 cursor-pointer text-[13px] font-medium text-(--link) hover:underline"
            @click="resultsExpanded = !resultsExpanded"
          >{{ resultsExpanded ? 'Show fewer' : `Show all ${results.length}` }}</button>
        </template>
      </section>

      <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
        <h2 class="m-0 mb-5 text-[22px] font-medium text-(--heading)">Recent Activity</h2>
        <div v-if="eventsStatus === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
          <Loader2 :size="16" class="animate-spin" /> Loading…
        </div>
        <div v-else-if="eventsStatus === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
          <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
          <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your activity.</p>
          <RaButton variant="secondary" @click="loadEvents">Try again</RaButton>
        </div>
        <p v-else-if="!events.length" class="m-0 text-[13px] text-(--fg-3)">No activity yet — complete a lesson to see it here.</p>
        <template v-else>
          <ol class="list-none m-0 p-0 flex flex-col">
            <li v-for="e in events" :key="`${e.lessonId}-${e.occurredAt}`" class="relative pl-6 pb-5 last:pb-0 before:content-[''] before:absolute before:left-[5px] before:top-3 before:bottom-0 before:w-px before:bg-(--line-2) last:before:hidden">
              <span class="absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full bg-(--success-soft) border-2 border-(--success)" />
              <button class="bg-transparent border-0 p-0 cursor-pointer text-left block w-full group" @click="openCourse(e.courseId)">
                <div class="text-sm font-medium text-(--fg-1) leading-snug group-hover:underline">{{ e.lessonTitle }}</div>
                <div class="text-xs text-(--fg-3) mt-0.5 truncate">{{ e.courseTitle }}</div>
                <div class="text-xs text-(--fg-4) mt-0.5">{{ formatDateTime(e.occurredAt) }}</div>
              </button>
            </li>
          </ol>
          <RaButton v-if="eventsHasMore" variant="secondary" class="mt-5 w-full" :disabled="eventsLoadingMore" @click="loadMoreEvents">
            <Loader2 v-if="eventsLoadingMore" :size="14" class="animate-spin" />
            Load more
          </RaButton>
        </template>
      </section>
    </div>
  </div>
</template>
