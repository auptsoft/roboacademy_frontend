<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { ArrowLeft, Plus, Users as UsersIcon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import UserComboBox from '@/components/UserComboBox.vue'
import SearchMultiSelect, { type SearchOption } from '@/components/SearchMultiSelect.vue'
import { ApiError } from '@/api/client'
import {
  getClass,
  addClassStaff,
  removeClassStaff,
  addClassStudent,
  removeClassStudent,
  assignClassCourse,
  unassignClassCourse,
  assignClassPath,
  unassignClassPath,
  getClassProgress,
  type ClassDetail,
  type ClassProgress,
  type ClassProgressCell,
} from '@/api/identity'
import { visibilityLabel } from '@/api/learning'
import { searchCourses, searchPaths, searchUsers, dueDateToIso, isoToDueDate } from '@/lib/pickers'

type Tab = 'roster' | 'courses' | 'paths' | 'progress'

const route = useRoute()
const router = useRouter()
const classId = computed(() => String(route.params.classId))

const detail = ref<ClassDetail | null>(null)
const loading = ref(true)
const notFound = ref(false)
const tab = ref<Tab>(
  (['roster', 'courses', 'paths', 'progress'] as const).find((t) => t === route.query.tab) ?? 'roster',
)

watch(tab, (value) => router.replace({ query: { ...route.query, tab: value } }))

async function refresh() {
  detail.value = await getClass(classId.value)
}

async function load() {
  loading.value = true
  notFound.value = false
  try {
    await refresh()
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load class.')
    }
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

function formatDue(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : 'No due date'
}

function isPast(iso: string | null): boolean {
  return iso !== null && new Date(iso).getTime() < Date.now()
}

// --- Staff ---
const staffUserId = ref<string | null>(null)
const staffRole = ref<'Teacher' | 'TeachingAssistant'>('Teacher')
const addingStaff = ref(false)

async function submitAddStaff() {
  if (!staffUserId.value) return
  addingStaff.value = true
  try {
    await addClassStaff(classId.value, staffUserId.value, staffRole.value)
    staffUserId.value = null
    await refresh()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to add staff member.')
  } finally {
    addingStaff.value = false
  }
}

async function removeStaffMember(userId: string) {
  try {
    await removeClassStaff(classId.value, userId)
    await refresh()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to remove staff member.')
  }
}

// --- Students ---
const newStudents = ref<SearchOption[]>([])
const addingStudents = ref(false)
const studentIds = computed(() => detail.value?.students.map((s) => s.userId) ?? [])

async function submitAddStudents() {
  if (newStudents.value.length === 0) return
  addingStudents.value = true
  let added = 0
  try {
    for (const student of newStudents.value) {
      await addClassStudent(classId.value, student.id)
      added++
    }
    const assigned = (detail.value?.courses.length ?? 0) + (detail.value?.paths.length ?? 0)
    toast.success(
      assigned > 0
        ? `${added} added and enrolled in this class's assigned courses and paths.`
        : `${added} added.`,
    )
    newStudents.value = []
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to add student.')
  } finally {
    addingStudents.value = false
    await refresh()
  }
}

// --- Remove / unassign confirmation (shared) ---
interface PendingRemoval {
  kind: 'student' | 'course' | 'path'
  id: string
  title: string
}

const pendingRemoval = ref<PendingRemoval | null>(null)
const alsoWithdraw = ref(false)
const removing = ref(false)

const hasAssignments = computed(() => (detail.value?.courses.length ?? 0) + (detail.value?.paths.length ?? 0) > 0)

function askRemove(removal: PendingRemoval) {
  pendingRemoval.value = removal
  alsoWithdraw.value = false
}

const removalCopy = computed(() => {
  const removal = pendingRemoval.value
  if (!removal) return { title: '', description: '', withdrawLabel: '' }
  if (removal.kind === 'student') {
    return {
      title: `Remove ${removal.title} from this class?`,
      description: 'They lose the enrollments this class gave them. Their progress is kept.',
      withdrawLabel: 'Also withdraw them from courses they only have through this class',
    }
  }
  return {
    title: `Unassign ${removal.title}?`,
    description: 'Students stay enrolled unless you choose to withdraw them. Their progress is kept.',
    withdrawLabel:
      'Also withdraw students who only have it through this class. Anyone who enrolled themselves, was enrolled by an admin, or has it through another class stays enrolled.',
  }
})

async function confirmRemoval() {
  const removal = pendingRemoval.value
  if (!removal) return
  removing.value = true
  try {
    if (removal.kind === 'student') {
      const result = await removeClassStudent(classId.value, removal.id, alsoWithdraw.value)
      toast.success(result.withdrawn > 0 ? `Student removed and withdrawn from ${result.withdrawn} courses.` : 'Student removed.')
    } else if (removal.kind === 'course') {
      const result = await unassignClassCourse(classId.value, removal.id, alsoWithdraw.value)
      toast.success(
        alsoWithdraw.value
          ? `Course unassigned. ${result.withdrawnCount} withdrawn, ${result.keptCount} kept (enrolled another way).`
          : 'Course unassigned. Students remain enrolled.',
      )
    } else {
      const result = await unassignClassPath(classId.value, removal.id, alsoWithdraw.value)
      toast.success(
        alsoWithdraw.value
          ? `Path unassigned. ${result.withdrawnCount} course enrollments withdrawn.`
          : 'Path unassigned. Students remain enrolled.',
      )
    }
    pendingRemoval.value = null
    await refresh()
    progress.value = null
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to remove.')
  } finally {
    removing.value = false
  }
}

// --- Assign courses / paths (shared dialog) ---
const assignKind = ref<'course' | 'path' | null>(null)
const assignItems = ref<SearchOption[]>([])
const assignDueDate = ref('')
const assigning = ref(false)
// Set when editing one existing assignment's due date rather than adding new ones.
const editingAssignment = ref<SearchOption | null>(null)

const assignedIds = computed(() =>
  assignKind.value === 'path'
    ? detail.value?.paths.map((p) => p.pathId) ?? []
    : detail.value?.courses.map((c) => c.courseId) ?? [],
)

function openAssign(kind: 'course' | 'path') {
  assignKind.value = kind
  assignItems.value = []
  assignDueDate.value = ''
  editingAssignment.value = null
}

function openEditDue(kind: 'course' | 'path', id: string, title: string, dueAt: string | null) {
  assignKind.value = kind
  editingAssignment.value = { id, label: title }
  assignItems.value = [{ id, label: title }]
  assignDueDate.value = isoToDueDate(dueAt)
}

async function submitAssign() {
  if (!assignKind.value || assignItems.value.length === 0) return
  assigning.value = true
  const dueAt = dueDateToIso(assignDueDate.value)
  let enrolled = 0
  try {
    for (const item of assignItems.value) {
      if (assignKind.value === 'course') {
        enrolled += (await assignClassCourse(classId.value, item.id, dueAt)).enrolledCount
      } else {
        enrolled += (await assignClassPath(classId.value, item.id, dueAt)).coursesEnrolled
      }
    }
    toast.success(
      editingAssignment.value
        ? 'Due date updated.'
        : `Assigned. ${enrolled} new ${assignKind.value === 'course' ? 'enrollments' : 'course enrollments'}.`,
    )
    assignKind.value = null
    await refresh()
    progress.value = null
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to assign.')
  } finally {
    assigning.value = false
  }
}

// --- Progress ---
const progress = ref<ClassProgress | null>(null)
const progressLoading = ref(false)

async function loadProgress() {
  progressLoading.value = true
  try {
    progress.value = await getClassProgress(classId.value)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load progress.')
  } finally {
    progressLoading.value = false
  }
}

watch(tab, (value) => {
  if (value === 'progress' && !progress.value) loadProgress()
}, { immediate: true })

function cellLabel(cell: ClassProgressCell): string {
  if (cell.status === 'NotEnrolled') return 'Not enrolled'
  if (cell.status === 'Withdrawn') return 'Withdrawn'
  return `${cell.percent}%`
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'roster', label: 'Roster' },
  { id: 'courses', label: 'Courses' },
  { id: 'paths', label: 'Learning Paths' },
  { id: 'progress', label: 'Progress' },
]

function tabCount(id: Tab): number | null {
  if (!detail.value) return null
  if (id === 'roster') return detail.value.students.length
  if (id === 'courses') return detail.value.courses.length
  if (id === 'paths') return detail.value.paths.length
  return null
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <button
      type="button"
      class="inline-flex w-fit cursor-pointer items-center gap-1.5 bg-transparent p-0 text-sm text-(--fg-3) hover:text-(--fg-1)"
      @click="router.push('/classes')"
    >
      <ArrowLeft :size="14" /> Classes
    </button>

    <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading class…</p>

    <RaCard v-else-if="notFound" class="p-10 text-center">
      <p class="m-0 text-sm text-(--fg-3)">Class not found.</p>
    </RaCard>

    <template v-else-if="detail">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">{{ detail.name }}</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">
          {{ detail.students.length }} students · {{ detail.staff.length }} staff ·
          {{ detail.courses.length }} courses · {{ detail.paths.length }} learning paths
        </p>
      </div>

      <div class="flex flex-wrap gap-2" role="tablist">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="tab === t.id"
          class="py-2 px-4 rounded-(--ra-pill) text-sm font-semibold cursor-pointer border transition-colors"
          :class="tab === t.id
            ? 'bg-(--brand-blue-soft) text-(--brand-blue) border-(--brand-blue-ring)'
            : 'bg-transparent text-(--fg-3) border-(--line-2) hover:bg-(--bg-3) hover:text-(--fg-1)'"
          @click="tab = t.id"
        >
          {{ t.label }}<span v-if="tabCount(t.id) !== null" class="ml-1.5 text-(--fg-4)">{{ tabCount(t.id) }}</span>
        </button>
      </div>

      <!-- Roster -->
      <template v-if="tab === 'roster'">
        <RaCard :padding="0" class="overflow-hidden">
          <div class="border-b border-(--line-1) py-5 px-6">
            <h3 class="m-0 flex items-center gap-1.5 text-lg font-bold text-(--fg-1)"><UsersIcon :size="16" /> Staff</h3>
          </div>
          <div class="flex flex-col gap-2 py-4 px-6">
            <p v-if="detail.staff.length === 0" class="m-0 text-[13px] text-(--fg-3)">No staff assigned.</p>
            <div v-for="s in detail.staff" :key="s.userId" class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm text-(--fg-1)">{{ s.fullName }}</span>
                <RaChip tone="instructor">{{ s.role }}</RaChip>
              </div>
              <Button variant="ghost" size="sm" @click="removeStaffMember(s.userId)">Remove</Button>
            </div>
            <form class="mt-2 flex items-center gap-2 max-sm:flex-col max-sm:items-stretch" @submit.prevent="submitAddStaff">
              <div class="flex-1"><UserComboBox v-model="staffUserId" /></div>
              <select
                v-model="staffRole"
                aria-label="Staff role"
                class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2 text-xs text-(--fg-2) outline-none"
              >
                <option value="Teacher">Teacher</option>
                <option value="TeachingAssistant">Teaching Assistant</option>
              </select>
              <Button size="sm" type="submit" :disabled="!staffUserId || addingStaff">Add</Button>
            </form>
          </div>
        </RaCard>

        <RaCard :padding="0" class="overflow-hidden">
          <div class="border-b border-(--line-1) py-5 px-6">
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Students</h3>
            <p v-if="hasAssignments" class="m-0 mt-1 text-xs text-(--fg-3)">
              New students are enrolled in this class's assigned courses and learning paths automatically.
            </p>
          </div>
          <div class="flex flex-col gap-2 py-4 px-6">
            <p v-if="detail.students.length === 0" class="m-0 text-[13px] text-(--fg-3)">No students yet.</p>
            <div v-for="s in detail.students" :key="s.userId" class="flex items-center justify-between gap-2">
              <span class="text-sm text-(--fg-1)">{{ s.fullName }}</span>
              <Button variant="ghost" size="sm" @click="askRemove({ kind: 'student', id: s.userId, title: s.fullName })">
                Remove
              </Button>
            </div>
            <form class="mt-2 flex flex-col gap-2" @submit.prevent="submitAddStudents">
              <SearchMultiSelect
                v-model="newStudents"
                :search="searchUsers"
                :exclude-ids="studentIds"
                placeholder="Search students by name or email…"
              />
              <div>
                <Button size="sm" type="submit" :disabled="newStudents.length === 0 || addingStudents">
                  {{ addingStudents ? 'Adding…' : `Add ${newStudents.length || ''} ${newStudents.length === 1 ? 'student' : 'students'}` }}
                </Button>
              </div>
            </form>
          </div>
        </RaCard>
      </template>

      <!-- Courses -->
      <RaCard v-else-if="tab === 'courses'" :padding="0" class="overflow-hidden">
        <div class="flex items-start justify-between gap-3 border-b border-(--line-1) py-5 px-6 max-sm:flex-col">
          <div>
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Assigned courses</h3>
            <p class="m-0 mt-1 text-xs text-(--fg-3)">
              Every student in the class is enrolled, including students who join later, and can't drop these courses.
              This works whatever the course's visibility.
            </p>
          </div>
          <Button @click="openAssign('course')"><Plus :size="14" /> Assign courses</Button>
        </div>
        <p v-if="detail.courses.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No courses assigned yet.</p>
        <div
          v-for="(c, i) in detail.courses"
          :key="c.courseId"
          :class="[
            'grid grid-cols-[2fr_130px_120px_140px_auto] items-center gap-3 py-3.5 px-6 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4',
            i < detail.courses.length - 1 && 'border-b border-(--line-1)',
          ]"
        >
          <button
            type="button"
            class="cursor-pointer bg-transparent p-0 text-left text-sm font-semibold text-(--fg-1) underline-offset-2 hover:underline"
            @click="router.push(`/courses/${c.courseId}`)"
          >
            {{ c.title }}
          </button>
          <div>
            <RaChip v-if="c.state === 'Published'" tone="info">Published</RaChip>
            <RaChip v-else tone="neutral" title="Students are enrolled when the course is published">Pending publish</RaChip>
          </div>
          <div class="text-xs text-(--fg-3)">{{ visibilityLabel(c.visibility) }}</div>
          <div class="text-xs" :class="isPast(c.dueAt) ? 'text-(--danger)' : 'text-(--fg-3)'">{{ formatDue(c.dueAt) }}</div>
          <div class="flex justify-end gap-1 max-md:w-full max-md:justify-start">
            <Button variant="ghost" size="sm" @click="openEditDue('course', c.courseId, c.title, c.dueAt)">Due date</Button>
            <Button variant="ghost" size="sm" @click="askRemove({ kind: 'course', id: c.courseId, title: c.title })">
              Unassign
            </Button>
          </div>
        </div>
      </RaCard>

      <!-- Paths -->
      <RaCard v-else-if="tab === 'paths'" :padding="0" class="overflow-hidden">
        <div class="flex items-start justify-between gap-3 border-b border-(--line-1) py-5 px-6 max-sm:flex-col">
          <div>
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Assigned learning paths</h3>
            <p class="m-0 mt-1 text-xs text-(--fg-3)">
              Students start the path and are enrolled in every course on it.
            </p>
          </div>
          <Button @click="openAssign('path')"><Plus :size="14" /> Assign paths</Button>
        </div>
        <p v-if="detail.paths.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No learning paths assigned yet.</p>
        <div
          v-for="(p, i) in detail.paths"
          :key="p.pathId"
          :class="[
            'grid grid-cols-[2fr_130px_120px_140px_auto] items-center gap-3 py-3.5 px-6 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4',
            i < detail.paths.length - 1 && 'border-b border-(--line-1)',
          ]"
        >
          <button
            type="button"
            class="cursor-pointer bg-transparent p-0 text-left text-sm font-semibold text-(--fg-1) underline-offset-2 hover:underline"
            @click="router.push(`/paths/${p.pathId}`)"
          >
            {{ p.title }}
          </button>
          <div>
            <RaChip v-if="p.state === 'Published'" tone="info">Published</RaChip>
            <RaChip v-else tone="neutral" title="Students start the path when it is published">Pending publish</RaChip>
          </div>
          <div class="text-xs text-(--fg-3)">{{ p.courseCount }} courses</div>
          <div class="text-xs" :class="isPast(p.dueAt) ? 'text-(--danger)' : 'text-(--fg-3)'">{{ formatDue(p.dueAt) }}</div>
          <div class="flex justify-end gap-1 max-md:w-full max-md:justify-start">
            <Button variant="ghost" size="sm" @click="openEditDue('path', p.pathId, p.title, p.dueAt)">Due date</Button>
            <Button variant="ghost" size="sm" @click="askRemove({ kind: 'path', id: p.pathId, title: p.title })">
              Unassign
            </Button>
          </div>
        </div>
      </RaCard>

      <!-- Progress -->
      <RaCard v-else :padding="0" class="overflow-hidden">
        <div class="flex items-start justify-between gap-3 border-b border-(--line-1) py-5 px-6">
          <div>
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Progress</h3>
            <p class="m-0 mt-1 text-xs text-(--fg-3)">
              Required lessons completed in each assigned course. Overdue items are highlighted.
            </p>
          </div>
          <Button variant="outline" size="sm" :disabled="progressLoading" @click="loadProgress">Refresh</Button>
        </div>
        <p v-if="progressLoading && !progress" class="p-6 text-center text-[13px] text-(--fg-3)">Loading progress…</p>
        <p
          v-else-if="progress && (progress.courses.length === 0 || progress.students.length === 0)"
          class="p-6 text-center text-[13px] text-(--fg-3)"
        >
          {{ progress.courses.length === 0 ? 'Assign courses or learning paths to track progress.' : 'Add students to track progress.' }}
        </p>
        <div v-else-if="progress" class="overflow-x-auto">
          <table class="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr class="border-b border-(--line-1) text-xs text-(--fg-3)">
                <th scope="col" class="sticky left-0 bg-(--bg-2) py-3 px-6 font-medium">Student</th>
                <th v-for="c in progress.courses" :key="c.courseId" scope="col" class="min-w-36 py-3 px-3 font-medium">
                  <div class="text-(--fg-2)">{{ c.title }}</div>
                  <div v-if="c.dueAt" class="font-normal text-(--fg-4)">Due {{ new Date(c.dueAt).toLocaleDateString() }}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in progress.students" :key="s.userId" class="border-b border-(--line-1) last:border-b-0">
                <th scope="row" class="sticky left-0 bg-(--bg-2) py-3 px-6 font-semibold text-(--fg-1)">
                  {{ s.fullName }}
                  <div class="text-xs font-normal text-(--fg-4)">{{ s.email }}</div>
                </th>
                <td v-for="cell in s.courses" :key="cell.courseId" class="py-3 px-3">
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 w-16 overflow-hidden rounded-full bg-(--bg-3)" aria-hidden="true">
                      <div
                        class="h-full rounded-full"
                        :class="cell.overdue ? 'bg-(--danger)' : cell.status === 'Completed' ? 'bg-(--brand-blue)' : 'bg-(--fg-3)'"
                        :style="{ width: `${cell.percent}%` }"
                      />
                    </div>
                    <span :class="cell.overdue ? 'font-semibold text-(--danger)' : 'text-(--fg-2)'">
                      {{ cellLabel(cell) }}
                    </span>
                  </div>
                  <div v-if="cell.overdue" class="mt-0.5 text-[11px] text-(--danger)">Overdue</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </RaCard>
    </template>

    <!-- Assign dialog -->
    <Dialog :open="assignKind !== null" @update:open="(open) => { if (!open) assignKind = null }">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ editingAssignment ? `Due date for ${editingAssignment.label}` : assignKind === 'path' ? 'Assign learning paths' : 'Assign courses' }}
          </DialogTitle>
          <DialogDescription>
            {{
              editingAssignment
                ? 'Updates the due date for every student in this class.'
                : 'Every current and future student in this class is enrolled. Draft items take effect when published.'
            }}
          </DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitAssign">
          <div v-if="!editingAssignment" class="flex flex-col gap-1.5">
            <Label>{{ assignKind === 'path' ? 'Learning paths' : 'Courses' }}</Label>
            <SearchMultiSelect
              v-model="assignItems"
              :search="assignKind === 'path' ? searchPaths : searchCourses"
              :exclude-ids="assignedIds"
              :placeholder="assignKind === 'path' ? 'Search learning paths…' : 'Search courses…'"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="assign-due">Due date (optional)</Label>
            <Input id="assign-due" v-model="assignDueDate" type="date" class="h-9 w-48" />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="assignKind = null">Cancel</Button>
            <Button type="submit" :disabled="assigning || assignItems.length === 0">
              {{ assigning ? 'Saving…' : editingAssignment ? 'Save' : 'Assign' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Remove / unassign confirmation -->
    <Dialog :open="pendingRemoval !== null" @update:open="(open) => { if (!open) pendingRemoval = null }">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ removalCopy.title }}</DialogTitle>
          <DialogDescription>{{ removalCopy.description }}</DialogDescription>
        </DialogHeader>
        <label
          v-if="pendingRemoval && (pendingRemoval.kind !== 'student' || hasAssignments)"
          class="flex cursor-pointer items-start gap-2.5 text-[13px] text-(--fg-2)"
        >
          <input v-model="alsoWithdraw" type="checkbox" class="mt-0.5 size-4 shrink-0 accent-(--brand-blue)">
          <span>{{ removalCopy.withdrawLabel }}</span>
        </label>
        <DialogFooter>
          <Button variant="outline" type="button" @click="pendingRemoval = null">Cancel</Button>
          <Button variant="destructive" :disabled="removing" @click="confirmRemoval">
            {{ removing ? 'Removing…' : pendingRemoval?.kind === 'student' ? 'Remove' : 'Unassign' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
