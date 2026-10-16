<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { MoreVertical, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Label from '@/components/ui/label.vue'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ApiError } from '@/api/client'
import { listTenants, type Tenant } from '@/api/tenancy'
import {
  allocateLabSlot,
  cancelLabSlot,
  createLabSlot,
  deallocateLabSlot,
  listLabProviders,
  listLabTemplates,
  listPlatformLabSlots,
  type LabProvider,
  type LabTemplate,
  type PlatformLabSlot,
} from '@/api/roboticsLab'

/**
 * Platform admin: robot time. A slot is a botnova template plus a time window, given to one
 * school. RoboAcademy refuses a slot whose robots are already booked at that time.
 */
const providers = ref<LabProvider[]>([])
const tenants = ref<Tenant[]>([])
const slots = ref<PlatformLabSlot[]>([])
const providerFilter = ref('')
const loading = ref(false)

const tenantName = (id: string | null) => (id ? tenants.value.find((t) => t.tenantId === id)?.name ?? 'Unknown school' : '—')
const providerName = (id: string) => providers.value.find((p) => p.id === id)?.name ?? '—'

async function load() {
  loading.value = true
  try {
    slots.value = await listPlatformLabSlots({ providerId: providerFilter.value || undefined })
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : 'Slots could not be loaded.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    providers.value = await listLabProviders()
    tenants.value = (await listTenants(1, 200)).items
  } catch {
    // Shown as missing names; the slot list still loads.
  }
  await load()
})
watch(providerFilter, load)

const fail = (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong.')

// --- Create ---
const createOpen = ref(false)
const templates = ref<LabTemplate[]>([])
const createError = ref('')
const form = reactive({ providerId: '', templateId: '', date: '', time: '09:00', minutes: 60, tenantId: '' })

async function openCreate() {
  const active = providers.value.filter((p) => p.status === 'Active')
  Object.assign(form, { providerId: active[0]?.id ?? '', templateId: '', date: '', time: '09:00', minutes: 60, tenantId: '' })
  createError.value = ''
  createOpen.value = true
}

watch(() => form.providerId, async (providerId) => {
  templates.value = []
  form.templateId = ''
  if (!providerId) return
  try {
    templates.value = await listLabTemplates(providerId)
  } catch (err) {
    fail(err)
  }
})

const selectedTemplate = computed(() => templates.value.find((t) => t.templateId === form.templateId))

async function create() {
  createError.value = ''
  const start = new Date(`${form.date}T${form.time}`)
  if (Number.isNaN(start.getTime())) {
    createError.value = 'Pick a date and time.'
    return
  }
  try {
    await createLabSlot({
      providerId: form.providerId,
      templateId: form.templateId,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + form.minutes * 60_000).toISOString(),
      tenantId: form.tenantId || null,
    })
    createOpen.value = false
    toast.success('Slot created.')
    await load()
  } catch (err) {
    // Clashes come back as 409 with the robot and time that clash.
    createError.value = err instanceof ApiError ? err.message : 'The slot could not be created.'
  }
}

// --- Allocate ---
const allocateTarget = ref<PlatformLabSlot | null>(null)
const allocateTenant = ref('')

async function allocate() {
  if (!allocateTarget.value || !allocateTenant.value) return
  try {
    await allocateLabSlot(allocateTarget.value.id, allocateTenant.value)
    allocateTarget.value = null
    toast.success('Slot given to the school.')
    await load()
  } catch (err) {
    fail(err)
  }
}

async function act(action: () => Promise<unknown>, done: string) {
  try {
    await action()
    toast.success(done)
    await load()
  } catch (err) {
    fail(err)
  }
}

