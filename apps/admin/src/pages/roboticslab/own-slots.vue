<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Label from '@/components/ui/label.vue'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import {
  cancelOwnSlot,
  createOwnSlot,
  getOwnProvider,
  listOwnSlots,
  listOwnTemplates,
  type LabProvider,
  type LabTemplate,
  type PlatformLabSlot,
} from '@/api/roboticsLab'

/**
 * A school's own robot time (Robotics Lab Phase P2): slots from its own botnova templates. Each
 * slot then becomes a lab session under Lab Sessions, like robot time from the platform.
 */
const provider = ref<LabProvider | null>(null)
const slots = ref<PlatformLabSlot[]>([])
const templates = ref<LabTemplate[]>([])
const loading = ref(true)

const fail = (err: unknown, fallback = 'Something went wrong.') => toast.error(err instanceof ApiError ? err.message : fallback)

async function loadSlots() {
  try {
    slots.value = await listOwnSlots()
  } catch (err) {
    fail(err, "Your robot time couldn't be loaded.")
  }
}

onMounted(async () => {
  try {
    provider.value = await getOwnProvider()
    if (provider.value) await loadSlots()
  } catch (err) {
    fail(err, "Your botnova connection couldn't be loaded.")
  } finally {
    loading.value = false
  }
})

const canSchedule = computed(() => provider.value?.status === 'Active')

// --- Create ---
const createOpen = ref(false)
const createError = ref('')
const form = reactive({ templateId: '', date: '', time: '09:00', minutes: 60 })
const selectedTemplate = computed(() => templates.value.find((t) => t.templateId === form.templateId))

async function openCreate() {
  Object.assign(form, { templateId: '', date: '', time: '09:00', minutes: 60 })
  createError.value = ''
  createOpen.value = true
  try {
    templates.value = await listOwnTemplates()
    form.templateId = templates.value[0]?.templateId ?? ''
  } catch (err) {
    createError.value = err instanceof ApiError ? err.message : "Your botnova templates couldn't be loaded."
  }
}

async function create() {
  createError.value = ''
  const start = new Date(`${form.date}T${form.time}`)
  if (Number.isNaN(start.getTime())) {
    createError.value = 'Pick a date and time.'
    return
  }
  try {
    await createOwnSlot({
      templateId: form.templateId,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + form.minutes * 60_000).toISOString(),
    })
    createOpen.value = false
    toast.success('Robot time added. Turn it into a lab session under Lab Sessions.')
    await loadSlots()
  } catch (err) {
    // A clash names the robot and the time it's already booked.
    createError.value = err instanceof ApiError ? err.message : "The robot time couldn't be added."
  }
}

async function cancel(slot: PlatformLabSlot) {
  if (!window.confirm('Cancel this robot time? A lab session on it is cancelled too, and everyone involved is told.')) return
  try {
    await cancelOwnSlot(slot.id)
    toast.success('Robot time cancelled.')
    await loadSlots()
  } catch (err) {
    fail(err)
  }
}

