<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Timer } from 'lucide-vue-next'

/**
 * The countdown for a timed attempt, from the server's deadline. The device's clock may be off,
 * so it's corrected by the gap between the server's time (serverNow) and the device's when the
 * attempt was loaded. Warns at 5 and 1 minutes (announced to screen readers), turns red in the
 * last minute, and emits `expired` once at zero.
 */
const props = defineProps<{ expiresAt: string; serverNow: string }>()
const emit = defineEmits<{ expired: [] }>()

const offsetMs = ref(Date.parse(props.serverNow) - Date.now())
const nowMs = ref(Date.now())
const announcement = ref('')
let timer: ReturnType<typeof setInterval> | undefined
let expired = false

watch(() => props.serverNow, (serverNow) => (offsetMs.value = Date.parse(serverNow) - Date.now()))

const remainingMs = computed(() => Math.max(0, Date.parse(props.expiresAt) - (nowMs.value + offsetMs.value)))
const label = computed(() => {
  const total = Math.ceil(remainingMs.value / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
})
const urgent = computed(() => remainingMs.value <= 60_000)

watch(remainingMs, (left, before) => {
  if (before > 5 * 60_000 && left <= 5 * 60_000 && left > 60_000) announcement.value = '5 minutes left.'
  if (before > 60_000 && left <= 60_000 && left > 0) announcement.value = '1 minute left.'
  if (left === 0 && !expired) {
    expired = true
    announcement.value = "Time's up."
    emit('expired')
  }
})

onMounted(() => {
  timer = setInterval(() => (nowMs.value = Date.now()), 1000)
  if (remainingMs.value === 0 && !expired) {
    expired = true
    emit('expired')
  }
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div
    class="sticky top-0 z-10 mb-5 flex items-center gap-2 rounded-(--ra-md) border px-3.5 py-2 text-sm font-semibold backdrop-blur"
    :class="urgent ? 'border-(--danger) bg-(--danger-soft) text-(--danger)' : 'border-(--line-2) bg-(--bg-2)/90 text-(--fg-1)'"
    role="timer"
    :aria-label="`Time left: ${label}`"
  >
    <Timer :size="15" />
    <span class="tabular-nums">{{ label }}</span>
    <span class="text-xs font-normal" :class="urgent ? 'text-(--danger)' : 'text-(--fg-3)'">left</span>
    <span class="sr-only" aria-live="assertive">{{ announcement }}</span>
  </div>
</template>
