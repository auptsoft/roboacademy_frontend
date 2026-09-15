<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { RaCard, RaChip } from '@roboacademy/ui'
import { MoreVertical, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Pagination from '@/components/Pagination.vue'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import CopyAssessmentToTenantDialog from '@/components/CopyAssessmentToTenantDialog.vue'
import ImportAssessmentFromTenantDialog from '@/components/ImportAssessmentFromTenantDialog.vue'
import { usePagedList } from '@/composables/usePagedList'
import { useCanCopyCrossTenant } from '@/composables/useCanCopyCrossTenant'
import { listCourseCatalog, getCourse, type CourseCatalogItem, type CourseModuleItem } from '@/api/learning'
import { listAssessments, ASSESSMENT_TYPES, type AssessmentType } from '@/api/assessment'

const router = useRouter()
const canCopyCrossTenant = useCanCopyCrossTenant()

const courseFilter = ref('')
const moduleFilter = ref('')
const typeFilter = ref<AssessmentType | ''>('')
const courses = ref<CourseCatalogItem[]>([])
const modules = ref<CourseModuleItem[]>([])

const {
  items: assessments,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList(
  (page, pageSize) => listAssessments(
    {
      courseId: courseFilter.value || undefined,
      moduleId: moduleFilter.value || undefined,
      type: typeFilter.value || undefined,
    },
    page,
    pageSize,
  ),
  { initialPageSize: 20, errorMessage: 'Failed to load assessments.' },
)

async function loadCourses() {
  const result = await listCourseCatalog({}, 1, 100)
  courses.value = result.items
}

async function loadModulesForCourse() {
  modules.value = []
  moduleFilter.value = ''
  if (!courseFilter.value) return
  const course = await getCourse(courseFilter.value)
  modules.value = course.modules
}

function courseTitle(courseId: string): string {
  return courses.value.find((c) => c.id === courseId)?.title ?? '—'
}

watch(courseFilter, async () => {
  await loadModulesForCourse()
  page.value = 1
  load()
})
watch([moduleFilter, typeFilter], () => { page.value = 1; load() })

const rowClass =
  'grid grid-cols-[2fr_1.5fr_100px_90px_90px_90px_60px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(() => {
  load()
  loadCourses()
})

function openAssessment(assessmentId: string) {
  router.push(`/assessment/assessments/${assessmentId}`)
}

// --- Copy to tenant ---
const copyDialogOpen = ref(false)
const copyDialogAssessmentId = ref('')

function openCopyDialog(assessmentId: string) {
  copyDialogAssessmentId.value = assessmentId
  copyDialogOpen.value = true
}

// --- Import from tenant ---
const importDialogOpen = ref(false)

function onImported(assessmentId: string) {
  router.push(`/assessment/assessments/${assessmentId}`)
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Assessments</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">
          Quiz, Written, and File Submission assessments across every module. Add new ones from a course's
          "Modules, Lessons & Assessments" section.
        </p>
      </div>
      <Button v-if="canCopyCrossTenant" variant="outline" @click="importDialogOpen = true">
        <Upload :size="14" /> Import from tenant…
      </Button>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6">
        <select
          v-model="courseFilter"
          class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
        >
          <option value="">All courses</option>
          <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
        <select
          v-model="moduleFilter"
          :disabled="!courseFilter"
          class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none disabled:opacity-50"
        >
          <option value="">All modules</option>
          <option v-for="m in modules" :key="m.id" :value="m.id">{{ m.title }}</option>
        </select>
        <select
          v-model="typeFilter"
          class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
        >
          <option value="">All types</option>
          <option v-for="t in ASSESSMENT_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>

      <div class="grid grid-cols-[2fr_1.5fr_100px_90px_90px_90px_60px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Title</span>
        <span>Course</span>
        <span>Type</span>
        <span>Order</span>
        <span>Required?</span>
        <span>Questions</span>
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading assessments…</p>
      <p v-else-if="assessments.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
        No assessments yet — add one from a course's Modules & Lessons section.
      </p>

      <div
        v-for="(item, i) in assessments"
        :key="item.id"
        :class="[rowClass, i < assessments.length - 1 && 'border-b border-(--line-1)']"
      >
        <button
          type="button"
          class="cursor-pointer bg-transparent p-0 text-left text-sm font-semibold text-(--fg-1) underline-offset-2 hover:underline"
          @click="openAssessment(item.id)"
        >
          {{ item.title }}
        </button>
        <div class="text-sm text-(--fg-3)">{{ courseTitle(item.courseId) }}</div>
        <div><RaChip tone="neutral">{{ item.type }}</RaChip></div>
        <div class="text-sm text-(--fg-2)">{{ item.order }}</div>
        <div><RaChip :tone="item.isRequired ? 'info' : 'neutral'">{{ item.isRequired ? 'Required' : 'Optional' }}</RaChip></div>
        <div class="text-sm text-(--fg-2)">{{ item.type === 'Quiz' ? item.questionCount : '—' }}</div>
        <div class="flex justify-end max-md:w-full max-md:justify-start">
          <DropdownMenu v-if="canCopyCrossTenant">
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem @select="openCopyDialog(item.id)">Copy to tenant…</DropdownMenuItem>
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

    <CopyAssessmentToTenantDialog v-model:open="copyDialogOpen" :assessment-id="copyDialogAssessmentId" />
    <ImportAssessmentFromTenantDialog v-model:open="importDialogOpen" @imported="onImported" />
  </div>
</template>
