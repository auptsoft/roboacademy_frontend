<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RaKpi, RaCard, RaChip, RaButton, RaCourseCard, RaPathCard } from '@roboacademy/ui'
import { ArrowRight, CheckCircle2, Award, PlayCircle, Loader2, AlertTriangle } from 'lucide-vue-next'
import {
  getMyEnrolledCourses, listCourseCatalog, getMyProgressEvents, getMyLiveClasses,
  getMyEnrolledPaths, getSuggestedLearningPaths,
  type EnrolledCourseSummary, type CourseCatalogItem, type ProgressEventItem, type LiveClassSummary,
  type EnrolledPathSummary, type LearningPathItem,
} from '@/api/learning'
import PathCatalogCard from '@/components/explore/PathCatalogCard.vue'
import { getMyCertificates, type CertificateItem } from '@/api/certification'
import { getMyLabSessions, type LabSessionSummary } from '@/api/robotics-lab'
import CourseCatalogCard from '@/components/explore/CourseCatalogCard.vue'
import { getCurrentUser } from '@/store/auth'

const router = useRouter()
const user = getCurrentUser()

function formatRelativeTime(iso: string): string {
  const diffMs = Date.parse(iso) - Date.now()
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diffMinutes = Math.round(diffMs / 60_000)
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute')
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour')
  return rtf.format(Math.round(diffHours / 24), 'day')
}

function formatCalendarParts(iso: string): { day: string; date: string; time: string } {
  const date = new Date(iso)
  return {
    day: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    date: String(date.getDate()),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  }
}

// Enrolled courses
const enrolledCourses = ref<EnrolledCourseSummary[]>([])
const enrolledStatus = ref<'loading' | 'idle' | 'error'>('loading')

async function loadEnrolledCourses() {
  enrolledStatus.value = 'loading'
  try {
    enrolledCourses.value = await getMyEnrolledCourses()
    enrolledStatus.value = 'idle'
  } catch {
    enrolledStatus.value = 'error'
  }
}
onMounted(loadEnrolledCourses)

const activeCoursesCount = computed(() => enrolledCourses.value.length)
const completedLessonsCount = computed(() => enrolledCourses.value.reduce((sum, c) => sum + c.completedLessons, 0))

function cardStatus(c: EnrolledCourseSummary): string {
  if (c.courseCompleted) return 'Completed'
  if (c.completedLessons === 0) return 'New'
  return 'In Progress'
}

function openCourse(courseId: string) {
  router.push(`/app/courses/${courseId}`)
}

const welcomeSubtitle = computed(() => {
  if (enrolledStatus.value === 'loading') return ''
  if (!enrolledCourses.value.length) return 'Explore the catalog to enroll in your first course.'
  const courses = activeCoursesCount.value
  const lessons = completedLessonsCount.value
  return `You're enrolled in ${courses} course${courses === 1 ? '' : 's'} and have completed ${lessons} lesson${lessons === 1 ? '' : 's'}.`
})

const currentFocusCourse = computed(() => {
  const inProgress = enrolledCourses.value.filter(c => !c.courseCompleted)
  return inProgress.find(c => c.completedLessons > 0) ?? inProgress[0] ?? null
})

const allEnrolledCoursesCompleted = computed(() =>
  enrolledCourses.value.length > 0 && enrolledCourses.value.every(c => c.courseCompleted),
)

// Certificates
const certificates = ref<CertificateItem[]>([])
const certificatesCount = ref<number | null>(null)
const certificatesStatus = ref<'loading' | 'idle' | 'error'>('loading')

async function loadCertificates() {
  certificatesStatus.value = 'loading'
  try {
    const { data, meta } = await getMyCertificates({ pageSize: 100 })
    certificates.value = data
    certificatesCount.value = meta.totalCount
    certificatesStatus.value = 'idle'
  } catch {
    certificatesStatus.value = 'error'
  }
}
onMounted(loadCertificates)

function courseTitleFor(courseId: string): string {
  return enrolledCourses.value.find(c => c.courseId === courseId)?.title
    ?? recommendedRaw.value.find(c => c.id === courseId)?.title
    ?? 'a course'
}

function pathTitleFor(pathId: string): string {
  return enrolledPaths.value.find(p => p.pathId === pathId)?.title
    ?? suggestedPaths.value.find(p => p.id === pathId)?.title
    ?? 'a learning path'
}

