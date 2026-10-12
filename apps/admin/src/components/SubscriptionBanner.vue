<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarClock } from 'lucide-vue-next'
import { formatDate } from '@roboacademy/ui'
import { Button } from '@/components/ui/button'
import { getTenantId } from '@/api/client'
import { getMySubscriptionStatus, type SubscriptionStatus } from '@/api/plans'
import { hasPermission } from '@/store/auth'
import { getEnv } from '@/lib/runtime-env'

const PLATFORM_TENANT_ID = getEnv('VITE_PLATFORM_TENANT_ID')

const router = useRouter()
const tenantId = getTenantId()
// School admins of the active tenant (and platform admins viewing one) - the people who can act
// on a renewal. Teachers don't need the worry; the platform tenant never expires.
const visibleToCaller = hasPermission('tenancy:manage-own') && tenantId !== PLATFORM_TENANT_ID

const status = ref<SubscriptionStatus | null>(null)

onMounted(async () => {
  if (!visibleToCaller) return
  try {
    status.value = await getMySubscriptionStatus()
  } catch {
    // A banner is a courtesy - never surface an error for it.
  }
})

const DAY_MS = 24 * 60 * 60 * 1000
function daysUntil(iso: string | null): number {
  return iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS)) : 0
}

const message = computed(() => {
  const s = status.value
  if (!s) return null
  if (s.state === 'Expiring' && s.endsAt) {
    const days = daysUntil(s.endsAt)
    return `Your ${s.planName} plan expires on ${formatDate(s.endsAt)} (${days} day${days === 1 ? '' : 's'}). Renew to avoid any interruption.`
  }
  if (s.state === 'Grace' && s.lockedAt && s.endsAt) {
    const days = daysUntil(s.lockedAt)
    return `Your subscription expired on ${formatDate(s.endsAt)}. Access for teachers and students ends on ${formatDate(s.lockedAt)} — ${days} day${days === 1 ? '' : 's'} left.`
  }
  return null
})

const urgent = computed(() => status.value?.state === 'Grace')
</script>

<template>
  <div
    v-if="message"
    role="status"
    class="flex shrink-0 items-center justify-between gap-3 border-b px-8 py-2 max-md:flex-col max-md:items-start max-md:px-4"
    :class="urgent ? 'border-(--danger)/30 bg-(--danger-soft)' : 'border-(--warning)/30 bg-(--warning-soft)'"
  >
    <span class="flex items-center gap-2 text-[13px] font-medium" :class="urgent ? 'text-(--danger)' : 'text-(--fg-1)'">
      <CalendarClock :size="14" class="shrink-0" />
      {{ message }}
    </span>
    <Button variant="outline" size="sm" @click="router.push(`/tenants/${tenantId}#plan`)">View plan</Button>
  </div>
</template>
