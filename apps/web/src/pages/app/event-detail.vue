<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, CalendarPlus, Clock, Loader2, MapPin, Users, Video } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import { downloadEventIcs, EVENT_TYPE_LABELS, getEvent, rsvpToEvent, type EventDetail } from '@/api/scheduling'
import { formatRange } from '@/lib/datetime'

const route = useRoute()
const router = useRouter()

const event = ref<EventDetail | null>(null)
const status = ref<'loading' | 'idle' | 'error' | 'not-found'>('loading')
const saving = ref(false)
const actionError = ref<string | null>(null)

async function load() {
  status.value = 'loading'
  try {
    event.value = await getEvent(String(route.params.id))
    status.value = 'idle'
  } catch (e) {
    status.value = e instanceof ApiError && e.status === 404 ? 'not-found' : 'error'
  }
}
watch(() => route.params.id, load, { immediate: true })

const ended = computed(() => !!event.value && Date.parse(event.value.endsAt) <= Date.now())
const cancelled = computed(() => event.value?.status === 'Cancelled')
const canRsvp = computed(() => !!event.value && !cancelled.value && !ended.value)
const full = computed(() => {
  const e = event.value
  return !!e && e.capacity !== null && e.goingCount >= e.capacity
})

const seatsText = computed(() => {
  const e = event.value
  if (!e) return ''
  if (e.capacity === null) return `${e.goingCount} going`
  const left = Math.max(0, e.capacity - e.goingCount)
  return left > 0 ? `${left} of ${e.capacity} spots left` : `Full · ${e.waitlistCount} on the waitlist`
})

async function setRsvp(going: boolean) {
  if (!event.value) return
  saving.value = true
  actionError.value = null
  try {
    event.value = await rsvpToEvent(event.value.id, going)
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : "Couldn't update your RSVP."
  } finally {
    saving.value = false
  }
}

async function addToCalendar() {
  if (!event.value) return
  actionError.value = null
  try {
    await downloadEventIcs(event.value.id, event.value.title)
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : "Couldn't download the calendar file."
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-12 pb-12 max-w-[960px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <button class="self-start inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-[13px] font-medium text-(--fg-3) hover:text-(--fg-1)" @click="router.push('/app/events')">
      <ArrowLeft :size="16" /> All events
    </button>

    <div v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <div v-else-if="status !== 'idle' || !event" class="flex flex-col items-center gap-3 py-16 text-center">
      <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">{{ status === 'not-found' ? "This event doesn't exist or isn't open to you." : "Couldn't load this event." }}</p>
      <RaButton v-if="status === 'error'" variant="secondary" @click="load">Try again</RaButton>
    </div>

    <template v-else>
      <div v-if="cancelled" class="rounded-(--ra-lg) border border-(--danger) bg-(--danger-soft) px-5 py-4 text-sm text-(--danger)">
        <strong>This event has been cancelled.</strong>
        <span v-if="event.cancellationReason"> {{ event.cancellationReason }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-xs font-semibold text-(--fg-3) uppercase tracking-wide">{{ EVENT_TYPE_LABELS[event.type] }}</span>
        <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">{{ event.title }}</h1>
      </div>

      <div class="grid grid-cols-[1fr_320px] gap-6 items-start max-lg:grid-cols-1">
        <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
          <h2 class="m-0 mb-3 text-lg font-medium text-(--heading)">About this event</h2>
          <p v-if="event.description" class="m-0 text-sm leading-relaxed text-(--fg-2) whitespace-pre-line">{{ event.description }}</p>
          <p v-else class="m-0 text-sm text-(--fg-3)">No further details yet.</p>
        </section>

        <aside class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 flex flex-col gap-4 max-sm:p-4">
          <div class="flex gap-3 text-sm text-(--fg-2)">
            <Clock :size="18" class="shrink-0 text-(--fg-3) mt-0.5" />
            <span>{{ formatRange(event.startsAt, event.endsAt) }}</span>
          </div>
          <div v-if="event.location" class="flex gap-3 text-sm text-(--fg-2)">
            <MapPin :size="18" class="shrink-0 text-(--fg-3) mt-0.5" />
            <span>{{ event.location }}</span>
          </div>
          <div v-if="event.onlineUrl" class="flex gap-3 text-sm text-(--fg-2) min-w-0">
            <Video :size="18" class="shrink-0 text-(--fg-3) mt-0.5" />
            <a :href="event.onlineUrl" target="_blank" rel="noopener noreferrer" class="text-(--link) underline break-all">Join online</a>
          </div>
          <div class="flex gap-3 text-sm text-(--fg-2)">
            <Users :size="18" class="shrink-0 text-(--fg-3) mt-0.5" />
            <span>{{ seatsText }}</span>
          </div>

          <div class="h-px bg-(--line-1)" />

          <template v-if="canRsvp">
            <p v-if="event.myStatus === 'Going'" class="m-0 inline-flex items-center gap-1.5 text-sm font-medium text-(--success)">
              <span class="w-1.5 h-1.5 rounded-full bg-current" />You're going
            </p>
            <p v-else-if="event.myStatus === 'Waitlisted'" class="m-0 text-sm text-(--fg-2)">
              You're on the waitlist. We'll let you know if a spot opens up.
            </p>

            <RaButton v-if="!event.myStatus" :disabled="saving" class="w-full justify-center" @click="setRsvp(true)">
              <template v-if="saving" #icon><Loader2 :size="16" class="animate-spin" /></template>
              {{ full ? 'Join the waitlist' : "I'm going" }}
            </RaButton>
            <RaButton v-else variant="secondary" :disabled="saving" class="w-full justify-center" @click="setRsvp(false)">
              {{ event.myStatus === 'Going' ? "I can't make it" : 'Leave the waitlist' }}
            </RaButton>
          </template>
          <p v-else-if="ended && !cancelled" class="m-0 text-sm text-(--fg-3)">This event has ended.</p>

          <RaButton v-if="!cancelled && !ended" variant="ghost" class="w-full justify-center" @click="addToCalendar">
            <template #icon><CalendarPlus :size="16" /></template>
            Add to calendar
          </RaButton>

          <p v-if="actionError" class="m-0 text-[13px] text-(--danger)">{{ actionError }}</p>
        </aside>
      </div>
    </template>
  </div>
</template>
