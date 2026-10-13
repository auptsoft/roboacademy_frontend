<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import SubscriptionStateBadge from '@/components/SubscriptionStateBadge.vue'
import { ApiError } from '@/api/client'
import {
  getPlan,
  getPlanCatalog,
  updatePlan,
  archivePlan,
  restorePlan,
  makeDefaultPlan,
  type Plan,
  type PlanCatalog,
  type PlanEnforcementMode,
  type PlanSubscribedTenant,
} from '@/api/plans'
import { AI_FEATURES, AI_BASIC_TOKENS_KEY, AI_ENHANCED_TOKENS_KEY, AI_TOKEN_KEYS, allowanceHint, isAIPlanKey } from '@/lib/ai'

const route = useRoute()
const router = useRouter()
const planId = computed(() => String(route.params.planId))

const plan = ref<Plan | null>(null)
const tenants = ref<PlanSubscribedTenant[]>([])
const catalog = ref<PlanCatalog | null>(null)
const loading = ref(true)
const notFound = ref(false)

const form = reactive({
  name: '',
  code: '',
  description: '',
  enforcementMode: 'Hard' as PlanEnforcementMode,
  defaultGraceDays: 14,
  sortOrder: 0,
})
// Per limit: a capped number, or unlimited. Kept as a string so an emptied input doesn't
// silently become 0.
const limitForm = reactive<Record<string, { unlimited: boolean; value: string }>>({})
const featureForm = reactive<Record<string, boolean>>({})
const errors = ref<Record<string, string[]>>({})

function fillForm(loaded: Plan) {
  form.name = loaded.name
  form.code = loaded.code
  form.description = loaded.description ?? ''
  form.enforcementMode = loaded.enforcementMode
  form.defaultGraceDays = loaded.defaultGraceDays
  form.sortOrder = loaded.sortOrder
  for (const [key, value] of Object.entries(loaded.limits)) {
    limitForm[key] = { unlimited: value === null, value: value === null ? '' : String(value) }
  }
  for (const [key, enabled] of Object.entries(loaded.features)) {
    featureForm[key] = enabled
  }
}

async function load() {
  loading.value = true
  notFound.value = false
  try {
    const [detail, loadedCatalog] = await Promise.all([getPlan(planId.value), catalog.value ?? getPlanCatalog()])
    plan.value = detail.plan
    tenants.value = detail.tenants
    catalog.value = loadedCatalog
    fillForm(detail.plan)
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load plan.')
    }
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

// --- AI: shown in its own card, with each feature's Enhanced switch beside it and the two token
// allowances translated into uses, instead of mixed into the generic lists below. ---
const genericLimits = computed(() => catalog.value?.limits.filter((d) => !isAIPlanKey(d.key)) ?? [])
const genericFeatures = computed(() => catalog.value?.features.filter((d) => !isAIPlanKey(d.key)) ?? [])
const aiFeatures = computed(() =>
  AI_FEATURES.filter((f) => catalog.value?.features.some((d) => d.key === f.key)).map((f) => ({
    ...f,
    description: catalog.value?.features.find((d) => d.key === f.key)?.description ?? '',
  })),
)
const aiLimits = computed(() => catalog.value?.limits.filter((d) => AI_TOKEN_KEYS.includes(d.key)) ?? [])

function aiAllowanceHint(key: string): string {
  const entry = limitForm[key]
  if (!entry) return ''
  if (entry.unlimited) return 'Not capped.'
  const tokens = Number.parseInt(entry.value, 10)
  if (Number.isNaN(tokens) || tokens <= 0) return key === AI_ENHANCED_TOKENS_KEY ? 'No Enhanced allowance.' : 'No AI allowance.'
  const included = aiFeatures.value.filter((f) => featureForm[f.key])
  return `${allowanceHint(tokens, included.length > 0 ? included : aiFeatures.value)} a month.`
}

// D0.3: a missing (unlimited) AI allowance is allowed, but it means uncapped paid usage.
const aiWarnings = computed(() => {
  const warnings: string[] = []
  const included = aiFeatures.value.filter((f) => featureForm[f.key])
  const enhanced = included.filter((f) => featureForm[f.enhancedKey])
  const basic = limitForm[AI_BASIC_TOKENS_KEY]
  const enhancedLimit = limitForm[AI_ENHANCED_TOKENS_KEY]
  if (included.length > 0 && basic?.unlimited) {
    warnings.push('AI features are on but the Basic allowance is unlimited, so AI usage on this plan is not capped.')
  }
  if (enhanced.length > 0 && enhancedLimit?.unlimited) {
    warnings.push('Some features run on Enhanced but the Enhanced allowance is unlimited, so Enhanced usage is not capped.')
  }
  if (enhanced.length > 0 && enhancedLimit && !enhancedLimit.unlimited && Number.parseInt(enhancedLimit.value, 10) === 0) {
    warnings.push(`${enhanced.map((f) => f.label).join(' and ')} ${enhanced.length === 1 ? 'is' : 'are'} set to Enhanced, but the Enhanced allowance is 0, so ${enhanced.length === 1 ? 'it' : 'they'} will always run on Basic.`)
  }
  return warnings
})

const saving = ref(false)

async function save() {
  if (!plan.value) return
  errors.value = {}

  const limits: Record<string, number | null> = {}
  for (const [key, entry] of Object.entries(limitForm)) {
    if (entry.unlimited) {
      limits[key] = null
      continue
    }
    const parsed = Number.parseInt(entry.value, 10)
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error('Each capped limit needs a whole number of 0 or more.')
      return
    }
    limits[key] = parsed
  }

  saving.value = true
  try {
    const updated = await updatePlan(plan.value.planId, {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim() || null,
      enforcementMode: form.enforcementMode,
      defaultGraceDays: Number(form.defaultGraceDays),
      sortOrder: Number(form.sortOrder),
      limits,
      features: { ...featureForm },
    })
    plan.value = { ...updated, tenantCount: plan.value.tenantCount }
    fillForm(updated)
    toast.success('Plan saved. Changes apply to every school on it.')
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      errors.value = error.fieldErrors
      toast.error('Please fix the highlighted fields.')
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to save plan.')
    }
  } finally {
    saving.value = false
  }
}

