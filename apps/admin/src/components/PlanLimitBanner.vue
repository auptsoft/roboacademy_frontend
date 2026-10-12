<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import type { LimitUsage, PlanEnforcementMode } from '@/api/plans'
import { limitNoun } from '@/lib/plan-errors'

const props = defineProps<{
  limits: LimitUsage[]
  enforcementMode?: PlanEnforcementMode
  // Restrict to the limits relevant to the current page; all when omitted.
  keys?: string[]
}>()

const shown = computed(() => props.limits.filter((l) => !props.keys || props.keys.includes(l.key)))
const anyOver = computed(() => shown.value.some((l) => l.overLimit))

function describe(limit: LimitUsage): string {
  const cap = limit.limit ?? 0
  const noun = limitNoun(limit.key, cap)
  return limit.overLimit
    ? `${limit.used.toLocaleString()} of ${cap.toLocaleString()} ${noun} — over your plan`
    : `${limit.used.toLocaleString()} of ${cap.toLocaleString()} ${noun} used`
}
</script>

<template>
  <div
    v-if="shown.length > 0"
    role="status"
    class="flex items-start gap-3 rounded-(--ra-md) border px-4 py-3 text-sm"
    :class="anyOver ? 'border-(--danger)/40 bg-(--danger-soft) text-(--fg-1)' : 'border-(--warning)/40 bg-(--warning-soft) text-(--fg-1)'"
  >
    <AlertTriangle :size="16" class="mt-0.5 shrink-0" :class="anyOver ? 'text-(--danger)' : 'text-(--warning)'" />
    <div class="flex flex-col gap-0.5">
      <p class="m-0 font-semibold">
        {{ enforcementMode === 'Hard' ? 'Plan limit reached' : 'Your school is at or over its plan limits' }}
      </p>
      <p class="m-0 text-(--fg-2)">
        {{ shown.map(describe).join(' · ') }}.
        {{ enforcementMode === 'Hard'
          ? 'New items of these kinds can’t be added until space is freed or the plan is upgraded.'
          : 'You can keep adding for now — contact RoboAcademy to upgrade.' }}
      </p>
    </div>
  </div>
</template>
