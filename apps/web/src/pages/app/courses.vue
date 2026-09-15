<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RaButton, RaCourseCard } from '@roboacademy/ui'
import { Loader2, AlertTriangle, Compass } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { getMyEnrolledCourses, type EnrolledCourseSummary } from '@/api/learning'

const router = useRouter()

const status = ref<'loading' | 'idle' | 'error'>('loading')
const errorMessage = ref('')
const courses = ref<EnrolledCourseSummary[]>([])

async function load() {
  status.value = 'loading'
  errorMessage.value = ''
  try {
    courses.value = await getMyEnrolledCourses()
    status.value = 'idle'
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  }
}

function cardStatus(c: EnrolledCourseSummary): string {
  if (c.courseCompleted) return 'Completed'
  if (c.completedLessons === 0) return 'New'
  return 'In Progress'
}

function openCourse(courseId: string) {
  router.push(`/app/courses/${courseId}`)
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-7 px-8 pt-8 pb-12 max-w-(--content-max) mx-auto max-sm:gap-5 max-sm:px-4 max-sm:pt-5 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold text-(--fg-1) tracking-[-0.01em] max-sm:text-2xl">Enrolled Courses</h1>
      <p class="mt-2 mb-0 text-sm text-(--fg-3)">All the courses you're currently taking, in one place.</p>
    </div>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="flex flex-col items-center gap-3 py-24 text-center">
      <Loader2 :size="22" class="animate-spin text-(--fg-4)" />
      <p class="m-0 text-[13px] text-(--fg-3)">Loading your courses…</p>
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="flex flex-col items-center gap-3 py-24 text-center">
      <div class="w-12 h-12 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="22" /></div>
      <div class="text-sm font-semibold text-(--fg-1)">Something went wrong</div>
      <p class="m-0 text-[13px] text-(--fg-3) max-w-80">{{ errorMessage }}</p>
      <RaButton variant="secondary" @click="load">Try again</RaButton>
    </div>

    <!-- Empty -->
    <div v-else-if="!courses.length" class="flex flex-col items-center gap-3 py-24 text-center">
      <div class="w-12 h-12 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-4)"><Compass :size="22" /></div>
      <div class="text-sm font-semibold text-(--fg-1)">No enrolled courses yet</div>
      <p class="m-0 text-[13px] text-(--fg-3) max-w-80">Explore the catalog to find a course and get started.</p>
      <RaButton variant="secondary" @click="router.push('/app/explore')">Explore Courses</RaButton>
    </div>

    <div v-else class="grid gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <RaCourseCard
        v-for="c in courses"
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
</template>
