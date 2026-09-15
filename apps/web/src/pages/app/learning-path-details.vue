<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RaButton, RaChip, RaProgress } from '@roboacademy/ui'
import { ArrowLeft, ArrowRight, Loader2, AlertTriangle, Compass, Play, Layers } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import {
  getLearningPath, getLearningPathIntroVideoUrl, getPathProgress, getMyPathEnrolments,
  startLearningPath, withdrawPathEnrolment,
  type LearningPathDetail, type PathProgress,
} from '@/api/learning'

const route = useRoute()
const router = useRouter()

const status = ref<'loading' | 'idle' | 'error' | 'not-found'>('loading')
const errorMessage = ref('')
const path = ref<LearningPathDetail | null>(null)
const progress = ref<PathProgress | null>(null)

const enrollState = ref<'idle' | 'enrolling' | 'enrolled' | 'error'>('idle')
const enrollError = ref('')
const pathEnrolmentId = ref<string | null>(null)

const unenrollState = ref<'idle' | 'unenrolling' | 'error'>('idle')
const unenrollError = ref('')

const videoState = ref<'idle' | 'loading' | 'playing' | 'error'>('idle')
const videoUrl = ref<string | null>(null)
const videoError = ref('')

const completedStepCount = computed(() =>
  progress.value?.steps.filter(s => s.status === 'Completed').length ?? 0)
const totalStepCount = computed(() => path.value?.steps.length ?? 0)
const progressPercent = computed(() =>
  totalStepCount.value > 0 ? Math.round((completedStepCount.value / totalStepCount.value) * 100) : 0)

const stepChipTone: Record<string, 'overlay' | 'neutral' | 'info' | 'instructor'> = {
  Locked: 'overlay',
  Unlocked: 'neutral',
  InProgress: 'info',
  Completed: 'instructor',
}

function stepStatus(courseId: string): string {
  return progress.value?.steps.find(s => s.courseId === courseId)?.status ?? 'Unlocked'
}

async function load() {
  status.value = 'loading'
  errorMessage.value = ''
  videoState.value = 'idle'
  videoUrl.value = null
  enrollState.value = 'idle'
  enrollError.value = ''
  pathEnrolmentId.value = null
  unenrollState.value = 'idle'
  unenrollError.value = ''
  progress.value = null
  try {
    const pathId = route.params.id as string
    path.value = await getLearningPath(pathId)
    status.value = 'idle'
    await Promise.all([checkEnrolment(pathId), loadProgress(pathId)])
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      status.value = 'not-found'
    } else {
      status.value = 'error'
      errorMessage.value = err instanceof ApiError ? err.message : 'Something went wrong.'
    }
  }
}

async function loadProgress(pathId: string) {
  try {
    progress.value = await getPathProgress(pathId)
  } catch {
    // Best-effort — steps just fall back to the default 'Unlocked' chip if this fails.
  }
}

// Best-effort — if this fails to load, the Start button still works and falls back to the
// 409 → 'enrolled' handling in enroll() for users who already started this path.
async function checkEnrolment(pathId: string) {
  try {
    const { data } = await getMyPathEnrolments()
    const enrolment = data.find(e => e.learningPathId === pathId && e.status !== 'Withdrawn')
    if (enrolment) {
      enrollState.value = 'enrolled'
      pathEnrolmentId.value = enrolment.id
    }
  } catch {
    // ignore — see comment above
  }
}

async function playIntroVideo() {
  if (!path.value) return
  videoState.value = 'loading'
  videoError.value = ''
  try {
    const result = await getLearningPathIntroVideoUrl(path.value.id)
    videoUrl.value = result.url
    videoState.value = 'playing'
  } catch (err) {
    videoState.value = 'error'
    videoError.value = err instanceof ApiError ? err.message : 'Unable to load video.'
  }
}

async function enroll() {
  if (!path.value) return
  enrollState.value = 'enrolling'
  enrollError.value = ''
  try {
    const result = await startLearningPath(path.value.id)
    enrollState.value = 'enrolled'
    pathEnrolmentId.value = result.pathEnrolmentId
    await loadProgress(path.value.id)
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      enrollState.value = 'enrolled'
      await checkEnrolment(path.value.id)
    } else {
      enrollState.value = 'error'
      enrollError.value = err instanceof ApiError ? err.message : 'Something went wrong.'
    }
  }
}