// Recommended for you
const recommendedRaw = ref<CourseCatalogItem[]>([])
const recommendedStatus = ref<'loading' | 'idle' | 'error'>('loading')

const enrolledCourseIds = computed(() => new Set(enrolledCourses.value.map(c => c.courseId)))
const recommendedCourses = computed(() =>
  recommendedRaw.value.filter(c => !enrolledCourseIds.value.has(c.id)).slice(0, 3),
)

async function loadRecommendedCourses() {
  recommendedStatus.value = 'loading'
  try {
    const { data } = await listCourseCatalog({ pageSize: 12 })
    recommendedRaw.value = data
    recommendedStatus.value = 'idle'
  } catch {
    recommendedStatus.value = 'error'
  }
}
onMounted(loadRecommendedCourses)

// My learning paths
const enrolledPaths = ref<EnrolledPathSummary[]>([])
const enrolledPathsStatus = ref<'loading' | 'idle' | 'error'>('loading')

async function loadEnrolledPaths() {
  enrolledPathsStatus.value = 'loading'
  try {
    enrolledPaths.value = await getMyEnrolledPaths()
    enrolledPathsStatus.value = 'idle'
  } catch {
    enrolledPathsStatus.value = 'error'
  }
}
onMounted(loadEnrolledPaths)

function openPath(pathId: string) {
  router.push(`/app/explore/paths/${pathId}`)
}

// Suggested learning paths — backend already excludes paths the user has started.
const suggestedPaths = ref<LearningPathItem[]>([])
const suggestedPathsStatus = ref<'loading' | 'idle' | 'error'>('loading')

async function loadSuggestedPaths() {
  suggestedPathsStatus.value = 'loading'
  try {
    const { data } = await getSuggestedLearningPaths({ pageSize: 4 })
    suggestedPaths.value = data
    suggestedPathsStatus.value = 'idle'
  } catch {
    suggestedPathsStatus.value = 'error'
  }
}
onMounted(loadSuggestedPaths)

// Recent activity — merged from real progress events, enrolments, and certificates.
const progressEvents = ref<ProgressEventItem[]>([])
const activityStatus = ref<'loading' | 'idle' | 'error'>('loading')

async function loadActivity() {
  activityStatus.value = 'loading'
  try {
    const { data } = await getMyProgressEvents({ pageSize: 10 })
    progressEvents.value = data
    activityStatus.value = 'idle'
  } catch {
    activityStatus.value = 'error'
  }
}
onMounted(loadActivity)

interface ActivityEntry { icon: typeof CheckCircle2; tone: string; text: string; occurredAt: string }

const activity = computed<ActivityEntry[]>(() => {
  const entries: ActivityEntry[] = [
    ...progressEvents.value.map((e): ActivityEntry => ({
      icon: CheckCircle2,
      tone: 'text-(--success) bg-(--success-soft)',
      text: `Completed lesson "${e.lessonTitle}"`,
      occurredAt: e.occurredAt,
    })),
    ...enrolledCourses.value.map((c): ActivityEntry => ({
      icon: PlayCircle,
      tone: 'text-(--brand-blue) bg-(--brand-blue-soft)',
      text: `Started "${c.title}"`,
      occurredAt: c.enrolledAt,
    })),
    ...certificates.value.map((cert): ActivityEntry => ({
      icon: Award,
      tone: 'text-(--brand-blue) bg-(--brand-blue-soft)',
      text: `Earned certificate for "${cert.kind === 'Path' ? pathTitleFor(cert.pathId!) : courseTitleFor(cert.courseId!)}"`,
      occurredAt: cert.issuedAt,
    })),
  ]
  return entries
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 5)
})

const activityLoading = computed(() =>
  activityStatus.value === 'loading' || enrolledStatus.value === 'loading' || certificatesStatus.value === 'loading',
)

// Upcoming this week — merged from booked live classes and robotics-lab sessions.
const upcomingLiveClasses = ref<LiveClassSummary[]>([])
const labSessions = ref<LabSessionSummary[]>([])
const upcomingStatus = ref<'loading' | 'idle' | 'error'>('loading')

