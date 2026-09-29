<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import SearchMultiSelect, { type SearchOption } from '@/components/SearchMultiSelect.vue'
import { searchUsers, searchClasses, dueDateToIso } from '@/lib/pickers'
import { ApiError } from '@/api/client'
import {
  listCourseCatalog,
  listCourseEnrolments,
  getCourse,
  adminBulkEnrol,
  adminBulkWithdraw,
  adminWithdrawEnrolment,
  listPaths,
  listPathEnrolments,
  type CourseCatalogItem,
  type CourseEnrolmentItem,
  type EnrolmentSource,
  type PathListItem,
  type PathEnrolmentItem,
} from '@/api/learning'

const route = useRoute()
const mode = ref<'courses' | 'paths'>('courses')

// Course picker
const courseQuery = ref('')
const courseResults = ref<CourseCatalogItem[]>([])
const selectedCourse = ref<Pick<CourseCatalogItem, 'id' | 'title'> | null>(null)
let courseSearchDebounce: ReturnType<typeof setTimeout> | undefined

watch(courseQuery, (value) => {
  // Picking a result sets courseQuery to the picked course's title — skip re-searching that.
  if (selectedCourse.value && value === selectedCourse.value.title) return
  clearTimeout(courseSearchDebounce)
  if (value.trim().length < 2) {
    courseResults.value = []
    return
  }
  courseSearchDebounce = setTimeout(async () => {
    const result = await listCourseCatalog({ search: value }, 1, 8)
    courseResults.value = result.items
  }, 300)
})

function pickCourse(course: Pick<CourseCatalogItem, 'id' | 'title'>) {
  selectedCourse.value = course
  selectedUserIds.value = new Set()
  courseQuery.value = course.title
  courseResults.value = []
  loadEnrolments()
}

function clearCourse() {
  selectedCourse.value = null
  courseQuery.value = ''
  enrolments.value = []
}

// Enrolments for the selected course
const enrolments = ref<CourseEnrolmentItem[]>([])
const enrolmentsLoading = ref(false)

async function loadEnrolments() {
  if (!selectedCourse.value) return
  enrolmentsLoading.value = true
  try {
    const result = await listCourseEnrolments(selectedCourse.value.id)
    enrolments.value = result.items
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load enrolments.')
  } finally {
    enrolmentsLoading.value = false
  }
}

// Path picker
const pathQuery = ref('')
const pathResults = ref<PathListItem[]>([])
const selectedPath = ref<PathListItem | null>(null)
let pathSearchDebounce: ReturnType<typeof setTimeout> | undefined

watch(pathQuery, (value) => {
  // Picking a result sets pathQuery to the picked path's title — skip re-searching that.
  if (selectedPath.value && value === selectedPath.value.title) return
  clearTimeout(pathSearchDebounce)
  if (value.trim().length < 2) {
    pathResults.value = []
    return
  }
  pathSearchDebounce = setTimeout(async () => {
    const result = await listPaths({ search: value })
    pathResults.value = result.items
  }, 300)
})

function pickPath(path: PathListItem) {
  selectedPath.value = path
  pathQuery.value = path.title
  pathResults.value = []
  loadPathEnrolments()
}

function clearPath() {
  selectedPath.value = null
  pathQuery.value = ''
  pathEnrolments.value = []
}

// Enrolments for the selected path — admin view only, no force-enrol/withdraw yet.
const pathEnrolments = ref<PathEnrolmentItem[]>([])
const pathEnrolmentsLoading = ref(false)

async function loadPathEnrolments() {
  if (!selectedPath.value) return
  pathEnrolmentsLoading.value = true
  try {
    const result = await listPathEnrolments(selectedPath.value.id)
    pathEnrolments.value = result.items
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load enrolments.')
  } finally {
    pathEnrolmentsLoading.value = false
  }
}

