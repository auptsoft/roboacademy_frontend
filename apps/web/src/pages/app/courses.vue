<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RaButton } from '@roboacademy/ui'
import { Loader2, AlertTriangle, Compass, Info } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { getMyEnrolledCourses, type EnrolledCourseSummary } from '@/api/learning'
import FolderTabs from '@/components/layout/FolderTabs.vue'
import CourseTile from '@/components/courses/CourseTile.vue'
import { enrolledCourseStatus, enrolledTileProps } from '@/components/courses/course-tile'

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

function openCourse(courseId: string) {
  router.push(`/app/courses/${courseId}`)
}

onMounted(load)

type Tab = 'active' | 'completed'
const tab = ref<Tab>('active')

const activeCourses = computed(() => courses.value.filter(c => !c.courseCompleted))
const completedCourses = computed(() => courses.value.filter(c => c.courseCompleted))
const visibleCourses = computed(() => tab.value === 'active' ? activeCourses.value : completedCourses.value)

const tabs = computed(() => [
  { id: 'active' as const, label: `In Progress (${activeCourses.value.length})` },
  { id: 'completed' as const, label: `Completed (${completedCourses.value.length})` },
])

// "Go to Class" resumes the most recently started in-progress course.
const resumeCourse = computed(() =>
  activeCourses.value.find(c => c.completedLessons > 0) ?? activeCourses.value[0] ?? null,
)

const showStatusHelp = ref(false)
const statusHelp = [
  { label: 'New', text: "You're enrolled but haven't completed a lesson yet." },
  { label: 'In Progress', text: "You've started — keep going to finish every lesson and assessment." },
  { label: 'Completed', text: 'All lessons and assessments are done.' },
]
</script>

<template>
  <div class="flex flex-col gap-7 px-12 pt-10 pb-12 max-w-[1440px] mx-auto max-lg:px-8 max-sm:gap-5 max-sm:px-4 max-sm:pt-5 max-sm:pb-8">
    <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">My Courses</h1>

    <div>
      <!-- Folder-style tabs sitting on top of the panel -->
      <FolderTabs v-model="tab" :tabs="tabs" />

      <section class="bg-(--surface) rounded-(--ra-xl) rounded-tl-none shadow-(--surface-shadow) px-9 pt-8 pb-10 max-sm:px-4 max-sm:pt-5">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-3 flex-wrap">
            <h2 class="m-0 text-[22px] font-medium text-(--heading)">Enrolled Courses</h2>
            <span v-if="status === 'idle'" class="px-3 py-1 rounded-(--ra-pill) bg-(--success-soft) text-(--success) text-[13px] font-medium">
              {{ courses.length }} Enrolled
            </span>
          </div>
          <div class="relative">
            <button
              class="inline-flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer text-[15px] text-(--heading) hover:underline"
              :aria-expanded="showStatusHelp"
              @click="showStatusHelp = !showStatusHelp"
            >
              <Info :size="18" class="text-(--warning)" />
              See what each course status means
            </button>
            <div
              v-if="showStatusHelp"
              class="absolute right-0 top-full mt-2 z-20 w-80 max-w-[calc(100vw-32px)] bg-(--surface) border border-(--line-2) rounded-(--ra-lg) shadow-(--elev-2) p-4 flex flex-col gap-3"
            >
              <div v-for="h in statusHelp" :key="h.label">
                <div class="text-[13px] font-semibold text-(--heading)">{{ h.label }}</div>
                <div class="text-[13px] text-(--fg-3)">{{ h.text }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4 mt-10 pb-5 border-b border-(--line-2)">
          <h3 class="m-0 text-xl font-medium text-(--heading)">{{ tab === 'active' ? 'Current Courses' : 'Completed Courses' }}</h3>
          <RaButton v-if="resumeCourse && tab === 'active'" @click="openCourse(resumeCourse.courseId)">Go to Class</RaButton>
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
        <div v-else-if="!visibleCourses.length" class="flex flex-col items-center gap-3 py-24 text-center">
          <div class="w-12 h-12 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-4)"><Compass :size="22" /></div>
          <div class="text-sm font-semibold text-(--fg-1)">
            {{ !courses.length ? 'No enrolled courses yet' : tab === 'active' ? 'No courses in progress' : 'No completed courses yet' }}
          </div>
          <p class="m-0 text-[13px] text-(--fg-3) max-w-80">Explore the catalog to find a course and get started.</p>
          <RaButton variant="secondary" @click="router.push('/app/explore')">Explore Courses</RaButton>
        </div>

        <div v-else class="grid gap-x-6 gap-y-9 mt-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <CourseTile
            v-for="c in visibleCourses"
            :key="c.enrolmentId"
            v-bind="enrolledTileProps(c)"
            :status="enrolledCourseStatus(c)"
            @open="openCourse(c.courseId)"
          />
        </div>
      </section>
    </div>
  </div>
</template>
