<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import TenantComboBox from '@/components/TenantComboBox.vue'
import { listCourseCatalog, getCourse, type CourseCatalogItem, type CourseModuleItem } from '@/api/learning'
import { listTenantAssessments, importAssessmentFromTenant, type AssessmentListItem } from '@/api/assessment'

const PLATFORM_TENANT_ID = import.meta.env.VITE_PLATFORM_TENANT_ID

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean]; imported: [assessmentId: string] }>()

const platformCourses = ref<CourseCatalogItem[]>([])
const targetCourseId = ref('')
const targetModules = ref<CourseModuleItem[]>([])
const targetModuleId = ref('')

const sourceTenantId = ref<string | null>(null)
const sourceAssessments = ref<AssessmentListItem[]>([])
const loadingAssessments = ref(false)
const importingId = ref<string | null>(null)

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  targetCourseId.value = ''
  targetModules.value = []
  targetModuleId.value = ''
  sourceTenantId.value = null
  sourceAssessments.value = []
  const result = await listCourseCatalog({}, 1, 100)
  platformCourses.value = result.items
})

watch(targetCourseId, async () => {
  targetModules.value = []
  targetModuleId.value = ''
  if (!targetCourseId.value) return
  const course = await getCourse(targetCourseId.value)
  targetModules.value = course.modules
})

watch(sourceTenantId, async () => {
  sourceAssessments.value = []
  if (!sourceTenantId.value) return
  loadingAssessments.value = true
  try {
    const result = await listTenantAssessments(sourceTenantId.value, {}, 1, 100)
    sourceAssessments.value = result.items
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : "Failed to load the source tenant's assessments.")
  } finally {
    loadingAssessments.value = false
  }
})

async function importAssessment(assessment: AssessmentListItem) {
  if (!sourceTenantId.value || !targetCourseId.value || !targetModuleId.value) return
  importingId.value = assessment.id
  try {
    const result = await importAssessmentFromTenant({
      sourceTenantId: sourceTenantId.value,
      assessmentId: assessment.id,
      targetCourseId: targetCourseId.value,
      targetModuleId: targetModuleId.value,
    })
    toast.success('Assessment imported.')
    emit('imported', result.assessmentId)
    emit('update:open', false)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to import assessment.')
  } finally {
    importingId.value = null
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>Import assessment from tenant</DialogTitle>
        <DialogDescription>
          Pull an assessment from another tenant into an existing course/module in the platform library.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-(--fg-3)">Destination course</span>
          <select
            v-model="targetCourseId"
            class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
          >
            <option value="">Select a course</option>
            <option v-for="c in platformCourses" :key="c.id" :value="c.id">{{ c.title }}</option>
          </select>
        </div>
        <div v-if="targetCourseId" class="flex flex-col gap-1.5">
          <span class="text-xs text-(--fg-3)">Destination module</span>
          <select
            v-model="targetModuleId"
            class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
          >
            <option value="">Select a module</option>
            <option v-for="m in targetModules" :key="m.id" :value="m.id">{{ m.title }}</option>
          </select>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-(--fg-3)">Source tenant</span>
          <TenantComboBox v-model="sourceTenantId" :exclude-tenant-id="PLATFORM_TENANT_ID" />
        </div>

        <template v-if="sourceTenantId && targetModuleId">
          <div class="flex flex-col gap-2 max-h-72 overflow-y-auto">
            <p v-if="loadingAssessments" class="p-3 text-center text-[13px] text-(--fg-3)">Loading assessments…</p>
            <p v-else-if="sourceAssessments.length === 0" class="p-3 text-center text-[13px] text-(--fg-3)">
              No assessments found.
            </p>
            <div
              v-for="assessment in sourceAssessments"
              :key="assessment.id"
              class="flex items-center justify-between gap-3 rounded-(--ra-md) border border-(--line-1) p-3"
            >
              <div>
                <div class="text-sm font-semibold text-(--fg-1)">{{ assessment.title }}</div>
                <div class="mt-0.5 text-xs text-(--fg-3)">
                  {{ assessment.type }} · {{ assessment.questionCount }}
                  question{{ assessment.questionCount === 1 ? '' : 's' }}
                </div>
              </div>
              <Button size="sm" :disabled="importingId === assessment.id" @click="importAssessment(assessment)">
                {{ importingId === assessment.id ? 'Importing…' : 'Import' }}
              </Button>
            </div>
          </div>
        </template>
        <p v-else class="text-xs text-(--fg-3)">
          Pick a destination course/module and a source tenant to browse assessments.
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" type="button" @click="emit('update:open', false)">Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
