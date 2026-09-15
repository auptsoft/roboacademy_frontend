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
import { listTenantCourses, getTenantCourse, type CourseCatalogItem, type CourseModuleItem } from '@/api/learning'
import { copyAssessmentToTenants } from '@/api/assessment'

// Unlike CopyToTenantsDialog (course copy, fans out to many tenants with no further input),
// copying a standalone assessment needs an existing destination course+module in each target
// tenant - something the platform admin can't know without browsing that tenant first. So this
// is one target at a time: pick a tenant, browse its courses/modules via the same from-tenant
// endpoints the import flow uses, then copy. Repeat for another tenant if needed.
const PLATFORM_TENANT_ID = import.meta.env.VITE_PLATFORM_TENANT_ID

const props = defineProps<{ open: boolean; assessmentId: string }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const targetTenantId = ref<string | null>(null)
const targetCourses = ref<CourseCatalogItem[]>([])
const targetCourseId = ref('')
const targetModules = ref<CourseModuleItem[]>([])
const targetModuleId = ref('')
const loadingCourses = ref(false)
const loadingModules = ref(false)
const submitting = ref(false)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    targetTenantId.value = null
    targetCourses.value = []
    targetCourseId.value = ''
    targetModules.value = []
    targetModuleId.value = ''
  }
})

watch(targetTenantId, async () => {
  targetCourses.value = []
  targetCourseId.value = ''
  targetModules.value = []
  targetModuleId.value = ''
  if (!targetTenantId.value) return
  loadingCourses.value = true
  try {
    const result = await listTenantCourses(targetTenantId.value, undefined, 1, 100)
    targetCourses.value = result.items
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : "Failed to load the target tenant's courses.")
  } finally {
    loadingCourses.value = false
  }
})

watch(targetCourseId, async () => {
  targetModules.value = []
  targetModuleId.value = ''
  if (!targetTenantId.value || !targetCourseId.value) return
  loadingModules.value = true
  try {
    const course = await getTenantCourse(targetTenantId.value, targetCourseId.value)
    targetModules.value = course.modules
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : "Failed to load the target course's modules.")
  } finally {
    loadingModules.value = false
  }
})

async function submit() {
  if (!targetTenantId.value || !targetCourseId.value || !targetModuleId.value) return
  submitting.value = true
  try {
    const result = await copyAssessmentToTenants(props.assessmentId, {
      targets: [{ tenantId: targetTenantId.value, courseId: targetCourseId.value, moduleId: targetModuleId.value }],
    })
    const outcome = result.results[0]
    if (outcome?.isSuccessful) {
      toast.success('Assessment copied.')
      emit('update:open', false)
    } else {
      toast.error(outcome?.error ?? 'Failed to copy assessment.')
    }
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to copy assessment.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Copy assessment to a tenant</DialogTitle>
        <DialogDescription>
          Copies this assessment into an existing course and module in the target tenant.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-(--fg-3)">Target tenant</span>
          <TenantComboBox v-model="targetTenantId" :exclude-tenant-id="PLATFORM_TENANT_ID" />
        </div>

        <div v-if="targetTenantId" class="flex flex-col gap-1.5">
          <span class="text-xs text-(--fg-3)">Target course</span>
          <select
            v-model="targetCourseId"
            :disabled="loadingCourses"
            class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
          >
            <option value="">{{ loadingCourses ? 'Loading…' : 'Select a course' }}</option>
            <option v-for="c in targetCourses" :key="c.id" :value="c.id">{{ c.title }}</option>
          </select>
        </div>

        <div v-if="targetCourseId" class="flex flex-col gap-1.5">
          <span class="text-xs text-(--fg-3)">Target module</span>
          <select
            v-model="targetModuleId"
            :disabled="loadingModules"
            class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
          >
            <option value="">{{ loadingModules ? 'Loading…' : 'Select a module' }}</option>
            <option v-for="m in targetModules" :key="m.id" :value="m.id">{{ m.title }}</option>
          </select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" type="button" @click="emit('update:open', false)">Cancel</Button>
        <Button type="button" :disabled="submitting || !targetModuleId" @click="submit">
          {{ submitting ? 'Copying…' : 'Copy' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