async function withdraw(item: CourseEnrolmentItem) {
  if (!selectedCourse.value) return
  if (!window.confirm(`Withdraw ${item.fullName} from ${selectedCourse.value.title}?`)) return
  try {
    await adminWithdrawEnrolment(selectedCourse.value.id, item.userId)
    toast.success('Enrolment withdrawn.')
    await loadEnrolments()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to withdraw enrolment.')
  }
}

// Enrol users and/or whole classes (bulk)
const enrolUsers = ref<SearchOption[]>([])
const enrolClasses = ref<SearchOption[]>([])
const enrolDueDate = ref('')
const enrolling = ref(false)

async function submitEnrol() {
  if (!selectedCourse.value || (enrolUsers.value.length === 0 && enrolClasses.value.length === 0)) return
  enrolling.value = true
  try {
    const result = await adminBulkEnrol(selectedCourse.value.id, {
      userIds: enrolUsers.value.map((u) => u.id),
      classIds: enrolClasses.value.map((c) => c.id),
      dueAt: dueDateToIso(enrolDueDate.value),
    })
    toast.success(
      result.alreadyEnrolled > 0
        ? `${result.enrolled} enrolled. ${result.alreadyEnrolled} already enrolled (now marked as assigned).`
        : `${result.enrolled} enrolled.`,
    )
    enrolUsers.value = []
    enrolClasses.value = []
    enrolDueDate.value = ''
    await loadEnrolments()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to enrol.')
  } finally {
    enrolling.value = false
  }
}

// Bulk withdraw
const selectedUserIds = ref<Set<string>>(new Set())
const activeEnrolments = computed(() => enrolments.value.filter((e) => e.status === 'Active'))
const allActiveSelected = computed(
  () => activeEnrolments.value.length > 0 && activeEnrolments.value.every((e) => selectedUserIds.value.has(e.userId)),
)

function toggleSelected(userId: string) {
  const next = new Set(selectedUserIds.value)
  if (next.has(userId)) next.delete(userId)
  else next.add(userId)
  selectedUserIds.value = next
}

function toggleAll() {
  selectedUserIds.value = allActiveSelected.value
    ? new Set()
    : new Set(activeEnrolments.value.map((e) => e.userId))
}

const bulkWithdrawing = ref(false)

async function withdrawSelected() {
  if (!selectedCourse.value || selectedUserIds.value.size === 0) return
  const count = selectedUserIds.value.size
  if (!window.confirm(`Withdraw ${count} ${count === 1 ? 'user' : 'users'} from ${selectedCourse.value.title}?`)) return
  bulkWithdrawing.value = true
  try {
    const result = await adminBulkWithdraw(selectedCourse.value.id, [...selectedUserIds.value])
    toast.success(`${result.withdrawn} withdrawn.`)
    selectedUserIds.value = new Set()
    await loadEnrolments()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to withdraw.')
  } finally {
    bulkWithdrawing.value = false
  }
}

const SOURCE_LABELS: Record<EnrolmentSource, string> = {
  Self: 'Self-enrolled',
  Path: 'Via path',
  Admin: 'Admin',
  Class: 'Class',
}

// Deep link from a course page: /enrollments?courseId=...
onMounted(async () => {
  const courseId = route.query.courseId
  if (typeof courseId !== 'string') return
  try {
    const course = await getCourse(courseId)
    pickCourse({ id: course.id, title: course.title })
  } catch {
    // Unknown/inaccessible course - leave the picker empty.
  }
})

