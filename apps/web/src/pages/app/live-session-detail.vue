<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowLeft, CalendarClock, Users } from 'lucide-vue-next'
import { RaCard, RaChip, RaButton, formatDate } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import {
  getLiveClass, bookLiveClass, cancelLiveClassBooking,
  type LiveClassDetail, type LiveClassStatus,
} from '@/api/learning'
import LiveClassFrame from '@/components/live/LiveClassFrame.vue'

const route = useRoute()
const liveClassId = computed(() => String(route.params.id))

const liveClass = ref<LiveClassDetail | null>(null)
const loadState = ref<'loading' | 'idle' | 'error'>('loading')
const loadError = ref('')
const actionState = ref<'idle' | 'saving'>('idle')
const actionError = ref('')
const joined = ref(false)

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

async function load() {
  loadState.value = 'loading'
  loadError.value = ''
  try {
    liveClass.value = await getLiveClass(liveClassId.value)
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

      <LiveClassFrame
        v-if="joined"
        :live-class-id="liveClass.id"
        height="min(70vh, 620px)"
        class="live-detail__frame"
      />

      <RaCard v-else :padding="28" class="live-detail__panel">
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

        <template v-else-if="liveClass.status === 'Live'">
          <div class="live-detail__panel-title">This class is live now</div>
          <RaButton class="mt-3" @click="joined = true">Join session</RaButton>
        </template>

        <template v-else-if="liveClass.status === 'Scheduled'">
          <div class="live-detail__panel-title">Your seat is booked</div>
          <p class="live-detail__note">Joining opens when the instructor starts the class.</p>
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

.live-detail__frame,
.live-detail__panel {
  margin-top: 24px;
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
