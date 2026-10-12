<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import SubscriptionStateBadge from '@/components/SubscriptionStateBadge.vue'
import { ApiError } from '@/api/client'
import {
  getTenantSubscription,
  getTenantUsage,
  getPlanCatalog,
  listPlans,
  assignTenantSubscription,
  endTenantSubscription,
  setTenantOverrides,
  type Plan,
  type PlanCatalog,
  type TenantSubscription,
  type TenantUsage,
  type LimitUsage,
} from '@/api/plans'
import { hasPermission } from '@/store/auth'
import { dueDateToIso, isoToDueDate } from '@/lib/pickers'

const props = defineProps<{
  tenantId: string
  isPlatformTenant: boolean
}>()

const emit = defineEmits<{ changed: [] }>()

const open = defineModel<boolean>('open', { default: false })

const canManagePlans = hasPermission('tenancy:plans:manage')

const subscription = ref<TenantSubscription | null>(null)
const usage = ref<TenantUsage | null>(null)
const catalog = ref<PlanCatalog | null>(null)
const plans = ref<Plan[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const [loadedSubscription, loadedUsage, loadedCatalog, loadedPlans] = await Promise.all([
      getTenantSubscription(props.tenantId),
      getTenantUsage(props.tenantId),
      catalog.value ?? getPlanCatalog(),
      canManagePlans ? listPlans(false) : Promise.resolve([] as Plan[]),
    ])
    subscription.value = loadedSubscription
    usage.value = loadedUsage
    catalog.value = loadedCatalog
    plans.value = loadedPlans
    fillForms()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load plan details.')
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.tenantId, load)

const entitlements = computed(() => subscription.value?.entitlements ?? null)

function featureLabel(key: string): string {
  return catalog.value?.features.find((f) => f.key === key)?.label ?? key
}

const disabledFeatures = computed(() =>
  Object.entries(entitlements.value?.features ?? {})
    .filter(([, enabled]) => !enabled)
    .map(([key]) => featureLabel(key)),
)

function usagePercent(limit: LimitUsage): number {
  if (limit.limit === null) return 0
  if (limit.limit === 0) return limit.used > 0 ? 100 : 0
  return Math.min(100, Math.round((limit.used / limit.limit) * 100))
}

function usageBarClass(limit: LimitUsage): string {
  if (limit.overLimit) return 'bg-(--danger)'
  if (limit.atLimit || usagePercent(limit) >= 90) return 'bg-(--warning)'
  return 'bg-(--primary)'
}

// --- Assign / renew ---
const assignForm = reactive({
  planId: '',
  endsAt: '',
  noEndDate: true,
  graceDaysOverride: '',
  notes: '',
})
const assigning = ref(false)

// Archived plans can't be newly assigned, but the current one must stay selectable for renewal.
const assignablePlans = computed(() => {
  const current = entitlements.value
  const list = [...plans.value]
  if (current && !list.some((p) => p.planId === current.planId)) {
    list.unshift({ planId: current.planId, name: `${current.planName} (archived)` } as Plan)
  }
  return list
})

const isRenewal = computed(
  () => !!entitlements.value?.subscriptionId && assignForm.planId === entitlements.value.planId,
)

function fillForms() {
  const current = subscription.value
  if (!current) return
  assignForm.planId = current.entitlements.planId
  assignForm.endsAt = isoToDueDate(current.entitlements.endsAt)
  assignForm.noEndDate = !current.entitlements.endsAt
  assignForm.graceDaysOverride = current.graceDaysOverride === null ? '' : String(current.graceDaysOverride)
  assignForm.notes = current.notes ?? ''

  for (const definition of catalog.value?.limits ?? []) {
    const override = current.limitOverrides?.find((o) => o.key === definition.key)
    limitOverrideForm[definition.key] = override
      ? { mode: override.value === null ? 'unlimited' : 'custom', value: override.value === null ? '' : String(override.value) }
      : { mode: 'plan', value: '' }
  }
  for (const definition of catalog.value?.features ?? []) {
    const override = current.featureOverrides?.find((o) => o.key === definition.key)
    featureOverrideForm[definition.key] = override ? (override.enabled ? 'on' : 'off') : 'plan'
  }
}