function when(slot: PlatformLabSlot): string {
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${formatDate(slot.startsAt)} · ${time(slot.startsAt)}–${time(slot.endsAt)}`
}

function statusLabel(slot: PlatformLabSlot): string {
  if (slot.status === 'Allocated') return new Date(slot.endsAt).getTime() < Date.now() ? 'Not used' : 'Waiting for a session'
  if (slot.status === 'InUse') return 'Lab session made'
  return slot.status
}

const selectClass = 'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
const rowClass = 'grid grid-cols-[1.4fr_1.6fr_150px_110px] items-center gap-3 px-6 py-3.5 max-md:grid-cols-1 max-md:gap-1.5'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Our Robot Time</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Time on your own robots, from your botnova templates. Turn each one into a lab session under Lab Sessions.</p>
      </div>
      <Button v-if="provider" :disabled="!canSchedule" @click="openCreate"><Plus :size="16" />Add robot time</Button>
    </div>

    <p v-if="loading" class="text-sm text-(--fg-3)">Loading…</p>
    <RaCard v-else-if="!provider" :padding="24">
      <p class="m-0 text-sm text-(--fg-2)">
        Connect your botnova account first, under
        <RouterLink to="/roboticslab/own-provider" class="font-semibold text-(--brand-blue) no-underline">Our botnova Account</RouterLink>.
      </p>
    </RaCard>

    <template v-else>
      <RaCard v-if="!canSchedule" :padding="16">
        <p class="m-0 text-sm text-(--fg-2)">
          {{ provider.status === 'Suspended'
            ? 'Your plan no longer includes your own robots, so new robot time can’t be added.'
            : 'Your botnova connection isn’t working, so new robot time can’t be added.' }}
          <RouterLink to="/roboticslab/own-provider" class="font-semibold text-(--brand-blue) no-underline">Check the connection</RouterLink>
        </p>
      </RaCard>

      <RaCard :padding="0" class="overflow-hidden">
        <div :class="[rowClass, 'border-b border-(--line-1) text-xs text-(--fg-3) max-md:hidden']">
          <span>When</span><span>Template</span><span>Status</span><span />
        </div>
        <p v-if="!slots.length" class="p-6 text-center text-[13px] text-(--fg-3)">No robot time in the next two months.</p>
        <div v-for="(slot, i) in slots" :key="slot.id" :class="[rowClass, i < slots.length - 1 && 'border-b border-(--line-1)']">
          <div class="text-sm text-(--fg-1)">{{ when(slot) }}</div>
          <div class="min-w-0">
            <div class="truncate text-sm text-(--fg-1)">{{ slot.templateName }}</div>
            <div class="truncate text-xs text-(--fg-3)">{{ slot.robotIds.join(', ') }}</div>
          </div>
          <div><RaChip :tone="slot.status === 'InUse' ? 'info' : 'neutral'">{{ statusLabel(slot) }}</RaChip></div>
          <div class="flex justify-end">
            <Button v-if="slot.status !== 'Cancelled' && new Date(slot.endsAt).getTime() > Date.now()" variant="ghost" size="sm" class="text-(--danger)" @click="cancel(slot)">
              Cancel
            </Button>
          </div>
        </div>
      </RaCard>
    </template>

    <Dialog :open="createOpen" @update:open="(open) => (createOpen = open)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add robot time</DialogTitle>
          <DialogDescription>Pick one of your botnova templates and a time. Robots already booked then are refused.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-3">
          <div class="grid gap-1.5">
            <Label for="own-slot-template">Template</Label>
            <select id="own-slot-template" v-model="form.templateId" :class="selectClass">
              <option value="" disabled>{{ templates.length ? 'Choose a template' : 'No templates in botnova yet' }}</option>
              <option v-for="template in templates" :key="template.templateId" :value="template.templateId">{{ template.name }}</option>
            </select>
            <p v-if="selectedTemplate" class="m-0 text-xs text-(--fg-3)">Robots: {{ selectedTemplate.robotIds.join(', ') || 'none' }}</p>
          </div>
          <div class="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            <div class="grid gap-1.5"><Label for="own-slot-date">Date</Label><input id="own-slot-date" v-model="form.date" type="date" :class="selectClass"></div>
            <div class="grid gap-1.5"><Label for="own-slot-time">Start</Label><input id="own-slot-time" v-model="form.time" type="time" :class="selectClass"></div>
            <div class="grid gap-1.5"><Label for="own-slot-length">Minutes</Label><input id="own-slot-length" v-model.number="form.minutes" type="number" min="15" step="15" :class="selectClass"></div>
          </div>
          <p v-if="createError" class="m-0 text-xs text-(--danger)">{{ createError }}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="createOpen = false">Cancel</Button>
          <Button :disabled="!form.templateId || !form.date || form.minutes < 15" @click="create">Add robot time</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