async function loadUpcoming() {
  upcomingStatus.value = 'loading'
  try {
    const [liveClasses, sessions] = await Promise.all([
      getMyLiveClasses(),
      getMyLabSessions(),
    ])
    upcomingLiveClasses.value = liveClasses.data
    labSessions.value = sessions.data
    upcomingStatus.value = 'idle'
  } catch {
    upcomingStatus.value = 'error'
  }
}
onMounted(loadUpcoming)

interface UpcomingEntry { title: string; scheduledStart: string }

const upcoming = computed(() => {
  const now = Date.now()
  const weekAhead = now + 7 * 24 * 60 * 60 * 1000
  const inWindow = (iso: string) => {
    const t = Date.parse(iso)
    return t >= now && t <= weekAhead
  }

  const entries: UpcomingEntry[] = [
    ...upcomingLiveClasses.value
      .filter(l => inWindow(l.scheduledStart))
      .map((l): UpcomingEntry => ({ title: l.title, scheduledStart: l.scheduledStart })),
    ...labSessions.value
      .filter((s): s is LabSessionSummary & { scheduledStart: string } => !!s.scheduledStart && inWindow(s.scheduledStart))
      .map((s): UpcomingEntry => ({
        title: s.mode === 'Simulation' ? 'Simulation Lab' : 'Robotics Lab Session',
        scheduledStart: s.scheduledStart,
      })),
  ]

  return entries
    .sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart))
    .slice(0, 4)
    .map(e => ({ title: e.title, ...formatCalendarParts(e.scheduledStart) }))
})
</script>

