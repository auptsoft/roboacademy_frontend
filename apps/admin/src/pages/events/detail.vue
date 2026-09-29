<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { ArrowLeft, Download } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import EventFormDialog from '@/components/EventFormDialog.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import {
  cancelEvent,
  eventTypeLabel,
  getEvent,
  listEventAttendees,
  publishEvent,
  setAttendeeCheckIn,
  type EventAttendee,
  type EventDetail,
} from '@/api/scheduling'

const route = useRoute()
const router = useRouter()
const eventId = computed(() => String(route.params.eventId))

const event = ref<EventDetail | null>(null)
const attendees = ref<EventAttendee[]>([])
const loading = ref(true)
const notFound = ref(false)

async function load() {
  loading.value = true
  try {
    const [detail, roster] = await Promise.all([getEvent(eventId.value), listEventAttendees(eventId.value)])
    event.value = detail
    attendees.value = roster
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound.value = true
    else toast.error(error instanceof ApiError ? error.message : 'Failed to load event.')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const ended = computed(() => !!event.value && Date.parse(event.value.endsAt) <= Date.now())
const going = computed(() => attendees.value.filter((a) => a.status === 'Going'))
const waiting = computed(() => attendees.value.filter((a) => a.status === 'Waitlisted'))
const checkedInCount = computed(() => going.value.filter((a) => a.checkedInAt).length)

// --- Edit ---
const editOpen = ref(false)

function onSaved(saved: EventDetail) {
  event.value = saved
  void load()
}

// --- Publish ---
const publishing = ref(false)

async function submitPublish() {
  if (!event.value) return
  if (!window.confirm(`Publish "${event.value.title}"? Its audience will be notified.`)) return
  publishing.value = true
  try {
    event.value = await publishEvent(event.value.id)
    toast.success('Event published.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to publish event.')
  } finally {
    publishing.value = false
  }
}

// --- Cancel ---
const cancelOpen = ref(false)
const cancelReason = ref('')
const cancelling = ref(false)

async function submitCancel() {
  if (!event.value) return
  cancelling.value = true
  try {
    event.value = await cancelEvent(event.value.id, cancelReason.value.trim() || null)
    toast.success('Event cancelled.')
    cancelOpen.value = false
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to cancel event.')
  } finally {
    cancelling.value = false
  }
}

// --- Check-in ---
async function toggleCheckIn(attendee: EventAttendee) {
  const next = !attendee.checkedInAt
  try {
    await setAttendeeCheckIn(eventId.value, attendee.userId, next)
    attendee.checkedInAt = next ? new Date().toISOString() : null
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to update check-in.')
  }
}

// --- CSV export ---
function csvCell(value: string): string {
  // Quote everything; neutralise spreadsheet formula injection from user-controlled names.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

function exportCsv() {
  if (!event.value) return
  const rows = [
    ['Name', 'Email', 'Status', 'Responded', 'Checked in'],
    ...attendees.value.map((a) => [
      a.fullName, a.email, a.status, new Date(a.respondedAt).toLocaleString(),
      a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : '',
    ]),
  ]
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${event.value.title.replace(/[^\w\- ]+/g, '').trim() || 'event'} attendees.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function statusTone(status: EventDetail['status']) {
  return status === 'Published' ? 'info' : status === 'Cancelled' ? 'admin' : 'neutral'
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-6 pt-8 px-8 pb-16 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <button class="self-start inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-[13px] text-(--fg-3) hover:text-(--fg-1)" @click="router.push('/events')">
      <ArrowLeft :size="14" /> Events
    </button>

    <p v-if="loading && !event" class="p-6 text-center text-[13px] text-(--fg-3)">Loading event…</p>

    <RaCard v-else-if="notFound" class="p-10 text-center">
      <p class="m-0 text-sm text-(--fg-3)">Event not found.</p>
    </RaCard>

    <template v-else-if="event">
      <div class="flex items-start justify-between gap-4 max-md:flex-col max-md:items-stretch">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">{{ event.title }}</h1>
            <RaChip :tone="statusTone(event.status)">{{ event.status }}</RaChip>
            <RaChip tone="neutral">{{ eventTypeLabel(event.type) }}</RaChip>
          </div>
          <p class="mt-1.5 text-sm text-(--fg-3)">
            {{ formatDate(event.startsAt) }} – {{ formatDate(event.endsAt) }}
            <template v-if="ended"> · Ended</template>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button v-if="event.status !== 'Cancelled'" variant="outline" @click="editOpen = true">Edit</Button>
          <Button v-if="event.status === 'Draft'" :disabled="publishing || ended" @click="submitPublish">
            {{ publishing ? 'Publishing…' : 'Publish' }}
          </Button>
          <Button v-if="event.status !== 'Cancelled' && !ended" variant="destructive" @click="cancelReason = ''; cancelOpen = true">
            Cancel event
          </Button>
        </div>
      </div>

      <div v-if="event.status === 'Cancelled'" class="rounded-(--ra-md) border border-(--danger) px-4 py-3 text-sm text-(--danger)">
        Cancelled<template v-if="event.cancellationReason">: {{ event.cancellationReason }}</template>
      </div>

      <div class="grid grid-cols-[1fr_320px] gap-6 items-start max-lg:grid-cols-1">
        <RaCard class="flex flex-col gap-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="m-0 text-base font-semibold text-(--fg-1)">
              Attendees
              <span class="ml-1 text-sm font-normal text-(--fg-3)">
                {{ going.length }} going<template v-if="event.capacity"> of {{ event.capacity }}</template>
                <template v-if="waiting.length"> · {{ waiting.length }} waitlisted</template>
                <template v-if="going.length"> · {{ checkedInCount }} checked in</template>
              </span>
            </h2>
            <Button variant="outline" size="sm" :disabled="!attendees.length" @click="exportCsv">
              <Download :size="14" /> Export CSV
            </Button>
          </div>

          <p v-if="!attendees.length" class="m-0 py-6 text-center text-[13px] text-(--fg-3)">
            {{ event.status === 'Draft' ? 'Publish the event to start taking RSVPs.' : 'No RSVPs yet.' }}
          </p>
          <div v-else class="flex flex-col">
            <div class="grid grid-cols-[2fr_2fr_110px_110px] border-b border-(--line-1) pb-2 text-xs text-(--fg-3) max-md:hidden">
              <span>Name</span><span>Email</span><span>Status</span><span class="text-right">Check-in</span>
            </div>
            <div
              v-for="a in attendees"
              :key="a.userId"
              class="grid grid-cols-[2fr_2fr_110px_110px] items-center py-2.5 border-b border-(--line-1) last:border-b-0 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-1"
            >
              <span class="text-sm font-medium text-(--fg-1)">{{ a.fullName }}</span>
              <span class="text-sm text-(--fg-3) truncate">{{ a.email }}</span>
              <span><RaChip :tone="a.status === 'Going' ? 'student' : 'neutral'">{{ a.status }}</RaChip></span>
              <span class="flex justify-end max-md:justify-start">
                <label v-if="a.status === 'Going'" class="inline-flex items-center gap-2 text-sm text-(--fg-2) cursor-pointer">
                  <input type="checkbox" class="size-4" :checked="!!a.checkedInAt" @change="toggleCheckIn(a)" />
                  {{ a.checkedInAt ? 'In' : '—' }}
                </label>
              </span>
            </div>
          </div>
        </RaCard>

        <RaCard class="flex flex-col gap-3 text-sm">
          <h2 class="m-0 text-base font-semibold text-(--fg-1)">Details</h2>
          <div><span class="text-(--fg-3)">Audience:</span> {{ event.audience === 'Everyone' ? 'Everyone in the school' : `${event.classIds.length} class(es)` }}</div>
          <div v-if="event.location"><span class="text-(--fg-3)">Location:</span> {{ event.location }}</div>
          <div v-if="event.onlineUrl" class="break-all">
            <span class="text-(--fg-3)">Online:</span> <a :href="event.onlineUrl" target="_blank" rel="noopener noreferrer" class="underline">{{ event.onlineUrl }}</a>
          </div>
          <div><span class="text-(--fg-3)">Capacity:</span> {{ event.capacity ?? 'Unlimited' }}</div>
          <div v-if="event.publishedAt"><span class="text-(--fg-3)">Published:</span> {{ formatDate(event.publishedAt) }}</div>
          <p v-if="event.description" class="m-0 whitespace-pre-line text-(--fg-2)">{{ event.description }}</p>
        </RaCard>
      </div>
    </template>

    <EventFormDialog v-model:open="editOpen" :event="event" @saved="onSaved" />

    <Dialog v-model:open="cancelOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel event</DialogTitle>
          <DialogDescription>
            {{ event?.status === 'Published' ? 'Everyone who RSVPed will be notified. This can’t be undone.' : 'The draft will be marked cancelled.' }}
          </DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitCancel">
          <div class="flex flex-col gap-1.5">
            <Label for="ev-cancel-reason">Reason (optional, shown to attendees)</Label>
            <Input id="ev-cancel-reason" v-model="cancelReason" maxlength="500" />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="cancelOpen = false">Keep event</Button>
            <Button variant="destructive" type="submit" :disabled="cancelling">{{ cancelling ? 'Cancelling…' : 'Cancel event' }}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