function statusTone(status: string): 'student' | 'info' | 'neutral' {
  if (status === 'Active') return 'student'
  if (status === 'Completed') return 'info'
  return 'neutral'
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Enrollments</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        {{ mode === 'courses' ? 'Enrol students or whole classes in a course, or withdraw them.' : 'See who has started a learning path.' }}
      </p>
    </div>

    <div class="flex gap-2">
      <button
        v-for="tab in (['courses', 'paths'] as const)" :key="tab"
        type="button"
        class="py-2 px-4 rounded-(--ra-pill) text-sm font-semibold cursor-pointer border transition-colors"
        :class="mode === tab
          ? 'bg-(--brand-blue-soft) text-(--brand-blue) border-(--brand-blue-ring)'
          : 'bg-transparent text-(--fg-3) border-(--line-2) hover:bg-(--bg-3) hover:text-(--fg-1)'"
        @click="mode = tab"
      >{{ tab === 'courses' ? 'Courses' : 'Learning Paths' }}</button>
    </div>

    <template v-if="mode === 'courses'">
      <RaCard :padding="24">
        <div class="flex flex-col gap-1.5 max-w-md">
          <label class="text-xs text-(--fg-3)">Course</label>
          <div class="relative">
            <Input v-model="courseQuery" placeholder="Search courses by title…" class="h-9" />
            <button
              v-if="selectedCourse"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-(--fg-4) hover:text-(--fg-2)"
              aria-label="Clear selected course"
              @click="clearCourse"
            >
              <X :size="14" />
            </button>
            <div
              v-if="courseResults.length > 0"
              class="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) shadow-md"
            >
              <button
                v-for="c in courseResults" :key="c.id"
                type="button"
                class="block w-full px-2.5 py-1.5 text-left text-[13px] text-(--fg-2) hover:bg-(--bg-3)"
                @click="pickCourse(c)"
              >
                {{ c.title }} <span class="text-(--fg-4)">{{ c.state }} · {{ c.visibility }}</span>
              </button>
            </div>
          </div>
        </div>
      </RaCard>

      <template v-if="selectedCourse">
        <RaCard :padding="0" class="overflow-hidden">
          <div class="flex items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 max-sm:flex-col max-sm:items-start">
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Enrolled Users — {{ selectedCourse.title }}</h3>
            <Button
              v-if="selectedUserIds.size > 0"
              variant="outline"
              size="sm"
              :disabled="bulkWithdrawing"
              @click="withdrawSelected"
            >
              {{ bulkWithdrawing ? 'Withdrawing…' : `Withdraw selected (${selectedUserIds.size})` }}
            </Button>
          </div>

          <div
            v-if="enrolments.length > 0"
            class="grid grid-cols-[28px_2fr_2fr_1.5fr_110px_110px_100px] items-center border-b border-(--line-1) py-3 px-6 text-xs text-(--fg-3) max-md:hidden"
          >
            <input
              type="checkbox"
              class="size-4 accent-(--brand-blue)"
              aria-label="Select all active enrolments"
              :checked="allActiveSelected"
              :disabled="activeEnrolments.length === 0"
              @change="toggleAll"
            >
            <span>Name</span>
            <span>Email</span>
            <span>Source</span>
            <span>Status</span>
            <span>Due</span>
            <span />
          </div>

          <p v-if="enrolmentsLoading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading enrolments…</p>
          <p v-else-if="enrolments.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
            No one is enrolled in this course yet.
          </p>

          <div
            v-for="(e, i) in enrolments" :key="e.enrolmentId"
            :class="[
              'grid grid-cols-[28px_2fr_2fr_1.5fr_110px_110px_100px] items-center py-3.5 px-6 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4',
              i < enrolments.length - 1 && 'border-b border-(--line-1)',
            ]"
          >
            <input
              type="checkbox"
              class="size-4 accent-(--brand-blue)"
              :aria-label="`Select ${e.fullName}`"
              :checked="selectedUserIds.has(e.userId)"
              :disabled="e.status !== 'Active'"
              @change="toggleSelected(e.userId)"
            >
            <div class="text-sm font-semibold text-(--fg-1)">{{ e.fullName }}</div>
            <div class="text-sm text-(--fg-3)">{{ e.email }}</div>
            <div class="flex flex-wrap gap-1">
              <RaChip v-for="source in e.sources" :key="source" tone="neutral">{{ SOURCE_LABELS[source] ?? source }}</RaChip>
            </div>
            <RaChip :tone="statusTone(e.status)">{{ e.status }}</RaChip>
            <div class="text-xs text-(--fg-4)">{{ e.dueAt ? new Date(e.dueAt).toLocaleDateString() : '—' }}</div>
            <div class="flex justify-end max-md:w-full max-md:justify-start">
              <Button v-if="e.status === 'Active'" variant="ghost" size="sm" @click="withdraw(e)">Withdraw</Button>
            </div>
          </div>
        </RaCard>

        <RaCard :padding="24">
          <h4 class="m-0 text-sm font-bold text-(--fg-1)">Enrol students</h4>
          <p class="m-0 mt-1 mb-4 text-xs text-(--fg-3)">
            Works for any visibility, including hidden courses. Students can't drop courses you enrol them in.
            Picking a class enrols its current students once. To also enrol students who join the class later,
            assign the course to the class from the Classes page.
          </p>
          <form class="flex max-w-xl flex-col gap-4" @submit.prevent="submitEnrol">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-(--fg-3)">Students</label>
              <SearchMultiSelect v-model="enrolUsers" :search="searchUsers" placeholder="Search by name or email…" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-(--fg-3)">Whole classes (optional)</label>
              <SearchMultiSelect v-model="enrolClasses" :search="searchClasses" placeholder="Search classes…" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="enrol-due" class="text-xs text-(--fg-3)">Due date (optional)</label>
              <Input id="enrol-due" v-model="enrolDueDate" type="date" class="h-9 w-48" />
            </div>
            <div>
              <Button type="submit" :disabled="enrolling || (enrolUsers.length === 0 && enrolClasses.length === 0)">
                {{ enrolling ? 'Enrolling…' : 'Enrol' }}
              </Button>
            </div>
          </form>
        </RaCard>

      </template>
    </template>

    <template v-else>
      <RaCard :padding="24">
        <div class="flex flex-col gap-1.5 max-w-md">
          <label class="text-xs text-(--fg-3)">Learning Path</label>
          <div class="relative">
            <Input v-model="pathQuery" placeholder="Search learning paths by title…" class="h-9" />
            <button
              v-if="selectedPath"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-(--fg-4) hover:text-(--fg-2)"
              aria-label="Clear selected path"
              @click="clearPath"
            >
              <X :size="14" />
            </button>
            <div
              v-if="pathResults.length > 0"
              class="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) shadow-md"
            >
              <button
                v-for="p in pathResults" :key="p.id"
                type="button"
                class="block w-full px-2.5 py-1.5 text-left text-[13px] text-(--fg-2) hover:bg-(--bg-3)"
                @click="pickPath(p)"
              >
                {{ p.title }} <span class="text-(--fg-4)">{{ p.state }}</span>
              </button>
            </div>
          </div>
        </div>
      </RaCard>

      <RaCard v-if="selectedPath" :padding="0" class="overflow-hidden">
        <div class="border-b border-(--line-1) py-5 px-6">
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">Enrolled Users — {{ selectedPath.title }}</h3>
        </div>

        <p v-if="pathEnrolmentsLoading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading enrolments…</p>
        <p v-else-if="pathEnrolments.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
          No one has started this learning path yet.
        </p>

        <div
          v-for="(e, i) in pathEnrolments" :key="e.enrolmentId"
          :class="[
            'grid grid-cols-[2fr_2fr_120px_140px] items-center py-3.5 px-6 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4',
            i < pathEnrolments.length - 1 && 'border-b border-(--line-1)',
          ]"
        >
          <div class="text-sm font-semibold text-(--fg-1)">{{ e.fullName }}</div>
          <div class="text-sm text-(--fg-3)">{{ e.email }}</div>
          <RaChip :tone="statusTone(e.status)">{{ e.status }}</RaChip>
          <div class="text-xs text-(--fg-4)">{{ new Date(e.enrolledAt).toLocaleDateString() }}</div>
        </div>
      </RaCard>
    </template>
  </div>
</template>