<template>
  <div class="flex flex-col gap-7 px-8 pt-8 pb-12 max-w-(--content-max) mx-auto max-sm:gap-5 max-sm:px-4 max-sm:pt-5 max-sm:pb-8">
    <!-- Welcome -->
    <div>
      <h1 class="m-0 text-[32px] font-bold text-(--fg-1) tracking-[-0.01em] max-sm:text-2xl">Welcome back, {{ user?.fullName ?? 'there' }}.</h1>
      <p class="mt-2 mb-0 text-sm text-(--fg-3)">{{ welcomeSubtitle }}</p>
    </div>

    <!-- KPI row -->
    <div class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      <RaKpi label="Active Courses" :value="enrolledStatus === 'loading' ? '—' : String(activeCoursesCount)" icon="book-open" />
      <RaKpi label="Completed Lessons" :value="enrolledStatus === 'loading' ? '—' : String(completedLessonsCount)" icon="zap" />
      <RaKpi label="Certificates Earned" :value="certificatesStatus === 'loading' ? '—' : String(certificatesCount ?? 0)" icon="award" />
    </div>

    <!-- Current focus -->
    <RaCard :padding="24" class="bg-[linear-gradient(135deg,var(--bg-3)_0%,var(--bg-2)_100%)]!">
      <div v-if="enrolledStatus === 'loading'" class="text-sm text-(--fg-3)">Loading…</div>
      <div v-else-if="currentFocusCourse" class="flex items-center justify-between gap-6 flex-wrap max-sm:flex-col max-sm:items-start">
        <div class="flex-1 min-w-[320px]">
          <RaChip tone="info" class="mb-3">Current Focus</RaChip>
          <div class="text-[22px] font-bold text-(--fg-1) mb-2">{{ currentFocusCourse.title }}</div>
          <p class="m-0 text-sm text-(--fg-3) max-w-150">
            <template v-if="currentFocusCourse.nextLessonTitle">
              Next up: <span v-if="currentFocusCourse.nextModuleTitle">{{ currentFocusCourse.nextModuleTitle }} — </span>{{ currentFocusCourse.nextLessonTitle }}
            </template>
            <template v-else>{{ currentFocusCourse.description }}</template>
          </p>
        </div>
        <RaButton @click="router.push(`/app/courses/${currentFocusCourse.courseId}`)">
          Continue Learning
          <template #icon-right><ArrowRight :size="14" /></template>
        </RaButton>
      </div>
      <div v-else-if="allEnrolledCoursesCompleted" class="flex items-center justify-between gap-6 flex-wrap max-sm:flex-col max-sm:items-start">
        <div class="flex-1 min-w-[320px]">
          <RaChip tone="student" class="mb-3">All caught up</RaChip>
          <div class="text-[22px] font-bold text-(--fg-1) mb-2">You've completed all your enrolled courses</div>
          <p class="m-0 text-sm text-(--fg-3) max-w-150">Great work — explore the catalog to start your next one.</p>
        </div>
        <RaButton @click="router.push('/app/explore')">
          Explore Courses
          <template #icon-right><ArrowRight :size="14" /></template>
        </RaButton>
      </div>
      <div v-else class="flex items-center justify-between gap-6 flex-wrap max-sm:flex-col max-sm:items-start">
        <div class="flex-1 min-w-[320px]">
          <RaChip tone="info" class="mb-3">Get started</RaChip>
          <div class="text-[22px] font-bold text-(--fg-1) mb-2">You're not enrolled in any courses yet</div>
          <p class="m-0 text-sm text-(--fg-3) max-w-150">Browse the catalog and enroll in your first course to see it here.</p>
        </div>
        <RaButton @click="router.push('/app/explore')">
          Explore Courses
          <template #icon-right><ArrowRight :size="14" /></template>
        </RaButton>
      </div>
    </RaCard>

    <!-- Enrolled courses -->
    <div class="bg-(--bg-1) border border-(--line-1) rounded-(--ra-xl) p-6 max-sm:p-4">
      <div class="flex justify-between items-baseline mb-4 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <h2 class="m-0 text-[22px] font-bold text-(--fg-1)">My Enrolled Courses</h2>
        <button class="text-[13px] text-(--fg-3) bg-transparent border-0 p-0 cursor-pointer hover:text-(--fg-2)" @click="router.push('/app/courses')">View All Courses</button>
      </div>
      <p v-if="enrolledStatus === 'idle' && !enrolledCourses.length" class="m-0 text-[13px] text-(--fg-3)">
        No enrolled courses yet — <button class="bg-transparent border-0 p-0 cursor-pointer text-(--brand-blue) underline" @click="router.push('/app/explore')">explore the catalog</button> to get started.
      </p>
      <div v-else class="grid gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <RaCourseCard
          v-for="c in enrolledCourses.slice(0, 4)"
          :key="c.enrolmentId"
          :title="c.title"
          :description="c.description ?? ''"
          :progress="c.progressPercent"
          :status="cardStatus(c)"
          :thumbnail-url="c.thumbnailUrl"
          @open="openCourse(c.courseId)"
        />
      </div>
    </div>

    <!-- My learning paths -->
    <div v-if="enrolledPathsStatus === 'error' || enrolledPaths.length" class="bg-(--bg-1) border border-(--line-1) rounded-(--ra-xl) p-6 max-sm:p-4">
      <div class="flex justify-between items-baseline mb-4 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <h2 class="m-0 text-[22px] font-bold text-(--fg-1)">My Learning Paths</h2>
        <button class="text-[13px] text-(--fg-3) bg-transparent border-0 p-0 cursor-pointer hover:text-(--fg-2)" @click="router.push('/app/explore?tab=paths')">View All Paths</button>
      </div>
      <div v-if="enrolledPathsStatus === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your learning paths.</p>
        <RaButton variant="secondary" @click="loadEnrolledPaths">Try again</RaButton>
      </div>
      <div v-else class="grid gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <RaPathCard
          v-for="p in enrolledPaths.slice(0, 4)"
          :key="p.pathEnrolmentId"
          :title="p.title"
          :description="p.description ?? ''"
          :course-count="p.courseCount"
          :completed-courses="p.completedCourses"
          :progress="p.progressPercent"
          :thumbnail-url="p.thumbnailUrl"
          @open="openPath(p.pathId)"
        />
      </div>
    </div>

    <!-- Suggested learning paths -->
    <div class="bg-(--bg-1) border border-(--line-1) rounded-(--ra-xl) p-6 max-sm:p-4">
      <div class="flex justify-between items-baseline mb-4 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <h2 class="m-0 text-[22px] font-bold text-(--fg-1)">Suggested Learning Paths</h2>
        <button class="text-[13px] text-(--fg-3) bg-transparent border-0 p-0 cursor-pointer hover:text-(--fg-2)" @click="router.push('/app/explore?tab=paths')">Explore All Paths</button>
      </div>
      <div v-if="suggestedPathsStatus === 'loading'" class="flex flex-col items-center gap-3 py-12 text-center">
        <Loader2 :size="20" class="animate-spin text-(--fg-4)" />
        <p class="m-0 text-[13px] text-(--fg-3)">Loading suggestions…</p>
      </div>
      <div v-else-if="suggestedPathsStatus === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load suggestions.</p>
        <RaButton variant="secondary" @click="loadSuggestedPaths">Try again</RaButton>
      </div>
      <p v-else-if="!suggestedPaths.length" class="m-0 text-[13px] text-(--fg-3)">
        No suggestions yet — <button class="bg-transparent border-0 p-0 cursor-pointer text-(--brand-blue) underline" @click="router.push('/app/explore?tab=paths')">explore learning paths</button> to find your next one.
      </p>
      <div v-else class="grid gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <PathCatalogCard
          v-for="p in suggestedPaths"
          :key="p.id"
          :id="p.id"
          :title="p.title"
          :description="p.description"
          :thumbnail-url="p.thumbnailUrl"
          :course-count="p.courseCount"
        />
      </div>
    </div>

    <!-- Recommended for you -->
    <div class="bg-(--bg-1) border border-(--line-1) rounded-(--ra-xl) p-6 max-sm:p-4">
      <div class="flex justify-between items-baseline mb-4 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <h2 class="m-0 text-[22px] font-bold text-(--fg-1)">Check Out These Courses</h2>
        <button class="text-[13px] text-(--fg-3) bg-transparent border-0 p-0 cursor-pointer hover:text-(--fg-2)" @click="router.push('/app/explore')">Explore All Courses</button>
      </div>
      <div v-if="recommendedStatus === 'loading'" class="flex flex-col items-center gap-3 py-12 text-center">
        <Loader2 :size="20" class="animate-spin text-(--fg-4)" />
        <p class="m-0 text-[13px] text-(--fg-3)">Loading recommendations…</p>
      </div>
      <div v-else-if="recommendedStatus === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load recommendations.</p>
        <RaButton variant="secondary" @click="loadRecommendedCourses">Try again</RaButton>
      </div>
      <p v-else-if="!recommendedCourses.length" class="m-0 text-[13px] text-(--fg-3)">
        No recommendations yet — <button class="bg-transparent border-0 p-0 cursor-pointer text-(--brand-blue) underline" @click="router.push('/app/explore')">explore the catalog</button> to find your next course.
      </p>
      <div v-else class="grid gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CourseCatalogCard v-for="course in recommendedCourses" :key="course.id" v-bind="course" />
      </div>
    </div>

    <!-- Activity + Upcoming -->
    <div class="grid gap-4.5 grid-cols-2 max-sm:grid-cols-1">
      <RaCard :padding="20">
        <h2 class="m-0 mb-4 text-base font-bold text-(--fg-1)">Recent Activity</h2>
        <div v-if="activityLoading" class="text-[13px] text-(--fg-3)">Loading…</div>
        <p v-else-if="!activity.length" class="m-0 text-[13px] text-(--fg-3)">No activity yet — complete a lesson to see it here.</p>
        <div v-else class="flex flex-col gap-4">
          <div v-for="(item, i) in activity" :key="i" class="flex items-start gap-3">
            <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="item.tone">
              <component :is="item.icon" :size="15" />
            </span>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-(--fg-2) leading-snug">{{ item.text }}</div>
              <div class="text-xs text-(--fg-4) mt-0.5">{{ formatRelativeTime(item.occurredAt) }}</div>
            </div>
          </div>
        </div>
      </RaCard>

      <RaCard :padding="20">
        <h2 class="m-0 mb-4 text-base font-bold text-(--fg-1)">Upcoming This Week</h2>
        <div v-if="upcomingStatus === 'loading'" class="text-[13px] text-(--fg-3)">Loading…</div>
        <p v-else-if="!upcoming.length" class="m-0 text-[13px] text-(--fg-3)">Nothing scheduled this week.</p>
        <div v-else class="flex flex-col gap-4">
          <div v-for="(item, i) in upcoming" :key="i" class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-(--ra-md) bg-(--bg-3) border border-(--line-1) flex flex-col items-center justify-center shrink-0">
              <span class="text-[9px] font-semibold text-(--fg-4) uppercase tracking-widest">{{ item.day }}</span>
              <span class="text-sm font-bold text-(--fg-1) leading-none mt-0.5">{{ item.date }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-(--fg-2) leading-snug">{{ item.title }}</div>
              <div class="text-xs text-(--fg-4) mt-0.5">{{ item.time }}</div>
            </div>
          </div>
        </div>
      </RaCard>
    </div>
  </div>
</template>
