<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RaCard, RaButton, RaPathCard } from '@roboacademy/ui'
import { Loader2, AlertTriangle } from 'lucide-vue-next'
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
import { brandingKey } from '@/branding'
import CourseTile from '@/components/courses/CourseTile.vue'
import { enrolledTileProps } from '@/components/courses/course-tile'
import StatCard from '@/components/dashboard/StatCard.vue'
import HeroCarousel, { type HeroSlide } from '@/components/dashboard/HeroCarousel.vue'
import DataTable, { type DataTableColumn } from '@/components/dashboard/DataTable.vue'

const router = useRouter()
const user = getCurrentUser()
const branding = inject(brandingKey, null)

const firstName = computed(() => user?.fullName?.trim().split(/\s+/)[0] ?? 'there')

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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
const totalLessonsCount = computed(() => enrolledCourses.value.reduce((sum, c) => sum + c.totalLessons, 0))
const completedCoursesCount = computed(() => enrolledCourses.value.filter(c => c.courseCompleted).length)

function openCourse(courseId: string) {
  router.push(`/app/courses/${courseId}`)
}

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

interface ActivityEntry {
  id: string
  occurredAt: string
  text: string
  type: 'Lesson' | 'Enrolment' | 'Certificate'
  status: 'Completed' | 'Started' | 'Issued'
  link: string
}

const activity = computed<ActivityEntry[]>(() => {
  const entries: ActivityEntry[] = [
    ...progressEvents.value.map((e): ActivityEntry => ({
      id: `lesson-${e.lessonId}-${e.occurredAt}`,
      occurredAt: e.occurredAt,
      text: `${e.lessonTitle} · ${e.courseTitle}`,
      type: 'Lesson',
      status: 'Completed',
      link: `/app/courses/${e.courseId}`,
    })),
    ...enrolledCourses.value.map((c): ActivityEntry => ({
      id: `enrol-${c.enrolmentId}`,
      occurredAt: c.enrolledAt,
      text: c.title,
      type: 'Enrolment',
      status: 'Started',
      link: `/app/courses/${c.courseId}`,
    })),
    ...certificates.value.map((cert): ActivityEntry => ({
      id: `cert-${cert.id}`,
      occurredAt: cert.issuedAt,
      text: cert.kind === 'Path' ? pathTitleFor(cert.pathId!) : courseTitleFor(cert.courseId!),
      type: 'Certificate',
      status: 'Issued',
      link: cert.kind === 'Path' ? `/app/explore/paths/${cert.pathId}` : `/app/courses/${cert.courseId}`,
    })),
  ]
  return entries
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 5)
})

const activityColumns: DataTableColumn[] = [
  { key: 'date', label: 'Date' },
  { key: 'text', label: 'Activity' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'action', label: '', align: 'right' },
]

const statusTone: Record<ActivityEntry['status'], string> = {
  Completed: 'text-(--success)',
  Issued: 'text-(--success)',
  Started: 'text-(--brand-blue)',
}

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

// Hero carousel — built from whatever real data is available; the tenant welcome slide is
// always present so the carousel never renders empty.
const heroSlides = computed<HeroSlide[]>(() => {
  const slides: HeroSlide[] = []
  const focus = currentFocusCourse.value

  if (focus) {
    slides.push({
      id: `focus-${focus.courseId}`,
      title: focus.title,
      body: focus.nextLessonTitle
        ? `Next up: ${focus.nextModuleTitle ? `${focus.nextModuleTitle} — ` : ''}${focus.nextLessonTitle}`
        : (focus.description ?? 'Pick up where you left off.'),
      ctaLabel: 'Continue Learning',
      imageUrl: focus.thumbnailUrl,
      onCta: () => openCourse(focus.courseId),
    })
  } else if (allEnrolledCoursesCompleted.value) {
    slides.push({
      id: 'all-done',
      title: "You're all caught up!",
      body: "You've completed all your enrolled courses. Explore the catalog to start your next one.",
      ctaLabel: 'Explore Courses',
      onCta: () => router.push('/app/explore'),
    })
  }

  const nextLive = upcomingLiveClasses.value
    .filter(l => Date.parse(l.scheduledStart) >= Date.now())
    .sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart))[0]
  if (nextLive) {
    const when = formatCalendarParts(nextLive.scheduledStart)
    slides.push({
      id: `live-${nextLive.id}`,
      title: nextLive.title,
      body: `Your next live class is on ${when.day} ${when.date} at ${when.time}. Check your timetable often to stay on track.`,
      ctaLabel: 'Go to Class',
      onCta: () => router.push(`/app/live-sessions/${nextLive.id}`),
    })
  }

  slides.push({
    id: 'welcome',
    title: `Hello ${firstName.value}!`,
    body: branding?.value.welcomeMessage
      ?? branding?.value.tagline
      ?? 'Explore courses and learning paths to keep building your robotics skills.',
    ctaLabel: enrolledCourses.value.length ? 'Explore More' : 'Explore Courses',
    imageUrl: branding?.value.featureImageUrl,
    onCta: () => router.push('/app/explore'),
  })

  return slides
})
</script>

