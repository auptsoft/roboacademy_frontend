<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { RouterLink } from 'vue-router'
import { Radio, Users, CalendarClock } from 'lucide-vue-next'
import { RaCard, RaChip, RaButton, formatDate } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import {
  getMyLiveClasses, listLiveClasses, bookLiveClass, cancelLiveClassBooking,
  getMyEnrolledCourses,
  type LiveClassSummary, type LiveClassStatus,
} from '@/api/learning'

const booked = shallowRef<LiveClassSummary[]>([])
const available = shallowRef<LiveClassSummary[]>([])
const courseTitles = ref<Record<string, string>>({})
const loadState = ref<'loading' | 'idle' | 'error'>('loading')
const actionId = ref<string | null>(null)
const actionError = ref('')

const statusTone: Record<LiveClassStatus, 'admin' | 'info' | 'neutral'> = {
  Live: 'admin',
  Scheduled: 'info',
  Ended: 'neutral',
  Cancelled: 'neutral',
}

// A live class carries only a courseId, and there is no "live classes for my courses" endpoint,
// so the course titles and the discoverable set are both joined here - the same shape as
// getMyEnrolledCourses/getMyEnrolledPaths in the API layer.
// `silent` refreshes in place after a book/cancel, so the whole page does not flash back to
// its loading state for what is a single-row change.
async function load(silent = false) {
  if (!silent) loadState.value = 'loading'
  actionError.value = ''
  try {
    const [mine, courses] = await Promise.all([getMyLiveClasses({ pageSize: 50 }), getMyEnrolledCourses()])

    courseTitles.value = Object.fromEntries(courses.map(c => [c.courseId, c.title]))
    booked.value = mine.data

    const bookedIds = new Set(mine.data.map(c => c.id))
    // One course failing to list must not blank the whole page.
    const perCourse = await Promise.all(
      courses.map(c => listLiveClasses({ courseId: c.courseId }).then(r => r.data).catch(() => [])),
    )
    available.value = perCourse
      .flat()
      .filter(c => !bookedIds.has(c.id) && c.status !== 'Cancelled' && c.status !== 'Ended')

    loadState.value = 'idle'
  } catch {
    if (!silent) loadState.value = 'error'
  }
}
onMounted(() => load())

// Live first, then anything still to come, then what has already happened.
const mySessions = computed(() => {
  const rank = (c: LiveClassSummary) => (c.status === 'Live' ? 0 : c.status === 'Scheduled' ? 1 : 2)
  return [...booked.value].sort(
    (a, b) => rank(a) - rank(b) || a.scheduledStart.localeCompare(b.scheduledStart),
  )
})

const availableSorted = computed(() =>
  [...available.value].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)),
)

const isEmpty = computed(
  () => loadState.value === 'idle' && mySessions.value.length === 0 && availableSorted.value.length === 0,
)

function courseTitle(courseId: string) {
  return courseTitles.value[courseId] ?? 'Your course'
}

function isPast(session: LiveClassSummary) {
  return session.status === 'Ended' || session.status === 'Cancelled'
}

async function run(liveClassId: string, action: (id: string) => Promise<unknown>) {
  actionId.value = liveClassId
  actionError.value = ''
  try {
    await action(liveClassId)
    await load(true)
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  } finally {
    actionId.value = null
  }
}
</script>