function when(slot: PlatformLabSlot): string {
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${formatDate(slot.startsAt)} · ${time(slot.startsAt)}–${time(slot.endsAt)}`
}

const selectClass = 'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
const rowClass = 'grid grid-cols-[1.4fr_1.4fr_1fr_1fr_110px_48px] items-center gap-3 px-6 py-3.5 max-md:grid-cols-1 max-md:gap-1.5'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Robot Lab Slots</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Robot time from a botnova template, given to a school to turn into lab sessions.</p>
      </div>
      <Button :disabled="!providers.some((p) => p.status === 'Active')" @click="openCreate"><Plus :size="16" />New slot</Button>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) px-6 py-3">
        <select v-model="providerFilter" class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none">
          <option value="">All providers</option>
          <option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
        </select>
      </div>
      <div :class="[rowClass, 'border-b border-(--line-1) text-xs text-(--fg-3) max-md:hidden']">
        <span>When</span><span>Template</span><span>Provider</span><span>School</span><span>Status</span><span />
      </div>
      <p v-if="loading && !slots.length" class="p-6 text-center text-[13px] text-(--fg-3)">Loading slots…</p>
      <p v-else-if="!slots.length" class="p-6 text-center text-[13px] text-(--fg-3)">No slots in the next two months.</p>
      <div v-for="(slot, i) in slots" :key="slot.id" :class="[rowClass, i < slots.length - 1 && 'border-b border-(--line-1)']">
        <div class="text-sm text-(--fg-1)">{{ when(slot) }}</div>
        <div class="min-w-0">
          <div class="truncate text-sm text-(--fg-1)">{{ slot.templateName }}</div>
          <div class="truncate text-xs text-(--fg-3)">{{ slot.robotIds.join(', ') }}</div>
        </div>
        <div class="text-sm text-(--fg-2)">{{ providerName(slot.providerId) }}</div>
        <div class="text-sm text-(--fg-2)">{{ tenantName(slot.allocatedTenantId) }}</div>
        <div><RaChip :tone="slot.status === 'InUse' ? 'info' : 'neutral'">{{ slot.status === 'InUse' ? 'In use' : slot.status }}</RaChip></div>
        <div class="flex justify-end">
          <DropdownMenu v-if="slot.status !== 'Cancelled'">
            <DropdownMenuTrigger class="inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none hover:bg-muted">
              <MoreVertical :size="16" /><span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem v-if="slot.status === 'Unallocated' || slot.status === 'Allocated'" @select="allocateTarget = slot; allocateTenant = slot.allocatedTenantId ?? ''">
                {{ slot.status === 'Allocated' ? 'Give to another school' : 'Give to a school' }}
              </DropdownMenuItem>
              <DropdownMenuItem v-if="slot.status === 'Allocated'" @select="act(() => deallocateLabSlot(slot.id), 'Slot taken back.')">Take back</DropdownMenuItem>
              <DropdownMenuItem class="text-(--danger)" @select="act(() => cancelLabSlot(slot.id), 'Slot cancelled.')">Cancel slot</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </RaCard>

    <Dialog :open="createOpen" @update:open="(open) => (createOpen = open)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New slot</DialogTitle>
          <DialogDescription>Pick a template and a time. Templates are set up in botnova.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-3">
          <div class="grid gap-1.5">
            <Label for="slot-provider">Provider</Label>
            <select id="slot-provider" v-model="form.providerId" :class="selectClass">
              <option v-for="provider in providers.filter((p) => p.status === 'Active')" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
            </select>
          </div>
          <div class="grid gap-1.5">
            <Label for="slot-template">Template</Label>
            <select id="slot-template" v-model="form.templateId" :class="selectClass">
              <option value="" disabled>Choose a template</option>
              <option v-for="template in templates" :key="template.templateId" :value="template.templateId">{{ template.name }}</option>
            </select>
            <p v-if="selectedTemplate" class="m-0 text-xs text-(--fg-3)">Robots: {{ selectedTemplate.robotIds.join(', ') || 'none' }}</p>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="grid gap-1.5"><Label for="slot-date">Date</Label><input id="slot-date" v-model="form.date" type="date" :class="selectClass"></div>
            <div class="grid gap-1.5"><Label for="slot-time">Start</Label><input id="slot-time" v-model="form.time" type="time" :class="selectClass"></div>
            <div class="grid gap-1.5"><Label for="slot-length">Minutes</Label><input id="slot-length" v-model.number="form.minutes" type="number" min="15" step="15" :class="selectClass"></div>
          </div>
          <div class="grid gap-1.5">
            <Label for="slot-tenant">Give to school (optional)</Label>
            <select id="slot-tenant" v-model="form.tenantId" :class="selectClass">
              <option value="">Decide later</option>
              <option v-for="tenant in tenants" :key="tenant.tenantId" :value="tenant.tenantId">{{ tenant.name }}</option>
            </select>
          </div>
          <p v-if="createError" class="m-0 text-xs text-(--danger)">{{ createError }}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="createOpen = false">Cancel</Button>
          <Button :disabled="!form.providerId || !form.templateId || !form.date || form.minutes < 15" @click="create">Create slot</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!allocateTarget" @update:open="(open) => !open && (allocateTarget = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give this slot to a school</DialogTitle>
          <DialogDescription>Only that school will see it, and can turn it into a lab session.</DialogDescription>
        </DialogHeader>
        <select v-model="allocateTenant" :class="selectClass">
          <option value="" disabled>Choose a school</option>
          <option v-for="tenant in tenants" :key="tenant.tenantId" :value="tenant.tenantId">{{ tenant.name }}</option>
        </select>
        <DialogFooter>
          <Button variant="ghost" @click="allocateTarget = null">Cancel</Button>
          <Button :disabled="!allocateTenant" @click="allocate">Give slot</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
