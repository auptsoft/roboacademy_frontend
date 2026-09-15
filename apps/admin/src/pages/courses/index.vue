<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { MoreVertical, Plus, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import Pagination from '@/components/Pagination.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import CopyToTenantsDialog from '@/components/CopyToTenantsDialog.vue'
import ImportCourseFromTenantDialog from '@/components/ImportCourseFromTenantDialog.vue'
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import { useCanCopyCrossTenant } from '@/composables/useCanCopyCrossTenant'
import { listCourseCatalog, createCourse, copyCourseToTenants, type CourseCatalogItem, type CourseState } from '@/api/learning'

const router = useRouter()
const canCopyCrossTenant = useCanCopyCrossTenant()

const filters = reactive<{ state: CourseState | ''; search: string }>({ state: '', search: '' })

const {
  items: courses,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList(
  (page, pageSize) => listCourseCatalog(
    { state: filters.state || undefined, search: filters.search || undefined },
    page,
    pageSize,
  ),
  { initialPageSize: 20, errorMessage: 'Failed to load courses.' },
)

const rowClass =
  'grid grid-cols-[2fr_2fr_100px_100px_60px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(() => {
  load()
})

let searchDebounce: ReturnType<typeof setTimeout> | undefined
watch(() => filters.search, () => {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => { page.value = 1; load() }, 300)
})
watch(() => filters.state, () => { page.value = 1; load() })

// --- Create course ---
const createOpen = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({ title: '', description: '' })
const createErrors = ref<Record<string, string[]>>({})

function openCreate() {
  createForm.title = ''
  createForm.description = ''
  createErrors.value = {}
  createOpen.value = true
}

async function submitCreate() {
  createErrors.value = {}
  createSubmitting.value = true
  try {
    const created = await createCourse({
      title: createForm.title,
      description: createForm.description || undefined,
    })
    toast.success('Course created.')
    createOpen.value = false
    router.push(`/courses/${created.id}`)
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      createErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create course.')
    }
  } finally {
    createSubmitting.value = false
  }
}

function openCourse(courseId: string) {
  router.push(`/courses/${courseId}`)
}

// --- Copy to tenants ---
const copyDialogOpen = ref(false)
const copyDialogCourseId = ref<string | null>(null)

function openCopyDialog(course: CourseCatalogItem) {
  copyDialogCourseId.value = course.id
  copyDialogOpen.value = true
}

async function copyToTenants(targetTenantIds: string[]) {
  const result = await copyCourseToTenants(copyDialogCourseId.value!, { targetTenantIds })
  return result.results
}

// --- Import from tenant ---
const importDialogOpen = ref(false)

function onImported(courseId: string) {
  router.push(`/courses/${courseId}`)
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Courses</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Author courses, modules, and lessons.</p>
      </div>
      <div class="flex gap-2">
        <Button v-if="canCopyCrossTenant" variant="outline" @click="importDialogOpen = true">
          <Upload :size="14" /> Import from tenant…
        </Button>
        <Button @click="openCreate">
          <Plus :size="14" /> Add Course
        </Button>
      </div>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6">
        <select
          v-model="filters.state"
          class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
        >
          <option value="">All states</option>
          <option value="Draft">Draft</option>
          <option value="Published">Published</option>
        </select>
        <Input v-model="filters.search" placeholder="Search by title or description…" class="h-9 flex-1 min-w-48" />
      </div>

      <div class="grid grid-cols-[2fr_2fr_100px_100px_60px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Title</span>
        <span>Description</span>
        <span>State</span>
        <span>Lessons</span>
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading courses…</p>
      <p v-else-if="courses.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
        No courses match these filters.
      </p>

      <div
        v-for="(course, i) in courses"
        :key="course.id"
        :class="[rowClass, i < courses.length - 1 && 'border-b border-(--line-1)']"
      >
        <button
          type="button"
          class="cursor-pointer bg-transparent p-0 text-left text-sm font-semibold text-(--fg-1) underline-offset-2 hover:underline"
          @click="openCourse(course.id)"
        >
          {{ course.title }}
        </button>
        <div class="text-sm text-(--fg-3)">{{ course.description || '—' }}</div>
        <div><RaChip :tone="course.state === 'Published' ? 'info' : 'neutral'">{{ course.state }}</RaChip></div>
        <div class="text-sm text-(--fg-2)">{{ course.lessonCount }}</div>
        <div class="flex justify-end max-md:w-full max-md:justify-start">
          <DropdownMenu v-if="canCopyCrossTenant">
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem @select="openCopyDialog(course)">Copy to tenants…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Pagination
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-count="meta?.totalCount ?? 0"
        @update:page="goToPage"
        @update:page-size="setPageSize"
      />
    </RaCard>

    <!-- Create course dialog -->
    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Course</DialogTitle>
          <DialogDescription>Create a draft course. Modules and lessons are added on its detail page.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitCreate">
          <div class="flex flex-col gap-1.5">
            <Label for="course-title">Title</Label>
            <Input id="course-title" v-model="createForm.title" required />
            <p v-for="msg in createErrors.Title" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="course-description">Description (optional)</Label>
            <Input id="course-description" v-model="createForm.description" />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="createOpen = false">Cancel</Button>
            <Button type="submit" :disabled="createSubmitting">
              {{ createSubmitting ? 'Creating…' : 'Add Course' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <CopyToTenantsDialog
      v-model:open="copyDialogOpen"
      title="Copy course to tenants"
      description="Copies the course, its modules, lessons, and assessments into each selected tenant as a new draft."
      :copy-fn="copyToTenants"
    />

    <ImportCourseFromTenantDialog v-model:open="importDialogOpen" @imported="onImported" />
  </div>
</template>
