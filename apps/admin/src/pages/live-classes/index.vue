<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { Plus, MoreVertical } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import Pagination from '@/components/Pagination.vue'
import UserComboBox from '@/components/UserComboBox.vue'
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
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import { getCurrentUser } from '@/store/auth'
import {
  listLiveClasses,
  createLiveClass,
  getLiveClass,
  cancelLiveClass,
  joinLiveClass,
  listCourseCatalog,
  type LiveClassListItem,
  type LiveClassDetail,
  type CourseCatalogItem,
} from '@/api/learning'

const {
  items: liveClasses,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList((page, pageSize) => listLiveClasses(undefined, page, pageSize), {
  initialPageSize: 20,
  errorMessage: 'Failed to load live classes.',
})

const courses = ref<CourseCatalogItem[]>([])

async function loadCourses() {
  const result = await listCourseCatalog({ state: 'Published' }, 1, 100)
  courses.value = result.items
}

function courseTitle(courseId: string): string {
  return courses.value.find((c) => c.id === courseId)?.title ?? '—'
}

const rowClass =
  'grid grid-cols-[2fr_1.5fr_1.5fr_120px_100px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(() => {
  load()
  loadCourses()
})

// --- Create live class ---
const createOpen = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({
  title: '', courseId: '', instructorUserId: null as string | null,
  scheduledStart: '', scheduledEnd: '', capacity: '',
})
const createErrors = ref<Record<string, string[]>>({})

function openCreate() {
  createForm.title = ''
  createForm.courseId = ''
  createForm.instructorUserId = null
  createForm.scheduledStart = ''
  createForm.scheduledEnd = ''
  createForm.capacity = ''
  createErrors.value = {}
  createOpen.value = true
}

async function submitCreate() {
  if (!createForm.instructorUserId) return
  createErrors.value = {}
  createSubmitting.value = true
  try {
    await createLiveClass({
      courseId: createForm.courseId,
      title: createForm.title,
      instructorUserId: createForm.instructorUserId,
      scheduledStart: new Date(createForm.scheduledStart).toISOString(),
      scheduledEnd: new Date(createForm.scheduledEnd).toISOString(),
      capacity: createForm.capacity ? Number(createForm.capacity) : undefined,
    })
    toast.success('Live class scheduled.')
    createOpen.value = false
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      createErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to schedule live class.')
    }
  } finally {
    createSubmitting.value = false
  }
}

// --- View / cancel / join ---
const viewingClass = ref<LiveClassListItem | null>(null)
const viewDetail = ref<LiveClassDetail | null>(null)
const viewLoading = ref(false)
const cancelling = ref(false)
const joinInfo = ref<{ iframeUrl: string; expiresAt: string } | null>(null)
const joining = ref(false)
const currentUserId = getCurrentUser()?.userId ?? null

async function openView(item: LiveClassListItem) {
  viewingClass.value = item
  viewDetail.value = null
  joinInfo.value = null
  viewLoading.value = true
  try {
    viewDetail.value = await getLiveClass(item.id)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load live class.')
  } finally {
    viewLoading.value = false
  }
}

function closeView() {
  viewingClass.value = null
  viewDetail.value = null
  joinInfo.value = null
}

async function submitCancel() {
  if (!viewDetail.value) return
  if (!window.confirm(`Cancel "${viewDetail.value.title}"?`)) return
  cancelling.value = true
  try {
    await cancelLiveClass(viewDetail.value.id)
    toast.success('Live class cancelled.')
    await openView(viewingClass.value!)
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to cancel live class.')
  } finally {
    cancelling.value = false
  }
}