async function submitAssign() {
  if (!assignForm.planId) return
  if (!assignForm.noEndDate && !assignForm.endsAt) {
    toast.error('Pick an end date, or tick "No end date".')
    return
  }
  assigning.value = true
  try {
    await assignTenantSubscription(props.tenantId, {
      planId: assignForm.planId,
      endsAt: assignForm.noEndDate ? null : dueDateToIso(assignForm.endsAt),
      graceDaysOverride: assignForm.graceDaysOverride === '' ? null : Number(assignForm.graceDaysOverride),
      notes: assignForm.notes.trim() || null,
    })
    toast.success(isRenewal.value ? 'Subscription updated.' : 'Plan assigned.')
    await load()
    emit('changed')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to save subscription.')
  } finally {
    assigning.value = false
  }
}

const ending = ref(false)

async function submitEnd() {
  if (!window.confirm('End this subscription? The school moves to the default plan straight away.')) return
  ending.value = true
  try {
    await endTenantSubscription(props.tenantId)
    toast.success('Subscription ended.')
    await load()
    emit('changed')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to end subscription.')
  } finally {
    ending.value = false
  }
}

// --- Overrides ---
type LimitOverrideMode = 'plan' | 'custom' | 'unlimited'
const limitOverrideForm = reactive<Record<string, { mode: LimitOverrideMode; value: string }>>({})
const featureOverrideForm = reactive<Record<string, 'plan' | 'on' | 'off'>>({})
const savingOverrides = ref(false)

function planLimitText(key: string): string {
  const current = plans.value.find((p) => p.planId === entitlements.value?.planId)
  const value = current?.limits[key]
  return value === undefined ? 'plan value' : value === null ? 'unlimited' : String(value)
}

async function submitOverrides() {
  const limits = []
  for (const [key, entry] of Object.entries(limitOverrideForm)) {
    if (entry.mode === 'plan') continue
    if (entry.mode === 'unlimited') {
      limits.push({ key, value: null })
      continue
    }
    const parsed = Number.parseInt(entry.value, 10)
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error('Each custom limit needs a whole number of 0 or more.')
      return
    }
    limits.push({ key, value: parsed })
  }
  const features = Object.entries(featureOverrideForm)
    .filter(([, mode]) => mode !== 'plan')
    .map(([key, mode]) => ({ key, enabled: mode === 'on' }))

  savingOverrides.value = true
  try {
    await setTenantOverrides(props.tenantId, { limits, features })
    toast.success('Overrides saved.')
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to save overrides.')
  } finally {
    savingOverrides.value = false
  }
}

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'

defineExpose({ reload: load })
</script>