async function unenroll() {
  if (!pathEnrolmentId.value) return
  if (!window.confirm('Leave this learning path? Your progress in its courses is kept — only the path enrolment is removed.')) return
  unenrollState.value = 'unenrolling'
  unenrollError.value = ''
  try {
    await withdrawPathEnrolment(pathEnrolmentId.value)
    enrollState.value = 'idle'
    pathEnrolmentId.value = null
    unenrollState.value = 'idle'
  } catch (err) {
    unenrollState.value = 'error'
    unenrollError.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  }
}

function viewCourse(courseId: string) {
  router.push(`/app/explore/courses/${courseId}`)
}

watch(() => route.params.id, load, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-7 px-8 pt-8 pb-12 max-w-(--content-max) mx-auto max-sm:gap-5 max-sm:px-4 max-sm:pt-5 max-sm:pb-8">
    <button
      class="inline-flex items-center gap-1.5 self-start text-[13px] text-(--fg-3) bg-transparent border-0 p-0 cursor-pointer hover:text-(--fg-1)"
      @click="router.push('/app/explore')"
    ><ArrowLeft :size="14" /> Back to Explore</button>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="flex flex-col items-center gap-3 py-24 text-center">
      <Loader2 :size="22" class="animate-spin text-(--fg-4)" />
      <p class="m-0 text-[13px] text-(--fg-3)">Loading learning path…</p>
    </div>

    <!-- Not found -->
    <div v-else-if="status === 'not-found'" class="flex flex-col items-center gap-3 py-24 text-center">
      <div class="w-12 h-12 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-4)"><Compass :size="22" /></div>
      <div class="text-sm font-semibold text-(--fg-1)">Learning path not found</div>
      <p class="m-0 text-[13px] text-(--fg-3) max-w-80">This learning path may have been removed, or the link is incorrect.</p>
      <RaButton variant="secondary" @click="router.push('/app/explore')">Back to Explore</RaButton>
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="flex flex-col items-center gap-3 py-24 text-center">
      <div class="w-12 h-12 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="22" /></div>
      <div class="text-sm font-semibold text-(--fg-1)">Something went wrong</div>
      <p class="m-0 text-[13px] text-(--fg-3) max-w-80">{{ errorMessage }}</p>
      <RaButton variant="secondary" @click="load">Try again</RaButton>
    </div>

    <!-- Content -->
    <template v-else-if="path">
      <div class="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:items-start">
        <!-- Video / thumbnail banner -->
        <div class="lg:col-start-1 lg:row-start-1">
          <!-- Playing: sized to the video's own aspect ratio, no cropping -->
          <div v-if="videoState === 'playing' && videoUrl" class="rounded-(--ra-xl) border border-(--line-1) overflow-hidden bg-black">
            <video :src="videoUrl" controls autoplay class="block w-full h-auto max-h-[70vh] mx-auto" />
          </div>

          <!-- Thumbnail / placeholder banner with play overlay -->
          <div v-else class="relative h-56 rounded-(--ra-xl) bg-(--bg-3) border border-(--line-1) overflow-hidden max-sm:h-40">
            <div
              class="w-full h-full"
              :style="path.thumbnailUrl ? { backgroundImage: `url(${path.thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined"
              :class="!path.thumbnailUrl && 'bg-[repeating-linear-gradient(135deg,var(--ph-stripe)_0_12px,transparent_12px_24px)]'"
            />
            <button
              v-if="path.introVideoReference"
              class="absolute inset-0 flex items-center justify-center bg-black/15 hover:bg-black/30 transition-colors duration-(--dur-1) ease-(--ease-out) border-0 cursor-pointer p-0"
              :disabled="videoState === 'loading'"
              @click="playIntroVideo"
            >
              <span class="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                <Loader2 v-if="videoState === 'loading'" :size="22" class="animate-spin text-black/80" />
                <Play v-else :size="22" class="text-black/80 ml-0.5" />
              </span>
            </button>
          </div>
          <p v-if="videoState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ videoError }}</p>
        </div>

        <!-- Aside: path summary (sticky on wide screens) -->
        <aside class="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-8 lg:self-start lg:bg-(--bg-2) lg:border lg:border-(--line-1) lg:rounded-(--ra-xl) lg:p-5">
          <div class="flex gap-2 flex-wrap items-center">
            <RaChip tone="neutral">
              <span class="inline-flex items-center gap-1"><Layers :size="11" />{{ path.steps.length }} {{ path.steps.length === 1 ? 'course' : 'courses' }}</span>
            </RaChip>
            <RaChip v-if="path.state !== 'Published'" tone="overlay">{{ path.state }}</RaChip>
          </div>

          <div v-if="enrollState === 'enrolled'" class="flex flex-col gap-1.5">
            <div class="flex justify-between items-baseline text-xs text-(--fg-3)">
              <span>Progress</span>
              <span>{{ completedStepCount }}/{{ totalStepCount }} courses</span>
            </div>
            <RaProgress :value="progressPercent" />
          </div>

          <div>
            <template v-if="enrollState === 'enrolled'">
              <RaButton
                class="w-full justify-center"
                @click="viewCourse(path.steps[0]?.courseId ?? '')"
              >
                Continue Learning Path
                <template #icon-right><ArrowRight :size="14" /></template>
              </RaButton>
              <button
                class="mt-2 w-full text-center text-[13px] text-(--fg-3) bg-transparent border-0 cursor-pointer hover:text-(--danger) disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="unenrollState === 'unenrolling'"
                @click="unenroll"
              >{{ unenrollState === 'unenrolling' ? 'Leaving…' : 'Leave Learning Path' }}</button>
            </template>
            <RaButton v-else class="w-full justify-center" :disabled="enrollState === 'enrolling'" @click="enroll">
              {{ enrollState === 'enrolling' ? 'Starting…' : 'Start Learning Path' }}
              <template #icon-right>
                <Loader2 v-if="enrollState === 'enrolling'" :size="14" class="animate-spin" />
                <ArrowRight v-else :size="14" />
              </template>
            </RaButton>
            <p v-if="enrollState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ enrollError }}</p>
            <p v-if="unenrollState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ unenrollError }}</p>
          </div>
        </aside>

        <!-- Title / description -->
        <div class="flex flex-col gap-5 lg:col-start-1 lg:row-start-2">
          <div>
            <h1 class="m-0 text-[32px] font-bold text-(--fg-1) tracking-[-0.01em] max-sm:text-2xl">{{ path.title }}</h1>
            <p v-if="path.description" class="mt-3 mb-0 text-base text-(--fg-2) leading-[1.5] max-w-180">{{ path.description }}</p>
          </div>

          <template v-if="path.longDescription">
            <hr class="m-0 border-0 border-t border-(--line-1)" />
            <p class="m-0 text-sm text-(--fg-2) leading-[1.7] max-w-180" v-html="path.longDescription"></p>
          </template>
        </div>

        <!-- Steps -->
        <div class="flex flex-col gap-4 lg:col-start-1 lg:row-start-3">
          <h2 class="m-0 text-xl font-bold text-(--fg-1)">Steps</h2>

          <p v-if="!path.steps.length" class="m-0 text-[13px] text-(--fg-3)">No steps published yet.</p>

          <button
            v-for="step in path.steps"
            :key="step.courseId"
            class="flex items-center gap-3 rounded-(--ra-xl) border border-(--line-1) bg-(--bg-2) px-5 py-4 text-left cursor-pointer transition-colors duration-(--dur-1) ease-(--ease-out) hover:border-(--line-2)"
            @click="viewCourse(step.courseId)"
          >
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-(--bg-3) text-xs font-semibold text-(--fg-2)">{{ step.order }}</span>
            <span class="flex-1 text-sm font-semibold text-(--fg-1)">{{ step.courseTitle }}</span>
            <RaChip :tone="stepChipTone[stepStatus(step.courseId)]" class="shrink-0">{{ stepStatus(step.courseId) }}</RaChip>
            <ArrowRight :size="14" class="shrink-0 text-(--fg-4)" />
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