async function submitJoin() {
  if (!viewDetail.value) return
  joining.value = true
  try {
    joinInfo.value = await joinLiveClass(viewDetail.value.id)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to get a join link.')
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Live Classes</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Schedule live sessions. This app never runs the video itself — it iframes the camera app once you join.</p>
      </div>
      <Button @click="openCreate">
        <Plus :size="14" /> Schedule Live Class
      </Button>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="grid grid-cols-[2fr_1.5fr_1.5fr_120px_100px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Title</span>
        <span>Course</span>
        <span>Scheduled</span>
        <span>Status</span>
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading live classes…</p>
      <p v-else-if="liveClasses.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
        No live classes scheduled yet.
      </p>

      <div
        v-for="(item, i) in liveClasses"
        :key="item.id"
        :class="[rowClass, i < liveClasses.length - 1 && 'border-b border-(--line-1)']"
      >
        <div class="text-sm font-semibold text-(--fg-1)">{{ item.title }}</div>
        <div class="text-sm text-(--fg-3)">{{ courseTitle(item.courseId) }}</div>
        <div class="text-sm text-(--fg-2)">{{ formatDate(item.scheduledStart) }}</div>
        <div><RaChip tone="neutral">{{ item.status }}</RaChip></div>
        <div class="flex justify-end max-md:w-full max-md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem @select="openView(item)">View</DropdownMenuItem>
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

    <!-- Create live class dialog -->
    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Live Class</DialogTitle>
          <DialogDescription>Provisions a session with the video app and lets learners book it.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitCreate">
          <div class="flex flex-col gap-1.5">
            <Label for="lc-title">Title</Label>
            <Input id="lc-title" v-model="createForm.title" required />
            <p v-for="msg in createErrors.Title" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="lc-course">Course</Label>
            <select
              id="lc-course"
              v-model="createForm.courseId"
              required
              class="h-10 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
            >
              <option value="" disabled>Select a course</option>
              <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Instructor</Label>
            <UserComboBox v-model="createForm.instructorUserId" />
          </div>
          <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div class="flex flex-col gap-1.5">
              <Label for="lc-start">Starts</Label>
              <Input id="lc-start" v-model="createForm.scheduledStart" type="datetime-local" required />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="lc-end">Ends</Label>
              <Input id="lc-end" v-model="createForm.scheduledEnd" type="datetime-local" required />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="lc-capacity">Capacity (optional)</Label>
            <Input id="lc-capacity" v-model="createForm.capacity" type="number" min="1" />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="createOpen = false">Cancel</Button>
            <Button type="submit" :disabled="createSubmitting || !createForm.instructorUserId">
              {{ createSubmitting ? 'Scheduling…' : 'Schedule' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- View live class dialog -->
    <Dialog :open="viewingClass !== null" @update:open="(open) => { if (!open) closeView() }">
      <DialogContent v-if="viewingClass">
        <DialogHeader>
          <DialogTitle>{{ viewingClass.title }}</DialogTitle>
          <DialogDescription>Course: {{ courseTitle(viewingClass.courseId) }}</DialogDescription>
        </DialogHeader>

        <p v-if="viewLoading" class="m-0 text-[13px] text-(--fg-3)">Loading…</p>
        <div v-else-if="viewDetail" class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <RaChip tone="neutral">{{ viewDetail.status }}</RaChip>
            <span class="text-xs text-(--fg-3)">{{ formatDate(viewDetail.scheduledStart) }} – {{ formatDate(viewDetail.scheduledEnd) }}</span>
          </div>
          <p class="m-0 text-[13px] text-(--fg-2)">
            Booked: {{ viewDetail.bookedCount }}<span v-if="viewDetail.capacity"> / {{ viewDetail.capacity }}</span>
            <span class="ml-2 text-xs text-(--fg-4)">(headcount only — no per-learner booking roster is available)</span>
          </p>

          <div v-if="joinInfo" class="overflow-hidden rounded-(--ra-md) border border-(--line-2)">
            <iframe :src="joinInfo.iframeUrl" class="h-80 w-full" title="Live class" />
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              v-if="currentUserId === viewDetail.instructorUserId && (viewDetail.status === 'Scheduled' || viewDetail.status === 'Live')"
              variant="outline"
              size="sm"
              :disabled="joining"
              @click="submitJoin"
            >
              {{ joining ? 'Getting link…' : 'Join as Instructor' }}
            </Button>
            <Button
              v-if="viewDetail.status === 'Scheduled' || viewDetail.status === 'Live'"
              variant="destructive"
              size="sm"
              :disabled="cancelling"
              @click="submitCancel"
            >
              {{ cancelling ? 'Cancelling…' : 'Cancel Live Class' }}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" @click="closeView">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
