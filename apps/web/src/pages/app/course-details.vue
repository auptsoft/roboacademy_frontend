<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RaButton, RaChip } from '@roboacademy/ui'
import { ArrowLeft, ArrowRight, Loader2, AlertTriangle, Compass, Play, Video, BookOpen, Puzzle, Cpu, FileText } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { getCourse, getCourseIntroVideoUrl, enrolInCourse, getMyEnrolments, withdrawEnrolment, type CourseDetail } from '@/api/learning'

const route = useRoute()
const router = useRouter()

const lessonTypeIcon = { Video, Reading: BookOpen, Interactive: Puzzle, Simulation: Cpu, Pdf: FileText } as const

const status = ref<'loading' | 'idle' | 'error' | 'not-found'>('loading')
const errorMessage = ref('')
const course = ref<CourseDetail | null>(null)

const enrollState = ref<'idle' | 'enrolling' | 'enrolled' | 'error'>('idle')
const enrollError = ref('')
const enrolmentId = ref<string | null>(null)

const unenrollState = ref<'idle' | 'unenrolling' | 'error'>('idle')
const unenrollError = ref('')

const videoState = ref<'idle' | 'loading' | 'playing' | 'error'>('idle')
const videoUrl = ref<string | null>(null)
const videoError = ref('')

async function load() {
  status.value = 'loading'
  errorMessage.value = ''
  videoState.value = 'idle'
  videoUrl.value = null
  enrollState.value = 'idle'
  enrollError.value = ''
  enrolmentId.value = null
  unenrollState.value = 'idle'
  unenrollError.value = ''
  try {
    const courseId = route.params.id as string
    course.value = await getCourse(courseId)
    status.value = 'idle'
    await checkEnrolment(courseId)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      status.value = 'not-found'
    } else {
      status.value = 'error'
      errorMessage.value = err instanceof ApiError ? err.message : 'Something went wrong.'
    }
  }
}

// Best-effort — if this fails to load, the Enroll button still works and falls back to the
// 409 → 'enrolled' handling in enroll() for users who are already enrolled.
async function checkEnrolment(courseId: string) {
  try {
    const { data } = await getMyEnrolments()
    const enrolment = data.find(e => e.courseId === courseId && e.status !== 'Withdrawn')
    if (enrolment) {
      enrollState.value = 'enrolled'
      enrolmentId.value = enrolment.id
    }
  } catch {
    // ignore — see comment above
  }
}

async function playIntroVideo() {
  if (!course.value) return
  videoState.value = 'loading'
  videoError.value = ''
  try {
    const result = await getCourseIntroVideoUrl(course.value.id)
    videoUrl.value = result.url
    videoState.value = 'playing'
  } catch (err) {
    videoState.value = 'error'
    videoError.value = err instanceof ApiError ? err.message : 'Unable to load video.'
  }
}

async function enroll() {
  if (!course.value) return
  enrollState.value = 'enrolling'
  enrollError.value = ''
  try {
    const result = await enrolInCourse(course.value.id)
    enrollState.value = 'enrolled'
    enrolmentId.value = result.enrolmentId
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      enrollState.value = 'enrolled'
      await checkEnrolment(course.value.id)
    } else {
      enrollState.value = 'error'
      enrollError.value = err instanceof ApiError ? err.message : 'Something went wrong.'
    }
  }
}

