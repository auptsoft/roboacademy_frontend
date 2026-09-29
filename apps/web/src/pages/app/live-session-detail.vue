<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowLeft, CalendarClock, Check, Copy, ExternalLink, Users } from 'lucide-vue-next'
import { RaCard, RaChip, RaButton, formatDate } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import {
  getLiveClass, bookLiveClass, cancelLiveClassBooking, joinLiveClass,
  type LiveClassDetail, type LiveClassMeeting, type LiveClassStatus,
} from '@/api/learning'

const route = useRoute()
const liveClassId = computed(() => String(route.params.id))

const liveClass = ref<LiveClassDetail | null>(null)
const loadState = ref<'loading' | 'idle' | 'error'>('loading')
const loadError = ref('')
const actionState = ref<'idle' | 'saving'>('idle')
const actionError = ref('')
// The class runs in an external tool (Zoom, Meet, ...). Its details are fetched as soon as the
// class is joinable, so "Open meeting" is a plain user gesture that pop-up blockers allow.
const meeting = ref<LiveClassMeeting | null>(null)
const meetingError = ref('')
const codeCopied = ref(false)

const statusTone: Record<LiveClassStatus, 'admin' | 'info' | 'neutral'> = {
  Live: 'admin',
  Scheduled: 'info',
  Ended: 'neutral',
  Cancelled: 'neutral',
}

const isFull = computed(() => {
  const item = liveClass.value
  return !!item && item.capacity !== null && item.bookedCount >= item.capacity
})

const seatsLabel = computed(() => {
  const item = liveClass.value
  if (!item) return ''
  return item.capacity === null ? `${item.bookedCount} booked` : `${item.bookedCount} / ${item.capacity} booked`
})

async function loadMeeting() {
  meeting.value = null
  meetingError.value = ''
  const item = liveClass.value
  if (!item?.isJoinable || !item.isCallerBooked) return
  try {
    meeting.value = await joinLiveClass(item.id)
  } catch (err) {
    meetingError.value = err instanceof ApiError ? err.message : 'The meeting details could not be loaded.'
  }
}

function openMeeting() {
  if (meeting.value?.meetingUrl) window.open(meeting.value.meetingUrl, '_blank', 'noopener,noreferrer')
}

async function copyCode() {
  if (!meeting.value?.meetingCode) return
  try {
    await navigator.clipboard.writeText(meeting.value.meetingCode)
    codeCopied.value = true
    setTimeout(() => { codeCopied.value = false }, 2000)
  } catch {
    // Clipboard can be unavailable (permissions, insecure context) - the code stays on screen.
  }
}

async function load() {
  loadState.value = 'loading'
  loadError.value = ''
  try {
    liveClass.value = await getLiveClass(liveClassId.value)
    await loadMeeting()
    loadState.value = 'idle'
  } catch (err) {
    loadState.value = 'error'
    loadError.value = err instanceof ApiError ? err.message : 'This live class could not be loaded.'
  }
}
onMounted(load)

async function run(action: (id: string) => Promise<unknown>) {
  actionState.value = 'saving'
  actionError.value = ''
  try {
    await action(liveClassId.value)
    // Re-read rather than patching locally: bookedCount and isCallerBooked both move.
    liveClass.value = await getLiveClass(liveClassId.value)
    await loadMeeting()
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  } finally {
    actionState.value = 'idle'
  }
}
</script>

