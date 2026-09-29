<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import SearchMultiSelect, { type SearchOption } from '@/components/SearchMultiSelect.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import { listClasses } from '@/api/identity'
import { searchClasses } from '@/lib/pickers'
import {
  createEvent,
  updateEvent,
  EVENT_TYPES,
  type EventAudience,
  type EventDetail,
  type EventType,
} from '@/api/scheduling'

// Create (no `event`) or edit an event. Emits the saved event so the caller can refresh or
// navigate to it.
const props = defineProps<{ open: boolean; event?: EventDetail | null }>()
const emit = defineEmits<{ 'update:open': [open: boolean]; saved: [event: EventDetail] }>()

const form = reactive({
  title: '',
  description: '',
  type: 'Workshop' as EventType,
  startsAt: '',
  endsAt: '',
  location: '',
  onlineUrl: '',
  capacity: '',
  audience: 'Everyone' as EventAudience,
  classes: [] as SearchOption[],
})
const errors = ref<Record<string, string[]>>({})
const submitting = ref(false)

/** ISO -> `<input type="datetime-local">` value in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function classOptions(ids: string[]): Promise<SearchOption[]> {
  if (!ids.length) return []
  const { items } = await listClasses(1, 200)
  return ids.map((id) => {
    const c = items.find((x) => x.classId === id)
    return { id, label: c?.name ?? 'Unknown class' }
  })
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    errors.value = {}
    const e = props.event
    form.title = e?.title ?? ''
    form.description = e?.description ?? ''
    form.type = e?.type ?? 'Workshop'
    form.startsAt = e ? toLocalInput(e.startsAt) : ''
    form.endsAt = e ? toLocalInput(e.endsAt) : ''
    form.location = e?.location ?? ''
    form.onlineUrl = e?.onlineUrl ?? ''
    form.capacity = e?.capacity ? String(e.capacity) : ''
    form.audience = e?.audience ?? 'Everyone'
    form.classes = []
    if (e?.classIds.length) {
      form.classes = await classOptions(e.classIds).catch(() => e.classIds.map((id) => ({ id, label: id })))
    }
  },
  { immediate: true },
)

async function submit() {
  errors.value = {}
  submitting.value = true
  const input = {
    title: form.title,
    description: form.description.trim() || null,
    type: form.type,
    startsAt: new Date(form.startsAt).toISOString(),
    endsAt: new Date(form.endsAt).toISOString(),
    location: form.location.trim() || null,
    onlineUrl: form.onlineUrl.trim() || null,
    capacity: form.capacity ? Number(form.capacity) : null,
    audience: form.audience,
    classIds: form.audience === 'Classes' ? form.classes.map((c) => c.id) : [],
  }
  try {
    const saved = props.event ? await updateEvent(props.event.id, input) : await createEvent(input)
    toast.success(props.event ? 'Event updated.' : 'Event created as a draft.')
    emit('saved', saved)
    emit('update:open', false)
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      errors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to save event.')
    }
  } finally {
    submitting.value = false
  }
}

const selectClass =
  'h-10 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle>{{ event ? 'Edit event' : 'New event' }}</DialogTitle>
        <DialogDescription>
          {{ event?.status === 'Published'
            ? 'Everyone who has RSVPed will be told about the change.'
            : 'Saved as a draft - learners see it once you publish.' }}
        </DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <Label for="ev-title">Title</Label>
          <Input id="ev-title" v-model="form.title" required maxlength="200" />
          <p v-for="msg in errors.Title" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        </div>
        <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <div class="flex flex-col gap-1.5">
            <Label for="ev-type">Type</Label>
            <select id="ev-type" v-model="form.type" :class="selectClass">
              <option v-for="t in EVENT_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="ev-capacity">Capacity (optional)</Label>
            <Input id="ev-capacity" v-model="form.capacity" type="number" min="1" placeholder="Unlimited" />
            <p v-for="msg in errors.Capacity" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <div class="flex flex-col gap-1.5">
            <Label for="ev-start">Starts</Label>
            <Input id="ev-start" v-model="form.startsAt" type="datetime-local" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="ev-end">Ends</Label>
            <Input id="ev-end" v-model="form.endsAt" type="datetime-local" required />
            <p v-for="msg in errors.EndsAt" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="ev-location">Location (optional)</Label>
          <Input id="ev-location" v-model="form.location" maxlength="300" placeholder="e.g. Main hall, Block B" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="ev-online">Online link (optional)</Label>
          <Input id="ev-online" v-model="form.onlineUrl" type="url" placeholder="https://" />
          <p v-for="msg in errors.OnlineUrl" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="ev-description">Description (optional)</Label>
          <textarea
            id="ev-description"
            v-model="form.description"
            rows="4"
            maxlength="8000"
            class="w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-2 text-sm text-(--fg-2) outline-none"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="ev-audience">Who can see it</Label>
          <select id="ev-audience" v-model="form.audience" :class="selectClass">
            <option value="Everyone">Everyone in the school</option>
            <option value="Classes">Only selected classes</option>
          </select>
          <SearchMultiSelect
            v-if="form.audience === 'Classes'"
            v-model="form.classes"
            :search="searchClasses"
            placeholder="Search classes…"
          />
          <p v-for="msg in errors.ClassIds" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" @click="emit('update:open', false)">Cancel</Button>
          <Button type="submit" :disabled="submitting || (form.audience === 'Classes' && !form.classes.length)">
            {{ submitting ? 'Saving…' : event ? 'Save changes' : 'Create draft' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
