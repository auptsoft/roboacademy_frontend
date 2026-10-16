<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RaButton, formatMoney } from '@roboacademy/ui'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Loader2 } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { getMyEnrolments } from '@/api/learning'
import { getMyOrder, type MyOrder } from '@/api/payments'

// Where the payment provider sends the learner back after paying (?reference=…). The webhook
// usually confirms the payment first; polling the order also asks the provider directly, so a
// slow webhook doesn't keep anyone waiting. Enrolment follows the confirmation a moment later.

const POLL_EVERY_MS = 2000
const GIVE_UP_AFTER_MS = 60_000

const route = useRoute()
const router = useRouter()
// Paystack appends its own ?reference= (and trxref) to ours, so the key may repeat.
const rawReference = route.query.reference ?? route.query.trxref
const reference = String((Array.isArray(rawReference) ? rawReference[0] : rawReference) ?? '')

type Phase = 'checking' | 'enrolling' | 'ready' | 'failed' | 'slow' | 'not-found'
const phase = ref<Phase>(reference ? 'checking' : 'not-found')
const order = ref<MyOrder | null>(null)
const started = Date.now()
let timer: ReturnType<typeof setTimeout> | undefined

const amount = computed(() => order.value ? formatMoney(order.value.amountMinor, order.value.currency) : '')

function schedule() {
  if (Date.now() - started > GIVE_UP_AFTER_MS) {
    phase.value = 'slow'
    return
  }
  timer = setTimeout(poll, POLL_EVERY_MS)
}

async function poll() {
  try {
    if (phase.value === 'checking') {
      order.value = await getMyOrder(reference)
      if (order.value.status === 'Paid') {
        phase.value = 'enrolling'
      } else if (order.value.status === 'Failed' || order.value.status === 'Abandoned') {
        phase.value = 'failed'
        return
      }
    }

    if (phase.value === 'enrolling' && order.value) {
      const { data } = await getMyEnrolments()
      if (data.some((e) => e.courseId === order.value!.courseId && e.status !== 'Withdrawn')) {
        phase.value = 'ready'
        return
      }
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      phase.value = 'not-found'
      return
    }
    // A network blip: keep trying until the time limit.
  }
  schedule()
}

onMounted(() => {
  if (reference) void poll()
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="flex flex-col items-center gap-4 px-8 pt-24 pb-12 text-center max-w-(--content-max) mx-auto max-sm:px-4 max-sm:pt-12">
    <template v-if="phase === 'checking' || phase === 'enrolling'">
      <Loader2 :size="28" class="animate-spin text-(--fg-4)" />
      <h1 class="m-0 text-xl font-bold text-(--fg-1)">
        {{ phase === 'checking' ? 'Confirming your payment…' : 'Payment confirmed. Setting up your course…' }}
      </h1>
      <p class="m-0 max-w-96 text-sm text-(--fg-3)">This usually takes a few seconds. Please keep this page open.</p>
    </template>

    <template v-else-if="phase === 'ready' && order">
      <div class="w-12 h-12 rounded-full bg-(--success-soft) flex items-center justify-center text-(--success)"><CheckCircle2 :size="24" /></div>
      <h1 class="m-0 text-xl font-bold text-(--fg-1)">You're enrolled in {{ order.courseTitle }}</h1>
      <p class="m-0 max-w-96 text-sm text-(--fg-3)">You paid {{ amount }}. A receipt is on its way to your email.</p>
      <RaButton @click="router.push(`/app/courses/${order.courseId}`)">
        Start learning
        <template #icon-right><ArrowRight :size="14" /></template>
      </RaButton>
    </template>

    <template v-else-if="phase === 'failed' && order">
      <div class="w-12 h-12 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="24" /></div>
      <h1 class="m-0 text-xl font-bold text-(--fg-1)">The payment didn't go through</h1>
      <p class="m-0 max-w-96 text-sm text-(--fg-3)">You haven't been charged for {{ order.courseTitle }}. You can try again.</p>
      <RaButton @click="router.push(`/app/explore/courses/${order.courseId}`)">Back to the course</RaButton>
    </template>

    <template v-else-if="phase === 'slow'">
      <div class="w-12 h-12 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-3)"><Clock :size="24" /></div>
      <h1 class="m-0 text-xl font-bold text-(--fg-1)">Still confirming your payment</h1>
      <p class="m-0 max-w-96 text-sm text-(--fg-3)">
        It's taking longer than usual. If you paid, you'll be enrolled automatically and get a receipt by email.
        Your purchases are listed under Settings.
      </p>
      <RaButton variant="secondary" @click="router.push('/app/settings')">Go to Settings</RaButton>
    </template>

    <template v-else>
      <div class="w-12 h-12 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-3)"><AlertTriangle :size="24" /></div>
      <h1 class="m-0 text-xl font-bold text-(--fg-1)">We couldn't find that payment</h1>
      <p class="m-0 max-w-96 text-sm text-(--fg-3)">If you paid, check Settings for your purchases, or try the course again.</p>
      <RaButton variant="secondary" @click="router.push('/app/explore')">Back to Explore</RaButton>
    </template>
  </div>
</template>
