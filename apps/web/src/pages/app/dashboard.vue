<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { RaCard, RaButton } from '@roboacademy/ui'
import { Loader2, AlertTriangle } from 'lucide-vue-next'
import {
  getMyEnrolledCourses, listCourseCatalog, getMyProgressEvents, getMyLiveClasses,
  getMyEnrolledPaths, getSuggestedLearningPaths,
  type EnrolledCourseSummary, type CourseCatalogItem, type ProgressEventItem, type LiveClassSummary,
  type EnrolledPathSummary, type LearningPathItem,
} from '@/api/learning'
import PathCatalogCard from '@/components/explore/PathCatalogCard.vue'
import { getMyCertificates, type CertificateItem } from '@/api/certification'
import { getMyCalendar, type CalendarItem } from '@/api/scheduling'
import CourseCatalogCard from '@/components/explore/CourseCatalogCard.vue'
import { getCurrentUser } from '@/store/auth'
import { useCachedQuery } from '@/composables/useCachedQuery'
import { brandingKey } from '@/branding'
import CourseTile from '@/components/courses/CourseTile.vue'
import { enrolledTileProps, enrolledPathTileProps } from '@/components/courses/course-tile'
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
const {
  data: enrolledCoursesData, status: enrolledStatus, load: loadEnrolledCourses,
} = useCachedQuery('dashboard:enrolled-courses', getMyEnrolledCourses)
const enrolledCourses = computed<EnrolledCourseSummary[]>(() => enrolledCoursesData.value ?? [])

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
const { data: certificatesData, status: certificatesStatus } =
  useCachedQuery('dashboard:certificates', () => getMyCertificates({ pageSize: 100 }))
const certificates = computed<CertificateItem[]>(() => certificatesData.value?.data ?? [])
const certificatesCount = computed(() => certificatesData.value?.meta.totalCount ?? null)

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
const {
  data: recommendedData, status: recommendedStatus, load: loadRecommendedCourses,
} = useCachedQuery('dashboard:recommended-courses', () => listCourseCatalog({ pageSize: 12 }))
const recommendedRaw = computed<CourseCatalogItem[]>(() => recommendedData.value?.data ?? [])

const enrolledCourseIds = computed(() => new Set(enrolledCourses.value.map(c => c.courseId)))
const recommendedCourses = computed(() =>
  recommendedRaw.value.filter(c => !enrolledCourseIds.value.has(c.id)).slice(0, 3),
)

// My learning paths
const {
  data: enrolledPathsData, status: enrolledPathsStatus, load: loadEnrolledPaths,
} = useCachedQuery('dashboard:enrolled-paths', getMyEnrolledPaths)
const enrolledPaths = computed<EnrolledPathSummary[]>(() => enrolledPathsData.value ?? [])

function openPath(pathId: string) {
  router.push(`/app/explore/paths/${pathId}`)
}

// Suggested learning paths — backend already excludes paths the user has started.
const {
  data: suggestedPathsData, status: suggestedPathsStatus, load: loadSuggestedPaths,
} = useCachedQuery('dashboard:suggested-paths', () => getSuggestedLearningPaths({ pageSize: 4 }))
const suggestedPaths = computed<LearningPathItem[]>(() => suggestedPathsData.value?.data ?? [])

// Recent activity — merged from real progress events, enrolments, and certificates.
const { data: progressEventsData, status: activityStatus } =
  useCachedQuery('dashboard:progress-events', () => getMyProgressEvents({ pageSize: 10 }))
const progressEvents = computed<ProgressEventItem[]>(() => progressEventsData.value?.data ?? [])

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
      link: '/app/certificates',
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

// Upcoming this week — the unified calendar (booked live classes, lab sessions, events).
// Booked live classes are still loaded on their own for the hero carousel's "next live" slide.
const { data: upcomingData, status: upcomingStatus } = useCachedQuery('dashboard:upcoming', async () => {
  const now = new Date()
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const [liveClasses, calendar] = await Promise.all([
    getMyLiveClasses(),
    getMyCalendar(now, weekAhead),
  ])
  return { liveClasses: liveClasses.data, calendar }
})
const upcomingLiveClasses = computed<LiveClassSummary[]>(() => upcomingData.value?.liveClasses ?? [])
const calendarItems = computed<CalendarItem[]>(() => upcomingData.value?.calendar ?? [])

const upcoming = computed(() => {
  const now = Date.now()
  return calendarItems.value
    // Events show up whether or not you've RSVPed; bookings only because you made them.
    .filter(i => i.status !== 'Cancelled' && Date.parse(i.startsAt) >= now)
    .slice(0, 4)
    .map(i => ({ title: i.title, link: i.linkPath, ...formatCalendarParts(i.startsAt) }))
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
      <div v-else class="grid gap-x-6 gap-y-9 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CourseTile
          v-for="p in enrolledPaths.slice(0, 4)"
          :key="p.pathEnrolmentId"
          v-bind="enrolledPathTileProps(p)"
          @open="openPath(p.pathId)"
        />
      </div>
    </section>

    <!-- Upcoming + Suggested paths -->
    <div class="grid gap-6 grid-cols-[minmax(0,1fr)_minmax(0,2fr)] max-lg:grid-cols-1">
      <RaCard :padding="24" class="bg-(--surface)! border-0! rounded-(--ra-xl)! shadow-(--surface-shadow)">
        <div class="flex justify-between items-baseline mb-5">
          <h2 class="m-0 text-[22px] font-medium text-(--heading)">Upcoming This Week</h2>
          <button class="text-[13px] font-medium text-(--link) bg-transparent border-0 p-0 cursor-pointer hover:underline" @click="router.push('/app/calendar')">Calendar</button>
        </div>
        <div v-if="upcomingStatus === 'loading'" class="text-[13px] text-(--fg-3)">Loading…</div>
        <p v-else-if="!upcoming.length" class="m-0 text-[13px] text-(--fg-3)">Nothing scheduled this week.</p>
        <div v-else class="flex flex-col gap-4">
          <button v-for="(item, i) in upcoming" :key="i" class="flex items-center gap-3 w-full text-left bg-transparent border-0 p-0 cursor-pointer group" @click="router.push(item.link)">
            <div class="w-12 h-12 rounded-(--ra-md) bg-(--brand-navy) text-(--brand-navy-fg) flex flex-col items-center justify-center shrink-0">
              <span class="text-[9px] font-semibold uppercase tracking-widest text-(--brand-navy-muted)">{{ item.day }}</span>
              <span class="text-base font-bold leading-none mt-0.5">{{ item.date }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-(--fg-1) leading-snug group-hover:underline">{{ item.title }}</div>
              <div class="text-xs text-(--fg-3) mt-0.5">{{ item.time }}</div>
            </div>
          </button>
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
        <div v-else class="grid gap-x-6 gap-y-9 grid-cols-1 sm:grid-cols-2">
          <PathCatalogCard
            v-for="p in suggestedPaths.slice(0, 2)"
            :key="p.id"
            v-bind="p"
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