async function unenroll() {
  if (!enrolmentId.value) return
  if (!window.confirm('Unenroll from this course? You can re-enrol later, but you will lose access until then.')) return
  unenrollState.value = 'unenrolling'
  unenrollError.value = ''
  try {
    await withdrawEnrolment(enrolmentId.value)
    enrollState.value = 'idle'
    enrolmentId.value = null
    unenrollState.value = 'idle'
  } catch (err) {
    unenrollState.value = 'error'
    unenrollError.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  }
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
      <p class="m-0 text-[13px] text-(--fg-3)">Loading course…</p>
    </div>

    <!-- Not found -->
    <div v-else-if="status === 'not-found'" class="flex flex-col items-center gap-3 py-24 text-center">
      <div class="w-12 h-12 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-4)"><Compass :size="22" /></div>
      <div class="text-sm font-semibold text-(--fg-1)">Course not found</div>
      <p class="m-0 text-[13px] text-(--fg-3) max-w-80">This course may have been removed, or the link is incorrect.</p>
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
    <template v-else-if="course">
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
              :style="course.thumbnailUrl ? { backgroundImage: `url(${course.thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined"
              :class="!course.thumbnailUrl && 'bg-[repeating-linear-gradient(135deg,var(--ph-stripe)_0_12px,transparent_12px_24px)]'"
            />
            <button
              v-if="course.introVideoReference"
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

        <!-- Aside: course details + enroll (sticky on wide screens) -->
        <aside class="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-8 lg:self-start lg:bg-(--bg-2) lg:border lg:border-(--line-1) lg:rounded-(--ra-xl) lg:p-5">
          <div class="flex gap-2 flex-wrap items-center">
            <RaChip v-if="course.category" tone="info">{{ course.category }}</RaChip>
            <RaChip v-if="course.level" tone="neutral">{{ course.level }}</RaChip>
            <RaChip v-if="course.state !== 'Published'" tone="overlay">{{ course.state }}</RaChip>
          </div>

          <div>
            <template v-if="enrollState === 'enrolled'">
              <RaButton class="w-full justify-center" @click="router.push(`/app/courses/${course.id}`)">
                Enrolled - Go to course
                <template #icon-right><ArrowRight :size="14" /></template>
              </RaButton>
              <button
                class="mt-2 w-full text-center text-[13px] text-(--fg-3) bg-transparent border-0 cursor-pointer hover:text-(--danger) disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="unenrollState === 'unenrolling'"
                @click="unenroll"
              >{{ unenrollState === 'unenrolling' ? 'Unenrolling…' : 'Unenroll' }}</button>
            </template>
            <RaButton v-else class="w-full justify-center" :disabled="enrollState === 'enrolling'" @click="enroll">
              {{ enrollState === 'enrolling' ? 'Enrolling…' : 'Enroll Now' }}
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
            <h1 class="m-0 text-[32px] font-bold text-(--fg-1) tracking-[-0.01em] max-sm:text-2xl">{{ course.title }}</h1>
            <p v-if="course.description" class="mt-3 mb-0 text-base text-(--fg-2) leading-[1.5] max-w-180">{{ course.description }}</p>
          </div>

          <template v-if="course.longDescription">
            <hr class="m-0 border-0 border-t border-(--line-1)" />
            <p class="m-0 text-sm text-(--fg-2) leading-[1.7] max-w-180" v-html="course.longDescription"></p>
          </template>
        </div>

        <!-- Course content -->
        <div class="flex flex-col gap-4 lg:col-start-1 lg:row-start-3">
          <h2 class="m-0 text-xl font-bold text-(--fg-1)">Course content</h2>

          <p v-if="!course.modules.length" class="m-0 text-[13px] text-(--fg-3)">No modules published yet.</p>

          <div v-for="mod in course.modules" :key="mod.id" class="rounded-(--ra-xl) border border-(--line-1) overflow-hidden">
            <div class="px-5 py-4 border-b border-(--line-1) bg-(--bg-2)">
              <div class="text-[15px] font-bold text-(--fg-1)">{{ String(mod.order).padStart(2, '0') }}. {{ mod.title }}</div>
              <p v-if="mod.description" class="mt-1 mb-0 text-[13px] text-(--fg-3)">{{ mod.description }}</p>
            </div>
            <div class="flex flex-col">
              <div
                v-for="lesson in mod.lessons" :key="lesson.id"
                class="flex items-center gap-3 px-5 py-3 border-b border-(--line-1) last:border-b-0 text-sm text-(--fg-2)"
              >
                <component :is="lessonTypeIcon[lesson.type]" :size="14" class="text-(--fg-4) shrink-0" />
                <span class="text-(--fg-4) text-xs w-5 shrink-0">{{ String(lesson.order).padStart(2, '0') }}</span>
                <span class="flex-1">{{ lesson.title }}</span>
                <RaChip :tone="lesson.isRequired ? 'student' : 'neutral'">{{ lesson.isRequired ? 'Required' : 'Optional' }}</RaChip>
              </div>
              <p v-if="!mod.lessons.length" class="px-5 py-3 m-0 text-[13px] text-(--fg-3)">No lessons in this module yet.</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
