<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { AlertTriangle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import LabSessionFields from '@/components/lab/LabSessionFields.vue'
import { ApiError } from '@/api/client'
import { hasPermission } from '@/store/auth'
import {
  createLabSession,
  listAdminLabSessions,
  listSchoolLabSlots,
  type AdminLabSession,
  type SaveLabSession,
  type SchoolLabSlot,
} from '@/api/roboticsLab'

/**
 * A school's robot lab: robot time the platform gave the school, and the lab sessions made from
 * it. Teachers see only sessions for their classes.
 */
const router = useRouter()
const canManage = hasPermission('roboticslab:labsessions:manage')
const slots = ref<SchoolLabSlot[]>([])
const sessions = ref<AdminLabSession[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    ;[sessions.value, slots.value] = await Promise.all([listAdminLabSessions(), canManage ? listSchoolLabSlots() : Promise.resolve([])])
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : 'Lab sessions could not be loaded.')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const upcoming = computed(() => sessions.value.filter((s) => !['Ended', 'Unused', 'Cancelled'].includes(s.status)))
const past = computed(() => sessions.value.filter((s) => ['Ended', 'Unused', 'Cancelled'].includes(s.status)))

// --- Create from a slot ---
const createFor = ref<SchoolLabSlot | null>(null)
const form = ref<SaveLabSession>({ title: '', description: null, visibility: 'Public', classId: null, courseId: null, requiredLessonId: null })
const createError = ref('')

function openCreate(slot: SchoolLabSlot) {
  form.value = { title: slot.templateName, description: null, visibility: 'Public', classId: null, courseId: null, requiredLessonId: null }
  createError.value = ''
  createFor.value = slot
}

async function create() {
  if (!createFor.value) return
  createError.value = ''
  try {
    const session = await createLabSession({ ...form.value, slotId: createFor.value.id, title: form.value.title.trim(), description: form.value.description?.trim() || null })
    createFor.value = null
    await router.push(`/roboticslab/lab-sessions/${session.id}`)
  } catch (err) {
    createError.value = err instanceof ApiError ? err.message : 'The lab session could not be created.'
  }
}

function when(item: { startsAt: string; endsAt: string }): string {
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${formatDate(item.startsAt)} · ${time(item.startsAt)}–${time(item.endsAt)}`
}

function statusLabel(s: AdminLabSession): string {
  if (s.status === 'Ended') return s.attended ? 'Attended' : 'Missed'
  if (s.status === 'InProgress') return 'In progress'
  if (s.status === 'Provisioned') return 'Ready'
  return s.status
}

const rowClass = 'grid grid-cols-[1.6fr_1.4fr_1fr_1fr_120px] items-center gap-3 px-6 py-3.5 max-md:grid-cols-1 max-md:gap-1.5 cursor-pointer hover:bg-muted'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Robot Lab Sessions</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Time on real robots for one learner each. Learners ask for public and class sessions; you choose who gets each one.
      </p>
    </div>

    <RaCard v-if="canManage" :padding="0" class="overflow-hidden">
      <div class="border-b border-(--line-1) px-6 py-3">
        <h2 class="m-0 text-sm font-semibold text-(--fg-1)">Robot time waiting to be used</h2>
      </div>
      <p v-if="!slots.length" class="p-6 text-center text-[13px] text-(--fg-3)">No unused robot time. The platform team gives robot time to schools.</p>
      <div v-for="(slot, i) in slots" :key="slot.id" class="flex flex-wrap items-center gap-3 px-6 py-3" :class="i < slots.length - 1 && 'border-b border-(--line-1)'">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 text-sm font-semibold text-(--fg-1)">
            {{ slot.templateName }} <RaChip tone="neutral">{{ slot.ownSlot ? 'Your robots' : 'From RoboAcademy' }}</RaChip>
          </div>
          <div class="text-xs text-(--fg-3)">{{ when(slot) }} · {{ slot.robotIds.join(', ') }}</div>
        </div>
        <Button size="sm" @click="openCreate(slot)">Create lab session</Button>
      </div>
    </RaCard>

    <RaCard v-for="group in [{ label: 'Upcoming', items: upcoming }, { label: 'Past', items: past }]" :key="group.label" :padding="0" class="overflow-hidden">
      <div class="border-b border-(--line-1) px-6 py-3"><h2 class="m-0 text-sm font-semibold text-(--fg-1)">{{ group.label }}</h2></div>
      <div v-if="group.label === 'Upcoming'" :class="[rowClass, 'border-b border-(--line-1) text-xs text-(--fg-3) max-md:hidden cursor-default hover:bg-transparent']">
        <span>Session</span><span>When</span><span>Learner</span><span>Requests</span><span>Status</span>
      </div>
      <p v-if="loading && !group.items.length" class="p-6 text-center text-[13px] text-(--fg-3)">Loading…</p>
      <p v-else-if="!group.items.length" class="p-6 text-center text-[13px] text-(--fg-3)">Nothing here.</p>
      <div
        v-for="(s, i) in group.items"
        :key="s.id"
        :class="[rowClass, i < group.items.length - 1 && 'border-b border-(--line-1)']"
        @click="router.push(`/roboticslab/lab-sessions/${s.id}`)"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 truncate text-sm font-semibold text-(--fg-1)">
            <AlertTriangle v-if="s.flagReason" :size="14" class="shrink-0 text-(--danger)" />{{ s.title }}
          </div>
          <div class="truncate text-xs text-(--fg-3)">{{ s.visibility }} · {{ s.templateName }}</div>
        </div>
        <div class="text-sm text-(--fg-2)">{{ when(s) }}</div>
        <div class="truncate text-sm text-(--fg-2)">{{ s.assignedUserName ?? '—' }}</div>
        <div class="text-sm text-(--fg-2)">{{ s.openRequestCount || '—' }}</div>
        <div><RaChip :tone="s.flagReason ? 'neutral' : s.status === 'Open' ? 'info' : 'neutral'">{{ s.flagReason ? 'Needs attention' : statusLabel(s) }}</RaChip></div>
      </div>
    </RaCard>

    <Dialog :open="!!createFor" @update:open="(open) => !open && (createFor = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a lab session</DialogTitle>
          <DialogDescription v-if="createFor">{{ createFor.templateName }} · {{ when(createFor) }}</DialogDescription>
        </DialogHeader>
        <LabSessionFields v-model="form" />
        <p v-if="createError" class="m-0 text-xs text-(--danger)">{{ createError }}</p>
        <DialogFooter>
          <Button variant="ghost" @click="createFor = null">Cancel</Button>
          <Button :disabled="!form.title.trim() || (form.visibility === 'Class' && !form.classId)" @click="create">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
