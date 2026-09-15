<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { MoreVertical } from 'lucide-vue-next'
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
import { listCourseCatalog, type CourseCatalogItem } from '@/api/learning'
import {
  listSessions,
  scheduleSession,
  cancelSession,
  joinSession,
  type SessionListItem,
  type PracticalStatus,
} from '@/api/roboticsLab'

const STATUS_OPTIONS: PracticalStatus[] = ['Requested', 'Scheduled', 'InProgress', 'Completed', 'Cancelled', 'Failed']

const filters = reactive<{ status: PracticalStatus | ''; courseId: string; userId: string | null }>({
  status: '', courseId: '', userId: null,
})

const {
  items: sessions,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList(
  (page, pageSize) => listSessions(
    {
      status: filters.status || undefined,
      courseId: filters.courseId || undefined,
      userId: filters.userId || undefined,
    },
    page,
    pageSize,
  ),
  { initialPageSize: 20, errorMessage: 'Failed to load sessions.' },
)

const courses = ref<CourseCatalogItem[]>([])

async function loadCourses() {
  const result = await listCourseCatalog({ state: 'Published' }, 1, 100)
  courses.value = result.items
}

function courseTitle(courseId: string): string {
  return courses.value.find((c) => c.id === courseId)?.title ?? '—'
}

const rowClass =
  'grid grid-cols-[1.5fr_1.5fr_120px_120px_1.5fr_100px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(() => {
  load()
  loadCourses()
})

watch(filters, () => {
  page.value = 1
  load()
}, { deep: true })

// --- Schedule ---
const schedulingItem = ref<SessionListItem | null>(null)
const scheduleForm = reactive({ scheduledStart: '', scheduledEnd: '', robotId: '' })
const scheduling = ref(false)

function openSchedule(item: SessionListItem) {
  schedulingItem.value = item
  scheduleForm.scheduledStart = ''
  scheduleForm.scheduledEnd = ''
  scheduleForm.robotId = ''
}

function closeSchedule() {
  schedulingItem.value = null
}

async function submitSchedule() {
  if (!schedulingItem.value) return
  scheduling.value = true
  try {
    await scheduleSession(schedulingItem.value.id, {
      scheduledStart: new Date(scheduleForm.scheduledStart).toISOString(),
      scheduledEnd: new Date(scheduleForm.scheduledEnd).toISOString(),
      robotId: scheduleForm.robotId,
    })
    toast.success('Session scheduled.')
    closeSchedule()
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to schedule session.')
  } finally {
    scheduling.value = false
  }
}

// --- Cancel ---
const cancellingId = ref<string | null>(null)

async function removeSession(item: SessionListItem) {
  if (!window.confirm('Cancel this session?')) return
  cancellingId.value = item.id
  try {
    await cancelSession(item.id)
    toast.success('Session cancelled.')
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to cancel session.')
  } finally {
    cancellingId.value = null
  }
}

// --- Join ---
const joiningItem = ref<SessionListItem | null>(null)
const joinInfo = ref<{ iframeUrl: string; expiresAt: string } | null>(null)
const joining = ref(false)

async function openJoin(item: SessionListItem) {
  joiningItem.value = item
  joinInfo.value = null
  joining.value = true
  try {
    joinInfo.value = await joinSession(item.id)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to get a join link.')
  } finally {
    joining.value = false
  }
}

function closeJoin() {
  joiningItem.value = null
  joinInfo.value = null
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Robotics Lab Sessions</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Schedule physical-robot sessions and oversee bookings. This app never runs the simulation or robot control itself — it iframes the external app once you join.
      </p>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6">
        <select
          v-model="filters.status"
          class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
        >
          <option value="">All statuses</option>
          <option v-for="status in STATUS_OPTIONS" :key="status" :value="status">{{ status }}</option>
        </select>
        <select
          v-model="filters.courseId"
          class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
        >
          <option value="">All courses</option>
          <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
        <UserComboBox v-model="filters.userId" />
        <Button v-if="filters.userId" variant="ghost" size="sm" @click="filters.userId = null">Clear learner filter</Button>
      </div>

      <div class="grid grid-cols-[1.5fr_1.5fr_120px_120px_1.5fr_100px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Course</span>
        <span>Learner Id</span>
        <span>Mode</span>
        <span>Status</span>
        <span>Scheduled</span>
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading sessions…</p>
      <p v-else-if="sessions.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No sessions found.</p>

      <div
        v-for="(item, i) in sessions"
        :key="item.id"
        :class="[rowClass, i < sessions.length - 1 && 'border-b border-(--line-1)']"
      >
        <div class="text-sm font-semibold text-(--fg-1)">{{ courseTitle(item.courseId) }}</div>
        <div class="font-mono text-xs text-(--fg-3)">{{ item.userId }}</div>
        <div><RaChip tone="neutral">{{ item.mode }}</RaChip></div>
        <div><RaChip tone="neutral">{{ item.status }}</RaChip></div>
        <div class="text-sm text-(--fg-2)">{{ item.scheduledStart ? formatDate(item.scheduledStart) : '—' }}</div>
        <div class="flex justify-end max-md:w-full max-md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                :disabled="item.status !== 'Requested' || item.mode !== 'PhysicalRobot'"
                @select="openSchedule(item)"
              >
                Schedule
              </DropdownMenuItem>
              <DropdownMenuItem
                :disabled="item.status === 'Scheduled' || item.status === 'InProgress'"
                @select="openJoin(item)"
              >
                Join
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                :disabled="cancellingId === item.id || item.status === 'Completed' || item.status === 'Cancelled' || item.status === 'Failed'"
                @select="removeSession(item)"
              >
                Cancel
              </DropdownMenuItem>
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

    <!-- Schedule dialog -->
    <Dialog :open="schedulingItem !== null" @update:open="(open) => { if (!open) closeSchedule() }">
      <DialogContent v-if="schedulingItem">
        <DialogHeader>
          <DialogTitle>Schedule Session</DialogTitle>
          <DialogDescription>Confirms a window and robot for this requested physical-robot session.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitSchedule">
          <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div class="flex flex-col gap-1.5">
              <Label for="sched-start">Starts</Label>
              <Input id="sched-start" v-model="scheduleForm.scheduledStart" type="datetime-local" required />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="sched-end">Ends</Label>
              <Input id="sched-end" v-model="scheduleForm.scheduledEnd" type="datetime-local" required />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="sched-robot">Robot Id</Label>
            <Input id="sched-robot" v-model="scheduleForm.robotId" placeholder="robot-42" required />
            <p class="m-0 text-xs text-(--fg-4)">Free text — there is no robot inventory to pick from yet.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="closeSchedule">Cancel</Button>
            <Button type="submit" :disabled="scheduling">{{ scheduling ? 'Scheduling…' : 'Schedule' }}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Join dialog -->
    <Dialog :open="joiningItem !== null" @update:open="(open) => { if (!open) closeJoin() }">
      <DialogContent v-if="joiningItem">
        <DialogHeader>
          <DialogTitle>Join Session</DialogTitle>
          <DialogDescription>{{ courseTitle(joiningItem.courseId) }}</DialogDescription>
        </DialogHeader>
        <p v-if="joining" class="m-0 text-[13px] text-(--fg-3)">Getting join link…</p>
        <div v-else-if="joinInfo" class="overflow-hidden rounded-(--ra-md) border border-(--line-2)">
          <iframe :src="joinInfo.iframeUrl" class="h-80 w-full" title="Robotics lab session" />
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" @click="closeJoin">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
