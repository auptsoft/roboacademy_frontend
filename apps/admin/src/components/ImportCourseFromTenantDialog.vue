<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaChip } from '@roboacademy/ui'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Pagination from '@/components/Pagination.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import TenantComboBox from '@/components/TenantComboBox.vue'
import { listTenantCourses, importCourseFromTenant, type CourseCatalogItem } from '@/api/learning'

const PLATFORM_TENANT_ID = import.meta.env.VITE_PLATFORM_TENANT_ID

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean]; imported: [courseId: string] }>()

const sourceTenantId = ref<string | null>(null)
const search = ref('')
const importingId = ref<string | null>(null)

const {
  items: courses, loading, page, pageSize, meta, totalPages, load, goToPage, setPageSize,
} = usePagedList(
  (page, pageSize) => listTenantCourses(sourceTenantId.value!, search.value || undefined, page, pageSize),
  { initialPageSize: 10, errorMessage: 'Failed to load courses.' },
)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    sourceTenantId.value = null
    search.value = ''
  }
})

watch(sourceTenantId, () => {
  if (sourceTenantId.value) {
    page.value = 1
    load()
  }
})

let searchDebounce: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (!sourceTenantId.value) return
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => { page.value = 1; load() }, 300)
})

async function importCourse(course: CourseCatalogItem) {
  if (!sourceTenantId.value) return
  importingId.value = course.id
  try {
    const result = await importCourseFromTenant({ sourceTenantId: sourceTenantId.value, courseId: course.id })
    toast.success('Course imported.')
    emit('imported', result.courseId)
    emit('update:open', false)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to import course.')
  } finally {
    importingId.value = null
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>Import course from tenant</DialogTitle>
        <DialogDescription>
          Pull a course from another tenant into the platform library as a new draft copy.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <TenantComboBox v-model="sourceTenantId" :exclude-tenant-id="PLATFORM_TENANT_ID" />

        <template v-if="sourceTenantId">
          <Input v-model="search" placeholder="Search by title or description…" />

          <div class="flex flex-col gap-2 max-h-80 overflow-y-auto">
            <p v-if="loading" class="p-3 text-center text-[13px] text-(--fg-3)">Loading courses…</p>
            <p v-else-if="courses.length === 0" class="p-3 text-center text-[13px] text-(--fg-3)">
              No courses found.
            </p>
            <div
              v-for="course in courses"
              :key="course.id"
              class="flex items-center justify-between gap-3 rounded-(--ra-md) border border-(--line-1) p-3"
            >
              <div>
                <div class="text-sm font-semibold text-(--fg-1)">{{ course.title }}</div>
                <div class="mt-0.5 flex items-center gap-2 text-xs text-(--fg-3)">
                  <RaChip tone="neutral">{{ course.state }}</RaChip>
                  <span>{{ course.lessonCount }} lesson{{ course.lessonCount === 1 ? '' : 's' }}</span>
                </div>
              </div>
              <Button size="sm" :disabled="importingId === course.id" @click="importCourse(course)">
                {{ importingId === course.id ? 'Importing…' : 'Import' }}
              </Button>
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
        </template>
      </div>

      <DialogFooter>
        <Button variant="outline" type="button" @click="emit('update:open', false)">Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