<template>
  <div class="live-page">
    <header class="live-page__header">
      <div>
        <h1 class="live-page__title">Live Sessions</h1>
        <p class="live-page__subtitle">Instructor-led classes for the courses you are enrolled in.</p>
      </div>
    </header>

    <p v-if="loadState === 'loading'" class="live-page__note">Loading your live sessions&hellip;</p>
    <p v-else-if="loadState === 'error'" class="live-page__note">Your live sessions could not be loaded.</p>

    <RaCard v-else-if="isEmpty" :padding="32" class="live-page__empty">
      <Radio :size="40" class="live-page__empty-icon" />
      <h2 class="live-page__empty-title">No live sessions yet</h2>
      <p class="live-page__note">
        Live classes are scheduled by instructors on the courses you take. Enrol in a course to see them here.
      </p>
      <RouterLink to="/app/courses" class="simple-link">Go to my courses</RouterLink>
    </RaCard>

    <template v-else>
      <p v-if="actionError" class="live-page__error">{{ actionError }}</p>

      <section v-if="mySessions.length" class="live-page__section">
        <h2 class="live-page__section-title">My sessions</h2>
        <RaCard
          v-for="session in mySessions"
          :key="session.id"
          :padding="20"
          class="live-row"
          :class="{ 'live-row--past': isPast(session) }"
        >
          <div class="live-row__main">
            <div class="live-row__heading">
              <RouterLink :to="`/app/live-sessions/${session.id}`" class="live-row__title">{{ session.title }}</RouterLink>
              <RaChip :tone="statusTone[session.status]">{{ session.status }}</RaChip>
            </div>
            <p class="live-row__meta">
              <span>{{ courseTitle(session.courseId) }}</span>
              <span class="live-row__dot">&middot;</span>
              <CalendarClock :size="13" />
              <span>{{ formatDate(session.scheduledStart) }}</span>
            </p>
          </div>

          <div class="live-row__actions">
            <RouterLink v-if="session.status === 'Live'" :to="`/app/live-sessions/${session.id}`">
              <RaButton>Join now</RaButton>
            </RouterLink>
            <RaButton
              v-else-if="session.status === 'Scheduled'"
              variant="secondary"
              :disabled="actionId === session.id"
              @click="run(session.id, cancelLiveClassBooking)"
            >
              {{ actionId === session.id ? 'Cancelling…' : 'Cancel booking' }}
            </RaButton>
          </div>
        </RaCard>
      </section>

      <section v-if="availableSorted.length" class="live-page__section">
        <h2 class="live-page__section-title">Available in your courses</h2>
        <RaCard v-for="session in availableSorted" :key="session.id" :padding="20" class="live-row">
          <div class="live-row__main">
            <div class="live-row__heading">
              <RouterLink :to="`/app/live-sessions/${session.id}`" class="live-row__title">{{ session.title }}</RouterLink>
              <RaChip :tone="statusTone[session.status]">{{ session.status }}</RaChip>
            </div>
            <p class="live-row__meta">
              <span>{{ courseTitle(session.courseId) }}</span>
              <span class="live-row__dot">&middot;</span>
              <CalendarClock :size="13" />
              <span>{{ formatDate(session.scheduledStart) }}</span>
            </p>
          </div>

          <div class="live-row__actions">
            <RaButton
              variant="secondary"
              :disabled="actionId === session.id"
              @click="run(session.id, bookLiveClass)"
            >
              <template #icon><Users :size="14" /></template>
              {{ actionId === session.id ? 'Booking…' : 'Book a seat' }}
            </RaButton>
          </div>
        </RaCard>
      </section>
    </template>
  </div>
</template>

<style scoped>
.live-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.live-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.live-page__title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--fg-1);
}

.live-page__subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--fg-3);
}

.live-page__note {
  margin: 0;
  font-size: 14px;
  color: var(--fg-3);
}

.live-page__error {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--danger);
}

.live-page__section {
  margin-top: 28px;
}

.live-page__section-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-3);
}

.live-page__empty {
  text-align: center;
}

.live-page__empty-icon {
  color: var(--fg-3);
}

.live-page__empty-title {
  margin: 12px 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--fg-1);
}

.live-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.live-row--past {
  opacity: 0.6;
}

.live-row__main {
  min-width: 0;
}

.live-row__heading {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.live-row__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg-1);
  text-decoration: none;
}

.live-row__title:hover {
  text-decoration: underline;
}

.live-row__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--fg-3);
}

.live-row__dot {
  opacity: 0.6;
}

.live-row__actions {
  flex: 0 0 auto;
}

@media (max-width: 640px) {
  .live-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
