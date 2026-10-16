<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { AlertTriangle, ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import UserComboBox from '@/components/UserComboBox.vue'
import LabSessionFields from '@/components/lab/LabSessionFields.vue'
import { ApiError } from '@/api/client'
import { hasPermission } from '@/store/auth'
import {
  approveLabRequest,
  assignLabSession,
  cancelLabSession,
  declineLabRequest,
  getAdminLabSession,
  unassignLabSession,
  updateLabSession,
  type AdminLabSessionDetail,
  type SaveLabSession,
} from '@/api/roboticsLab'

/**
 * One lab session for staff: its requests (approving one waitlists the rest), direct assignment,
 * and editing or cancelling it before it starts.
 */
const route = useRoute()
const labSessionId = computed(() => String(route.params.labSessionId))
const canManage = hasPermission('roboticslab:labsessions:manage')
const detail = ref<AdminLabSessionDetail | null>(null)
const loadError = ref('')
const busy = ref(false)
const assignUserId = ref<string | null>(null)

async function load() {
  try {
    detail.value = await getAdminLabSession(labSessionId.value)
  } catch (err) {
    loadError.value = err instanceof ApiError ? err.message : 'This lab session could not be loaded.'
  }
}
onMounted(load)

const session = computed(() => detail.value?.session ?? null)
const beforeStart = computed(() => !!session.value && Date.now() < new Date(session.value.startsAt).getTime())
const changeable = computed(() => beforeStart.value && ['Open', 'Assigned', 'Provisioned'].includes(session.value?.status ?? ''))
const openRequests = computed(() => detail.value?.requests.filter((r) => r.status === 'Pending' || r.status === 'Waitlisted') ?? [])
const closedRequests = computed(() => detail.value?.requests.filter((r) => r.status !== 'Pending' && r.status !== 'Waitlisted') ?? [])

async function act(action: () => Promise<AdminLabSessionDetail>, done: string) {
  busy.value = true
  try {
    detail.value = await action()
    toast.success(done)
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : 'Something went wrong.')
  } finally {
    busy.value = false
  }
}

async function assign() {
  if (!assignUserId.value) return
  await act(() => assignLabSession(labSessionId.value, assignUserId.value!), 'Learner assigned.')
  assignUserId.value = null
}

function cancel() {
  if (!window.confirm('Cancel this lab session? Everyone involved is told, and the robot time can be used again.')) return
  void act(() => cancelLabSession(labSessionId.value), 'Lab session cancelled.')
}

// --- Edit ---
const editOpen = ref(false)
const form = ref<SaveLabSession>({ title: '', description: null, visibility: 'Public', classId: null, courseId: null, requiredLessonId: null })

function openEdit() {
  const s = session.value!
  form.value = { title: s.title, description: s.description, visibility: s.visibility, classId: s.classId, courseId: s.courseId, requiredLessonId: s.requiredLessonId }
  editOpen.value = true
}

async function saveEdit() {
  await act(() => updateLabSession(labSessionId.value, { ...form.value, title: form.value.title.trim(), description: form.value.description?.trim() || null }), 'Lab session updated.')
  editOpen.value = false
}

function when(item: { startsAt: string; endsAt: string }): string {
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${formatDate(item.startsAt)} · ${time(item.startsAt)}–${time(item.endsAt)}`
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-6 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <RouterLink to="/roboticslab/lab-sessions" class="inline-flex items-center gap-1 text-xs text-(--fg-3) no-underline"><ArrowLeft :size="14" /> Robot lab sessions</RouterLink>

    <p v-if="loadError" class="text-sm text-(--danger)">{{ loadError }}</p>
    <template v-else-if="session">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-[28px] font-bold tracking-[-0.01em] text-(--fg-1)">{{ session.title }}</h1>
          <p class="mt-1 mb-0 text-sm text-(--fg-3)">{{ when(session) }} · {{ session.templateName }} · {{ session.visibility }}</p>
          <RaChip class="mt-2" tone="neutral">{{ session.status }}</RaChip>
        </div>
        <div v-if="canManage && changeable" class="flex gap-2">
          <Button variant="outline" @click="openEdit">Edit</Button>
          <Button variant="destructive" :disabled="busy" @click="cancel">Cancel session</Button>
        </div>
      </div>

      <RaCard v-if="session.flagReason" :padding="16" class="flex items-start gap-2 border-(--danger)">
        <AlertTriangle :size="16" class="mt-0.5 shrink-0 text-(--danger)" />
        <div class="text-sm text-(--fg-1)">
          <div class="font-semibold">Needs attention</div>
          <div class="text-(--fg-2)">{{ session.flagReason }}</div>
        </div>
      </RaCard>

      <RaCard :padding="20" class="flex flex-col gap-3">
        <h2 class="m-0 text-sm font-semibold text-(--fg-1)">Learner</h2>
        <div v-if="session.assignedUserId" class="flex flex-wrap items-center gap-3">
          <span class="text-sm text-(--fg-1)">{{ session.assignedUserName ?? session.assignedUserId }}</span>
          <RaChip v-if="session.status === 'Ended'" tone="neutral">{{ session.attended ? 'Attended' : 'Missed' }}</RaChip>
          <Button v-if="changeable" variant="ghost" size="sm" :disabled="busy" @click="act(() => unassignLabSession(labSessionId), 'Learner removed. The waitlist is open again.')">
            Unassign
          </Button>
        </div>
        <p v-else class="m-0 text-[13px] text-(--fg-3)">Nobody yet. Approve a request below, or assign a learner directly.</p>
        <div v-if="!session.assignedUserId && changeable" class="flex flex-wrap items-center gap-2">
          <UserComboBox v-model="assignUserId" />
          <Button size="sm" :disabled="!assignUserId || busy" @click="assign">Assign</Button>
        </div>
      </RaCard>

      <RaCard :padding="0" class="overflow-hidden">
        <div class="border-b border-(--line-1) px-6 py-3"><h2 class="m-0 text-sm font-semibold text-(--fg-1)">Requests</h2></div>
        <p v-if="!detail!.requests.length" class="p-6 text-center text-[13px] text-(--fg-3)">No requests.</p>
        <div v-for="request in [...openRequests, ...closedRequests]" :key="request.id" class="flex flex-wrap items-center gap-3 border-b border-(--line-1) px-6 py-3 last:border-b-0">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-(--fg-1)">{{ request.userName ?? request.userId }}</div>
            <div class="text-xs text-(--fg-3)">Asked {{ formatDate(request.createdAt) }}<template v-if="request.message"> · “{{ request.message }}”</template></div>
          </div>
          <RaChip tone="neutral">{{ request.status }}</RaChip>
          <template v-if="changeable && (request.status === 'Pending' || request.status === 'Waitlisted')">
            <Button size="sm" :disabled="busy || !!session.assignedUserId" @click="act(() => approveLabRequest(labSessionId, request.id), 'Approved. Other requests are waitlisted.')">Approve</Button>
            <Button variant="ghost" size="sm" :disabled="busy" @click="act(() => declineLabRequest(labSessionId, request.id), 'Request declined.')">Decline</Button>
          </template>
        </div>
      </RaCard>
    </template>

    <Dialog :open="editOpen" @update:open="(open) => (editOpen = open)">
      <DialogContent>
        <DialogHeader><DialogTitle>Edit lab session</DialogTitle></DialogHeader>
        <LabSessionFields v-model="form" />
        <DialogFooter>
          <Button variant="ghost" @click="editOpen = false">Cancel</Button>
          <Button :disabled="!form.title.trim() || (form.visibility === 'Class' && !form.classId) || busy" @click="saveEdit">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