<template>
  <div class="flex flex-col gap-9 px-12 pt-12 pb-12 max-w-[1440px] mx-auto max-lg:px-8 max-sm:gap-6 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">Welcome, {{ firstName }}</h1>

    <!-- KPI row -->
    <div class="grid gap-6 grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 -mt-2">
      <StatCard
        label="Active Courses"
        :value="enrolledStatus === 'loading' ? '—' : String(activeCoursesCount)"
        :delta="enrolledStatus === 'loading' ? undefined : String(completedCoursesCount)"
        caption="completed so far"
      />
      <StatCard
        variant="split"
        label="Lessons Completed"
        :value="enrolledStatus === 'loading' ? '—' : String(completedLessonsCount)"
        caption="Completed lessons"
        :secondary-value="enrolledStatus === 'loading' ? '—' : String(totalLessonsCount)"
        secondary-caption="Total across your courses"
      />
      <StatCard
        variant="navy"
        label="Certificates Earned"
        :value="certificatesStatus === 'loading' ? '—' : String(certificatesCount ?? 0)"
        :caption="certificatesStatus === 'error' ? 'Couldn\'t load certificates' : 'across courses and paths'"
        class="max-lg:col-span-2 max-md:col-span-1"
      />
    </div>

    <!-- Hero carousel -->
    <HeroCarousel :slides="heroSlides" />

    <!-- Recent activity -->
    <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
      <h2 class="m-0 mb-6 text-[22px] font-medium text-(--heading)">Recent Activity</h2>
      <div v-if="activityLoading" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Loading…
      </div>
      <p v-else-if="!activity.length" class="m-0 text-[13px] text-(--fg-3)">No activity yet — complete a lesson to see it here.</p>
      <DataTable v-else :columns="activityColumns" :rows="activity" :row-key="row => row.id">
        <template #cell-date="{ row }">{{ formatShortDate(row.occurredAt) }}</template>
        <template #cell-text="{ row }"><span class="line-clamp-1">{{ row.text }}</span></template>
        <template #cell-status="{ row }">
          <span class="inline-flex items-center gap-1.5 text-[13px] font-medium" :class="statusTone[row.status]">
            <span class="w-1.5 h-1.5 rounded-full bg-current" />{{ row.status }}
          </span>
        </template>
        <template #cell-action="{ row }">
          <button class="bg-transparent border-0 p-0 cursor-pointer text-[13px] font-medium text-(--link) hover:underline" @click="router.push(row.link)">View</button>
        </template>
      </DataTable>
    </section>

    <!-- Enrolled courses -->
    <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
      <div class="flex justify-between items-baseline mb-5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <h2 class="m-0 text-[22px] font-medium text-(--heading)">My Courses</h2>
        <button class="text-[13px] font-medium text-(--link) bg-transparent border-0 p-0 cursor-pointer hover:underline" @click="router.push('/app/courses')">View all</button>
      </div>
      <div v-if="enrolledStatus === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Loading…
      </div>
      <div v-else-if="enrolledStatus === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your courses.</p>
        <RaButton variant="secondary" @click="loadEnrolledCourses">Try again</RaButton>
      </div>
      <p v-else-if="!enrolledCourses.length" class="m-0 text-[13px] text-(--fg-3)">
        No enrolled courses yet — <button class="bg-transparent border-0 p-0 cursor-pointer text-(--link) underline" @click="router.push('/app/explore')">explore the catalog</button> to get started.
      </p>
      <div v-else class="grid gap-x-6 gap-y-9 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CourseTile
          v-for="c in enrolledCourses.slice(0, 4)"
          :key="c.enrolmentId"
          v-bind="enrolledTileProps(c)"
          @open="openCourse(c.courseId)"
        />
      </div>
    </section>

    <!-- My learning paths -->
    <section v-if="enrolledPathsStatus === 'error' || enrolledPaths.length" class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
      <div class="flex justify-between items-baseline mb-5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <h2 class="m-0 text-[22px] font-medium text-(--heading)">My Learning Paths</h2>
        <button class="text-[13px] font-medium text-(--link) bg-transparent border-0 p-0 cursor-pointer hover:underline" @click="router.push('/app/explore?tab=paths')">View all</button>
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
    </section>

    <!-- Upcoming + Suggested paths -->
    <div class="grid gap-6 grid-cols-[minmax(0,1fr)_minmax(0,2fr)] max-lg:grid-cols-1">
      <RaCard :padding="24" class="bg-(--surface)! border-0! rounded-(--ra-xl)! shadow-(--surface-shadow)">
        <h2 class="m-0 mb-5 text-[22px] font-medium text-(--heading)">Upcoming This Week</h2>
        <div v-if="upcomingStatus === 'loading'" class="text-[13px] text-(--fg-3)">Loading…</div>
        <p v-else-if="!upcoming.length" class="m-0 text-[13px] text-(--fg-3)">Nothing scheduled this week.</p>
        <div v-else class="flex flex-col gap-4">
          <div v-for="(item, i) in upcoming" :key="i" class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-(--ra-md) bg-(--brand-navy) text-(--brand-navy-fg) flex flex-col items-center justify-center shrink-0">
              <span class="text-[9px] font-semibold uppercase tracking-widest text-(--brand-navy-muted)">{{ item.day }}</span>
              <span class="text-base font-bold leading-none mt-0.5">{{ item.date }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-(--fg-1) leading-snug">{{ item.title }}</div>
              <div class="text-xs text-(--fg-3) mt-0.5">{{ item.time }}</div>
            </div>
          </div>
        </div>
      </RaCard>

      <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
        <div class="flex justify-between items-baseline mb-5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
          <h2 class="m-0 text-[22px] font-medium text-(--heading)">Suggested Learning Paths</h2>
          <button class="text-[13px] font-medium text-(--link) bg-transparent border-0 p-0 cursor-pointer hover:underline" @click="router.push('/app/explore?tab=paths')">Explore all</button>
        </div>
        <div v-if="suggestedPathsStatus === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
          <Loader2 :size="16" class="animate-spin" /> Loading suggestions…
        </div>
        <div v-else-if="suggestedPathsStatus === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
          <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
          <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load suggestions.</p>
          <RaButton variant="secondary" @click="loadSuggestedPaths">Try again</RaButton>
        </div>
        <p v-else-if="!suggestedPaths.length" class="m-0 text-[13px] text-(--fg-3)">
          No suggestions yet — <button class="bg-transparent border-0 p-0 cursor-pointer text-(--link) underline" @click="router.push('/app/explore?tab=paths')">explore learning paths</button> to find your next one.
        </p>
        <div v-else class="grid gap-4.5 grid-cols-1 sm:grid-cols-2">
          <PathCatalogCard
            v-for="p in suggestedPaths.slice(0, 2)"
            :key="p.id"
            :id="p.id"
            :title="p.title"
            :description="p.description"
            :thumbnail-url="p.thumbnailUrl"
            :course-count="p.courseCount"
          />
        </div>
      </section>
    </div>

    <!-- Recommended courses -->
    <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
      <div class="flex justify-between items-baseline mb-5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <h2 class="m-0 text-[22px] font-medium text-(--heading)">Check Out These Courses</h2>
        <button class="text-[13px] font-medium text-(--link) bg-transparent border-0 p-0 cursor-pointer hover:underline" @click="router.push('/app/explore')">Explore all</button>
      </div>
      <div v-if="recommendedStatus === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Loading recommendations…
      </div>
      <div v-else-if="recommendedStatus === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load recommendations.</p>
        <RaButton variant="secondary" @click="loadRecommendedCourses">Try again</RaButton>
      </div>
      <p v-else-if="!recommendedCourses.length" class="m-0 text-[13px] text-(--fg-3)">
        No recommendations yet — <button class="bg-transparent border-0 p-0 cursor-pointer text-(--link) underline" @click="router.push('/app/explore')">explore the catalog</button> to find your next course.
      </p>
      <div v-else class="grid gap-x-6 gap-y-9 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CourseCatalogCard v-for="course in recommendedCourses" :key="course.id" v-bind="course" />
      </div>
    </section>
  </div>
</template>