const statusPending = ref(false)

async function runStatus(action: (id: string) => Promise<unknown>, success: string, confirmText?: string) {
  if (!plan.value) return
  if (confirmText && !window.confirm(confirmText)) return
  statusPending.value = true
  try {
    await action(plan.value.planId)
    toast.success(success)
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to update plan.')
  } finally {
    statusPending.value = false
  }
}

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-6 pt-8 px-8 pb-16 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <button
      class="inline-flex w-fit cursor-pointer items-center gap-1.5 bg-transparent p-0 text-sm text-(--fg-3) transition-colors hover:text-(--fg-1)"
      @click="router.push('/plans')"
    >
      <ArrowLeft :size="14" /> All plans
    </button>

    <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading plan…</p>

    <RaCard v-else-if="notFound" class="p-10 text-center">
      <p class="m-0 text-sm text-(--fg-3)">Plan not found.</p>
    </RaCard>

    <template v-else-if="plan && catalog">
      <div class="flex items-start justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">{{ plan.name }}</h1>
            <RaChip v-if="plan.isDefault" tone="info">Default</RaChip>
            <RaChip v-if="!plan.isActive" tone="neutral">Archived</RaChip>
          </div>
          <p class="mt-1.5 text-sm text-(--fg-3)">
            {{ plan.tenantCount }} school{{ plan.tenantCount === 1 ? '' : 's' }} on this plan
            <template v-if="plan.isDefault"> (including every school without a subscription)</template>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="plan.isActive && !plan.isDefault"
            variant="outline"
            :disabled="statusPending"
            @click="runStatus(makeDefaultPlan, 'Default plan changed.')"
          >
            Make Default
          </Button>
          <Button
            v-if="plan.isActive && !plan.isDefault"
            variant="secondary"
            :disabled="statusPending"
            @click="runStatus(archivePlan, 'Plan archived.', `Archive &quot;${plan.name}&quot;? Schools already on it keep it, but it can't be newly assigned.`)"
          >
            Archive
          </Button>
          <Button
            v-if="!plan.isActive"
            :disabled="statusPending"
            @click="runStatus(restorePlan, 'Plan restored.')"
          >
            Restore
          </Button>
        </div>
      </div>

      <form class="grid grid-cols-[1fr_340px] gap-6 max-xl:grid-cols-1" @submit.prevent="save">
        <div class="flex flex-col gap-6">
          <RaCard :padding="0" class="overflow-hidden">
            <div class="border-b border-(--line-1) py-5 px-6">
              <h3 class="m-0 text-lg font-bold text-(--fg-1)">Details</h3>
            </div>
            <div class="flex flex-col gap-4 py-5 px-6">
              <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                <div class="flex flex-col gap-1.5">
                  <Label for="plan-name">Name</Label>
                  <Input id="plan-name" v-model="form.name" required />
                  <p v-for="msg in errors.Name" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="plan-code">Code</Label>
                  <Input id="plan-code" v-model="form.code" required />
                  <p v-for="msg in errors.Code" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="plan-description">Description</Label>
                <textarea
                  id="plan-description"
                  v-model="form.description"
                  rows="2"
                  maxlength="500"
                  class="w-full resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-sans text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)"
                  placeholder="Who this plan is for"
                />
              </div>
              <div class="grid grid-cols-3 gap-4 max-md:grid-cols-1">
                <div class="flex flex-col gap-1.5">
                  <Label for="plan-mode">When a school reaches a limit</Label>
                  <select id="plan-mode" v-model="form.enforcementMode" :class="selectClass">
                    <option value="Hard">Block creation</option>
                    <option value="Soft">Allow, but flag as over limit</option>
                  </select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="plan-grace">Grace period (days)</Label>
                  <Input id="plan-grace" v-model="form.defaultGraceDays" type="number" min="0" max="365" required />
                  <p class="m-0 text-xs text-(--fg-4)">After expiry, before access is locked.</p>
                  <p v-for="msg in errors.DefaultGraceDays" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="plan-sort">Sort order</Label>
                  <Input id="plan-sort" v-model="form.sortOrder" type="number" required />
                </div>
              </div>
            </div>
          </RaCard>

          <RaCard :padding="0" class="overflow-hidden">
            <div class="border-b border-(--line-1) py-5 px-6">
              <h3 class="m-0 text-lg font-bold text-(--fg-1)">Limits</h3>
              <p class="m-0 mt-1 text-xs text-(--fg-3)">Leave a limit unlimited to not cap it.</p>
            </div>
            <div class="flex flex-col">
              <div
                v-for="definition in genericLimits"
                :key="definition.key"
                class="flex items-center gap-4 border-b border-(--line-1) py-3.5 px-6 last:border-b-0 max-md:flex-wrap"
              >
                <div class="flex-1">
                  <p class="m-0 text-sm font-semibold text-(--fg-1)">{{ definition.label }}</p>
                  <p class="m-0 text-xs text-(--fg-3)">{{ definition.description }}</p>
                </div>
                <template v-if="limitForm[definition.key]">
                  <Input
                    v-model="limitForm[definition.key].value"
                    type="number"
                    min="0"
                    class="h-9 w-28"
                    :disabled="limitForm[definition.key].unlimited"
                    :aria-label="`${definition.label} limit`"
                    :placeholder="limitForm[definition.key].unlimited ? '∞' : '0'"
                  />
                  <label class="flex items-center gap-2 text-sm text-(--fg-2)">
                    <input
                      v-model="limitForm[definition.key].unlimited"
                      type="checkbox"
                      class="size-4 cursor-pointer accent-(--primary)"
                    >
                    Unlimited
                  </label>
                </template>
              </div>
            </div>
          </RaCard>

          <RaCard :padding="0" class="overflow-hidden">
            <div class="border-b border-(--line-1) py-5 px-6">
              <h3 class="m-0 text-lg font-bold text-(--fg-1)">Features</h3>
              <p class="m-0 mt-1 text-xs text-(--fg-3)">Areas a school on this plan can use.</p>
            </div>
            <div class="flex flex-col">
              <label
                v-for="definition in genericFeatures"
                :key="definition.key"
                class="flex cursor-pointer items-center gap-4 border-b border-(--line-1) py-3.5 px-6 last:border-b-0"
              >
                <input
                  v-model="featureForm[definition.key]"
                  type="checkbox"
                  class="size-4 cursor-pointer accent-(--primary)"
                >
                <span class="flex-1">
                  <span class="block text-sm font-semibold text-(--fg-1)">{{ definition.label }}</span>
                  <span class="block text-xs text-(--fg-3)">{{ definition.description }}</span>
                </span>
              </label>
            </div>
          </RaCard>

          <RaCard v-if="aiFeatures.length > 0" :padding="0" class="overflow-hidden">
            <div class="border-b border-(--line-1) py-5 px-6">
              <h3 class="m-0 text-lg font-bold text-(--fg-1)">AI</h3>
              <p class="m-0 mt-1 text-xs text-(--fg-3)">
                Which AI features this plan includes, which run on the Enhanced model tier, and the monthly AI allowance.
                Schools still have to accept the AI terms and can switch features off themselves.
              </p>
            </div>
            <div class="flex flex-col">
              <div
                v-for="feature in aiFeatures"
                :key="feature.key"
                class="flex items-center gap-4 border-b border-(--line-1) py-3.5 px-6 max-md:flex-wrap"
              >
                <label class="flex flex-1 cursor-pointer items-center gap-4">
                  <input v-model="featureForm[feature.key]" type="checkbox" class="size-4 cursor-pointer accent-(--primary)">
                  <span class="flex-1">
                    <span class="block text-sm font-semibold text-(--fg-1)">{{ feature.label }}</span>
                    <span class="block text-xs text-(--fg-3)">{{ feature.description }}</span>
                  </span>
                </label>
                <label
                  class="flex items-center gap-2 text-sm"
                  :class="featureForm[feature.key] ? 'cursor-pointer text-(--fg-2)' : 'text-(--fg-4)'"
                >
                  <input
                    v-model="featureForm[feature.enhancedKey]"
                    type="checkbox"
                    class="size-4 cursor-pointer accent-(--primary)"
                    :disabled="!featureForm[feature.key]"
                    :aria-label="`${feature.label} uses Enhanced`"
                  >
                  Enhanced
                </label>
              </div>

              <div
                v-for="definition in aiLimits"
                :key="definition.key"
                class="flex items-center gap-4 border-b border-(--line-1) py-3.5 px-6 last:border-b-0 max-md:flex-wrap"
              >
                <div class="flex-1">
                  <p class="m-0 text-sm font-semibold text-(--fg-1)">{{ definition.label }}</p>
                  <p class="m-0 text-xs text-(--fg-3)">{{ aiAllowanceHint(definition.key) }}</p>
                </div>
                <template v-if="limitForm[definition.key]">
                  <Input
                    v-model="limitForm[definition.key].value"
                    type="number"
                    min="0"
                    step="100000"
                    class="h-9 w-36"
                    :disabled="limitForm[definition.key].unlimited"
                    :aria-label="`${definition.label} limit`"
                    :placeholder="limitForm[definition.key].unlimited ? '∞' : '0'"
                  />
                  <label class="flex items-center gap-2 text-sm text-(--fg-2)">
                    <input v-model="limitForm[definition.key].unlimited" type="checkbox" class="size-4 cursor-pointer accent-(--primary)">
                    Unlimited
                  </label>
                </template>
              </div>

              <ul v-if="aiWarnings.length > 0" class="m-0 flex list-none flex-col gap-1.5 border-t border-(--line-1) bg-(--warning-soft) py-3.5 px-6">
                <li v-for="warning in aiWarnings" :key="warning" class="text-xs text-(--fg-1)">{{ warning }}</li>
              </ul>
            </div>
          </RaCard>

          <div class="flex justify-end">
            <Button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save Plan' }}</Button>
          </div>
        </div>

        <RaCard :padding="0" class="h-fit overflow-hidden">
          <div class="border-b border-(--line-1) py-5 px-6">
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Schools</h3>
            <p class="m-0 mt-1 text-xs text-(--fg-3)">Assign plans from each school's setup page.</p>
          </div>
          <p v-if="tenants.length === 0" class="m-0 p-6 text-center text-[13px] text-(--fg-3)">
            {{ plan.isDefault ? 'Only schools without a subscription.' : 'No schools on this plan yet.' }}
          </p>
          <ul v-else class="m-0 flex list-none flex-col p-0">
            <li
              v-for="tenant in tenants"
              :key="tenant.tenantId"
              class="flex items-center justify-between gap-3 border-b border-(--line-1) py-3 px-6 last:border-b-0"
            >
              <div class="min-w-0">
                <button
                  type="button"
                  class="cursor-pointer truncate bg-transparent p-0 text-left text-sm font-semibold text-(--fg-1) underline-offset-2 hover:underline"
                  @click="router.push(`/tenants/${tenant.tenantId}#plan`)"
                >
                  {{ tenant.name }}
                </button>
                <p class="m-0 text-xs text-(--fg-3)">
                  {{ tenant.endsAt ? `Ends ${formatDate(tenant.endsAt)}` : 'No end date' }}
                </p>
              </div>
              <SubscriptionStateBadge :state="tenant.state" :ends-at="tenant.endsAt" />
            </li>
          </ul>
        </RaCard>
      </form>
    </template>
  </div>
</template>
