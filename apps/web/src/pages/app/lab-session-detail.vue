<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Bot, Loader2 } from 'lucide-vue-next'
import { RaButton, RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import { getLabSession, requestLabSession, withdrawLabSession, type LabSession } from '@/api/robotics-lab'
import LabSessionFrame from '@/components/lab/LabSessionFrame.vue'

/**
 * One robot lab session. Before it starts: ask for it, or see where your request stands. During
 * its window (from 5 minutes early): the assigned learner joins botnova's control screen here.
 * Botnova ends the session on time; the countdown is only a guide.
 */
const JOIN_EARLY_MS = 5 * 60_000

const route = useRoute()
const router = useRouter()
const session = ref<LabSession | null>(null)
const status = ref<'loading' | 'idle' | 'error'>('loading')
const busy = ref(false)
const actionError = ref('')
const message = ref('')
const joined = ref(false)
const endedReason = ref<string | null>(null)
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined

const labSessionId = computed(() => String(route.params.id))

async function load() {
  status.value = 'loading'
  try {
    session.value = await getLabSession(labSessionId.value)
    status.value = 'idle'
  } catch {
    status.value = 'error'
  }
}

const startsAt = computed(() => (session.value ? new Date(session.value.startsAt).getTime() : 0))
const endsAt = computed(() => (session.value ? new Date(session.value.endsAt).getTime() : 0))
const canJoin = computed(() =>
  !!session.value?.assignedToMe && ['Assigned', 'Provisioned', 'InProgress'].includes(session.value.status)
  && now.value >= startsAt.value - JOIN_EARLY_MS && now.value < endsAt.value)
const beforeWindow = computed(() => now.value < startsAt.value - JOIN_EARLY_MS)
const canRequest = computed(() =>
  !!session.value && !session.value.assignedToMe && now.value < startsAt.value
  && ['Open', 'Assigned', 'Provisioned'].includes(session.value.status)
  && !['Pending', 'Waitlisted'].includes(session.value.myRequestStatus ?? ''))
const canWithdraw = computed(() =>
  !!session.value && now.value < startsAt.value
  && (session.value.assignedToMe || ['Pending', 'Waitlisted'].includes(session.value.myRequestStatus ?? '')))

function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, '0')}`
}

const timeLabel = computed(() => {
  if (!session.value) return ''
  if (now.value < startsAt.value) return `Starts in ${duration(startsAt.value - now.value)}`
  if (now.value < endsAt.value) return `${duration(endsAt.value - now.value)} left`
  return 'Finished'
})

const standing = computed(() => {
  const s = session.value
  if (!s) return null
  if (s.assignedToMe) return s.status === 'Ended' ? (s.attended ? 'You attended this session.' : 'You missed this session.') : 'This session is yours.'
  switch (s.myRequestStatus) {
    case 'Pending': return 'You asked for this session. Staff will let you know.'
    case 'Waitlisted': return "Someone else has this session. You're on the waitlist in case they drop out."
    case 'Declined': return "Your request wasn't approved."
    case 'Expired': return 'The session started before your request was approved.'
    default: return null
  }
})

async function act(action: () => Promise<LabSession>) {
  busy.value = true
  actionError.value = ''
  try {
    session.value = await action()
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
  } finally {
    busy.value = false
  }
}

function onEnded(reason: string) {
  endedReason.value = reason
  joined.value = false
  void load()
}

watch(labSessionId, load)
onMounted(() => {
  void load()
  ticker = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(ticker))
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-10 pb-12 max-w-[1100px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <RouterLink to="/app/lab-sessions" class="inline-flex items-center gap-1 text-xs text-(--fg-3) no-underline">
      <ArrowLeft :size="14" /> Robot lab
    </RouterLink>

    <div v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <RaCard v-else-if="status === 'error' || !session" :padding="28" class="text-center">
      <p class="m-0 text-sm text-(--fg-2)">This robot lab session isn't available.</p>
      <RaButton variant="secondary" class="mt-3" @click="router.push('/app/lab-sessions')">Back to the robot lab</RaButton>
    </RaCard>

    <template v-else>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h1 class="m-0 text-[26px] font-semibold text-(--heading) tracking-[-0.01em]">{{ session.title }}</h1>
          <p class="mt-1.5 mb-0 text-sm text-(--fg-3)">
            {{ formatDate(session.startsAt) }} ·
            {{ new Date(session.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}–{{ new Date(session.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
            · {{ session.templateName }}
          </p>
        </div>
        <RaChip :tone="canJoin ? 'student' : 'neutral'">{{ timeLabel }}</RaChip>
      </div>

      <p v-if="session.description" class="m-0 text-sm text-(--fg-2) leading-relaxed">{{ session.description }}</p>

      <LabSessionFrame v-if="joined" :lab-session-id="session.id" height="min(78vh, 720px)" @ended="onEnded" />

      <RaCard v-else :padding="24" class="flex flex-col items-start gap-3">
        <div class="flex items-center gap-2 text-sm font-semibold text-(--fg-1)"><Bot :size="16" /> {{ standing ?? 'Want time on this robot?' }}</div>
        <p v-if="endedReason" class="m-0 text-[13px] text-(--fg-3)">The session has ended.</p>
        <p v-if="!session.meetsRequirement && !session.assignedToMe" class="m-0 text-[13px] text-(--fg-3)">
          You need to pass this session's simulation lesson before you can ask for it.
        </p>

        <template v-if="canJoin">
          <RaButton @click="joined = true">Join the robot lab</RaButton>
        </template>
        <p v-else-if="session.assignedToMe && beforeWindow" class="m-0 text-[13px] text-(--fg-3)">
          You can join from 5 minutes before the start.
        </p>

        <template v-if="canRequest && session.meetsRequirement">
          <textarea
            v-model="message"
            rows="2"
            maxlength="1000"
            placeholder="Anything staff should know? (optional)"
            class="w-full max-w-120 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) p-2 text-sm text-(--fg-1)"
          />
          <RaButton :disabled="busy" @click="act(() => requestLabSession(session!.id, message.trim() || null))">Ask for this session</RaButton>
        </template>
        <RaButton v-if="canWithdraw" variant="ghost" :disabled="busy" @click="act(() => withdrawLabSession(session!.id))">
          {{ session.assignedToMe ? 'Give up this session' : 'Withdraw my request' }}
        </RaButton>
        <p v-if="actionError" class="m-0 text-xs text-(--danger)">{{ actionError }}</p>
      </RaCard>
    </template>
  </div>
</template>