<template>
  <div class="live-detail">
    <RouterLink to="/app/live-sessions" class="live-detail__back">
      <ArrowLeft :size="14" />
      <span>Live Sessions</span>
    </RouterLink>

    <p v-if="loadState === 'loading'" class="live-detail__note">Loading&hellip;</p>
    <p v-else-if="loadState === 'error'" class="live-detail__note">{{ loadError }}</p>

    <template v-else-if="liveClass">
      <div class="live-detail__heading">
        <RaChip :tone="statusTone[liveClass.status]">{{ liveClass.status }}</RaChip>
        <RaChip v-if="liveClass.isCallerBooked" tone="student">Booked</RaChip>
      </div>

      <h1 class="live-detail__title">{{ liveClass.title }}</h1>

      <p class="live-detail__meta">
        <CalendarClock :size="14" />
        <span>{{ formatDate(liveClass.scheduledStart) }} &ndash; {{ formatDate(liveClass.scheduledEnd) }}</span>
        <span class="live-detail__dot">&middot;</span>
        <Users :size="14" />
        <span>{{ seatsLabel }}</span>
      </p>

      <RaCard :padding="28" class="live-detail__panel">
        <template v-if="!liveClass.isCallerBooked">
          <div class="live-detail__panel-title">
            {{ isFull ? 'This session is full' : 'You have not booked this session' }}
          </div>
          <p class="live-detail__note">
            {{ isFull ? 'All seats are taken. Check back in case one frees up.' : 'Book a seat to join when the class goes live.' }}
          </p>
          <RaButton
            v-if="!isFull && liveClass.status === 'Scheduled'"
            class="mt-3"
            :disabled="actionState === 'saving'"
            @click="run(bookLiveClass)"
          >
            {{ actionState === 'saving' ? 'Booking…' : 'Book a seat' }}
          </RaButton>
        </template>

        <template v-else-if="liveClass.isJoinable">
          <div class="live-detail__panel-title">
            {{ liveClass.status === 'Live' ? 'This class is live now' : 'This class is about to start' }}
          </div>
          <p class="live-detail__note">The class runs in an external meeting app, which opens in a new tab.</p>

          <p v-if="meetingError" class="live-detail__error">{{ meetingError }}</p>
          <div v-else-if="meeting" class="live-detail__meeting">
            <RaButton v-if="meeting.meetingUrl" @click="openMeeting">
              <template #icon><ExternalLink :size="14" /></template>
              Open meeting
            </RaButton>
            <a
              v-if="meeting.meetingUrl"
              :href="meeting.meetingUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="live-detail__link"
            >{{ meeting.meetingUrl }}</a>

            <div v-if="meeting.meetingCode" class="live-detail__code">
              <span class="live-detail__code-label">Meeting ID / passcode</span>
              <code>{{ meeting.meetingCode }}</code>
              <RaButton variant="ghost" @click="copyCode">
                <template #icon><Check v-if="codeCopied" :size="14" /><Copy v-else :size="14" /></template>
                {{ codeCopied ? 'Copied' : 'Copy' }}
              </RaButton>
            </div>

            <p v-if="meeting.meetingNotes" class="live-detail__notes">{{ meeting.meetingNotes }}</p>
          </div>
          <p v-else class="live-detail__note">Loading meeting details&hellip;</p>
        </template>

        <template v-else-if="liveClass.status === 'Scheduled'">
          <div class="live-detail__panel-title">Your seat is booked</div>
          <p class="live-detail__note">
            <template v-if="liveClass.hasMeetingDetails">
              The meeting link will appear here from {{ formatDate(liveClass.joinOpensAt) }}.
            </template>
            <template v-else>The instructor will share the meeting link before the class starts.</template>
          </p>
          <RaButton
            variant="secondary"
            class="mt-3"
            :disabled="actionState === 'saving'"
            @click="run(cancelLiveClassBooking)"
          >
            {{ actionState === 'saving' ? 'Cancelling…' : 'Cancel booking' }}
          </RaButton>
        </template>

        <template v-else>
          <div class="live-detail__panel-title">
            {{ liveClass.status === 'Cancelled' ? 'This class was cancelled' : 'This class has ended' }}
          </div>
        </template>

        <p v-if="actionError" class="live-detail__error">{{ actionError }}</p>
      </RaCard>
    </template>
  </div>
</template>

<style scoped>
.live-detail {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.live-detail__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--fg-3);
  text-decoration: none;
}

.live-detail__back:hover {
  color: var(--fg-2);
}

.live-detail__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}

.live-detail__title {
  margin: 12px 0 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--fg-1);
}

.live-detail__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--fg-3);
}

.live-detail__dot {
  opacity: 0.6;
}

.live-detail__panel {
  margin-top: 24px;
}

.live-detail__meeting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.live-detail__link {
  max-width: 100%;
  font-size: 13px;
  color: var(--link);
  text-decoration: underline;
  overflow-wrap: anywhere;
}

.live-detail__code {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  color: var(--fg-2);
}

.live-detail__code-label {
  color: var(--fg-3);
}

.live-detail__code code {
  font-family: var(--font-mono, monospace);
  font-size: 14px;
  color: var(--fg-1);
}

.live-detail__notes {
  max-width: 520px;
  margin: 0;
  font-size: 13px;
  color: var(--fg-2);
  white-space: pre-line;
  text-align: left;
}

.live-detail__panel {
  text-align: center;
}

.live-detail__panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg-1);
}

.live-detail__note {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--fg-3);
}

.live-detail__error {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--danger);
}

.mt-3 {
  margin-top: 12px;
}
</style>
