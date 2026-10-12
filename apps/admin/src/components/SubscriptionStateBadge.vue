<script setup lang="ts">
import { computed } from 'vue'
import type { SubscriptionState } from '@/api/plans'

const props = defineProps<{
  state: SubscriptionState
  endsAt?: string | null
  lockedAt?: string | null
}>()

const DAY_MS = 24 * 60 * 60 * 1000

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS))
}

const label = computed(() => {
  switch (props.state) {
    case 'Expiring': {
      const days = daysUntil(props.endsAt)
      return days === null ? 'Expiring' : `Expires in ${days} day${days === 1 ? '' : 's'}`
    }
    case 'Grace': {
      const days = daysUntil(props.lockedAt)
      return days === null ? 'Grace period' : `Grace · ${days} day${days === 1 ? '' : 's'} left`
    }
    case 'Locked':
      return 'Locked'
    default:
      return 'Active'
  }
})

const toneClass = computed(() => {
  switch (props.state) {
    case 'Expiring':
      return 'text-(--warning) bg-(--warning-soft) border-(--warning)/30'
    case 'Grace':
      return 'text-(--warning) bg-(--warning-soft) border-(--warning)/50'
    case 'Locked':
      return 'text-(--danger) bg-(--danger-soft) border-(--danger)/40'
    default:
      return 'text-(--success) bg-(--success-soft) border-(--success)/30'
  }
})
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap rounded-(--ra-pill) border px-2.5 py-1 text-[11px] leading-none font-semibold"
    :class="toneClass"
  >
    {{ label }}
  </span>
</template>