<template>
  <RaCard id="plan" :padding="0" class="scroll-mt-6 overflow-hidden">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Plan &amp; Usage</h3>
            <template v-if="entitlements && !isPlatformTenant">
              <RaChip tone="info">{{ entitlements.planName }}</RaChip>
              <SubscriptionStateBadge
                :state="entitlements.state"
                :ends-at="entitlements.endsAt"
                :locked-at="entitlements.lockedAt"
              />
            </template>
          </div>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">Subscription term, limits, and what's included.</p>
        </div>
        <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="open && 'rotate-180'" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p v-if="loading" class="m-0 p-6 text-center text-[13px] text-(--fg-3)">Loading plan…</p>

        <p v-else-if="isPlatformTenant" class="m-0 py-5 px-6 text-sm text-(--fg-3)">
          The platform tenant is exempt from plans: no limits, every feature, never expires.
        </p>

        <div v-else-if="entitlements && usage" class="flex flex-col">
          <!-- Term -->
          <dl class="m-0 grid grid-cols-4 gap-4 border-b border-(--line-1) py-5 px-6 max-md:grid-cols-2">
            <div>
              <dt class="text-xs text-(--fg-3)">Plan</dt>
              <dd class="m-0 mt-1 text-sm font-semibold text-(--fg-1)">{{ entitlements.planName }}</dd>
            </div>
            <div>
              <dt class="text-xs text-(--fg-3)">Started</dt>
              <dd class="m-0 mt-1 text-sm text-(--fg-1)">
                {{ entitlements.startsAt ? formatDate(entitlements.startsAt) : 'Default plan' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-(--fg-3)">Ends</dt>
              <dd class="m-0 mt-1 text-sm text-(--fg-1)">
                {{ entitlements.endsAt ? formatDate(entitlements.endsAt) : 'No end date' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-(--fg-3)">Access locks</dt>
              <dd class="m-0 mt-1 text-sm text-(--fg-1)">
                {{ entitlements.lockedAt ? formatDate(entitlements.lockedAt) : 'Never' }}
                <span v-if="entitlements.endsAt" class="text-xs text-(--fg-3)">({{ entitlements.graceDays }}-day grace)</span>
              </dd>
            </div>
          </dl>

          <!-- Usage -->
          <div class="flex flex-col gap-4 border-b border-(--line-1) py-5 px-6">
            <div class="flex items-center justify-between">
              <h4 class="m-0 text-sm font-semibold text-(--fg-1)">Usage</h4>
              <span class="text-xs text-(--fg-3)">
                {{ usage.enforcementMode === 'Hard' ? 'Creation is blocked at the limit' : 'Over-limit creation is allowed and flagged' }}
              </span>
            </div>
            <div v-for="limit in usage.limits" :key="limit.key" class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-sm">
                <span class="text-(--fg-2)">{{ limit.label }}</span>
                <span :class="limit.overLimit ? 'font-semibold text-(--danger)' : 'text-(--fg-1)'">
                  {{ limit.used.toLocaleString() }}
                  <span class="text-(--fg-3)">/ {{ limit.limit === null ? 'Unlimited' : limit.limit.toLocaleString() }}</span>
                </span>
              </div>
              <div v-if="limit.limit !== null" class="h-1.5 overflow-hidden rounded-(--ra-pill) bg-(--bg-3)">
                <div class="h-full rounded-(--ra-pill) transition-[width]" :class="usageBarClass(limit)" :style="{ width: `${usagePercent(limit)}%` }" />
              </div>
            </div>
            <p v-if="disabledFeatures.length > 0" class="m-0 text-xs text-(--fg-3)">
              Not included: {{ disabledFeatures.join(', ') }}
            </p>
          </div>

          <template v-if="canManagePlans">
            <!-- Assign / renew -->
            <form class="flex flex-col gap-4 border-b border-(--line-1) py-5 px-6" @submit.prevent="submitAssign">
              <div>
                <h4 class="m-0 text-sm font-semibold text-(--fg-1)">Subscription</h4>
                <p class="m-0 mt-1 text-xs text-(--fg-3)">
                  Keep the same plan to renew or extend; pick another to switch (the current one moves to history).
                </p>
              </div>
              <div class="grid grid-cols-3 gap-4 max-md:grid-cols-1">
                <div class="flex flex-col gap-1.5">
                  <Label for="sub-plan">Plan</Label>
                  <select id="sub-plan" v-model="assignForm.planId" :class="selectClass" required>
                    <option v-for="plan in assignablePlans" :key="plan.planId" :value="plan.planId">{{ plan.name }}</option>
                  </select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="sub-ends">End date</Label>
                  <Input id="sub-ends" v-model="assignForm.endsAt" type="date" class="h-9" :disabled="assignForm.noEndDate" />
                  <label class="flex items-center gap-2 text-xs text-(--fg-2)">
                    <input v-model="assignForm.noEndDate" type="checkbox" class="size-3.5 cursor-pointer accent-(--primary)">
                    No end date
                  </label>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="sub-grace">Grace days</Label>
                  <Input id="sub-grace" v-model="assignForm.graceDaysOverride" type="number" min="0" max="365" class="h-9" placeholder="Plan default" />
                  <p class="m-0 text-xs text-(--fg-4)">Blank uses the plan's default.</p>
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="sub-notes">Internal notes</Label>
                <Input id="sub-notes" v-model="assignForm.notes" maxlength="1000" placeholder="e.g. PO #1234, 20% discount" />
              </div>
              <div class="flex justify-end gap-2">
                <Button
                  v-if="entitlements.subscriptionId"
                  type="button"
                  variant="outline"
                  :disabled="ending"
                  @click="submitEnd"
                >
                  {{ ending ? 'Ending…' : 'End Subscription' }}
                </Button>
                <Button type="submit" :disabled="assigning">
                  {{ assigning ? 'Saving…' : isRenewal ? 'Update Term' : 'Assign Plan' }}
                </Button>
              </div>
            </form>

            <!-- Overrides -->
            <form v-if="catalog" class="flex flex-col gap-4 border-b border-(--line-1) py-5 px-6" @submit.prevent="submitOverrides">
              <div>
                <h4 class="m-0 text-sm font-semibold text-(--fg-1)">Overrides</h4>
                <p class="m-0 mt-1 text-xs text-(--fg-3)">Exceptions for this school only. They survive plan changes.</p>
              </div>
              <div class="grid grid-cols-2 gap-x-6 gap-y-3 max-md:grid-cols-1">
                <div v-for="definition in catalog.limits" :key="definition.key" class="flex items-center gap-2">
                  <span class="w-24 shrink-0 text-sm text-(--fg-2)">{{ definition.label }}</span>
                  <template v-if="limitOverrideForm[definition.key]">
                    <select v-model="limitOverrideForm[definition.key].mode" :class="selectClass" class="flex-1" :aria-label="`${definition.label} override`">
                      <option value="plan">Plan ({{ planLimitText(definition.key) }})</option>
                      <option value="custom">Custom</option>
                      <option value="unlimited">Unlimited</option>
                    </select>
                    <Input
                      v-if="limitOverrideForm[definition.key].mode === 'custom'"
                      v-model="limitOverrideForm[definition.key].value"
                      type="number"
                      min="0"
                      class="h-9 w-24"
                      :aria-label="`${definition.label} custom limit`"
                    />
                  </template>
                </div>
                <div v-for="definition in catalog.features" :key="definition.key" class="flex items-center gap-2">
                  <span class="w-24 shrink-0 text-sm text-(--fg-2)">{{ definition.label }}</span>
                  <select v-model="featureOverrideForm[definition.key]" :class="selectClass" class="flex-1" :aria-label="`${definition.label} override`">
                    <option value="plan">Plan default</option>
                    <option value="on">Always on</option>
                    <option value="off">Always off</option>
                  </select>
                </div>
              </div>
              <div class="flex justify-end">
                <Button type="submit" variant="outline" :disabled="savingOverrides">
                  {{ savingOverrides ? 'Saving…' : 'Save Overrides' }}
                </Button>
              </div>
            </form>

            <!-- History -->
            <div v-if="subscription?.history?.length" class="flex flex-col gap-2 py-5 px-6">
              <h4 class="m-0 text-sm font-semibold text-(--fg-1)">History</h4>
              <ul class="m-0 flex list-none flex-col p-0">
                <li
                  v-for="item in subscription.history"
                  :key="item.subscriptionId"
                  class="flex flex-wrap items-center justify-between gap-2 border-b border-(--line-1) py-2 text-sm last:border-b-0"
                >
                  <span class="font-semibold text-(--fg-1)">
                    {{ item.planName }}
                    <RaChip v-if="item.isCurrent" tone="info" class="ml-1.5">Current</RaChip>
                  </span>
                  <span class="text-xs text-(--fg-3)">
                    {{ formatDate(item.startsAt) }} – {{ item.supersededAt ? formatDate(item.supersededAt) : item.endsAt ? formatDate(item.endsAt) : 'open-ended' }}
                    <template v-if="item.notes"> · {{ item.notes }}</template>
                  </span>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </RaCard>
</template>
