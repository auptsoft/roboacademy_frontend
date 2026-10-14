<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { Activity, Loader2, MoreVertical, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import TenantMultiSelect from '@/components/TenantMultiSelect.vue'
import { ApiError } from '@/api/client'
import type { Tenant } from '@/api/tenancy'
import {
  checkAIModel,
  createAIModel,
  createAIProvider,
  deleteAIModel,
  endAITierTrial,
  listAIModels,
  listAIProviders,
  listAITiers,
  promoteAITierCandidate,
  retireAIModel,
  rollbackAITier,
  runAIHealthCheck,
  setAITierPrimary,
  startAITierTrial,
  updateAIModel,
  updateAIProvider,
  type AIHealthCheckResult,
  type AIModel,
  type AIModelKind,
  type AIModelRef,
  type AIProvider,
  type AIProviderStatus,
  type AITierAssignment,
  type AITierSlot,
} from '@/api/ai'

// Platform-wide model registry: which model backs each AI tier for every school. Swapping a
// model here takes effect without a deploy, so every change that alters what schools get asks
// for confirmation and says what to check.

const providers = ref<AIProvider[]>([])
const models = ref<AIModel[]>([])
const tiers = ref<AITierAssignment[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    ;[providers.value, models.value, tiers.value] = await Promise.all([listAIProviders(), listAIModels(), listAITiers()])
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load AI models.')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Same ⋮ trigger as the Plans list.
const menuTriggerClass =
  'inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50'

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'

const TIER_HELP: Record<AITierSlot, string> = {
  Basic: 'Default for every AI feature. Plans set a Basic monthly allowance.',
  Enhanced: 'Higher quality, higher cost. Used where a plan switches a feature to Enhanced, and for "Try a better draft".',
  Embedding: 'Indexes course content for the tutor. Changing it means re-indexing everything.',
}

function kindFor(slot: AITierSlot): AIModelKind {
  return slot === 'Embedding' ? 'Embedding' : 'Chat'
}

function verifiedModels(slot: AITierSlot): AIModel[] {
  return models.value.filter((m) => m.kind === kindFor(slot) && m.status === 'Verified')
}

function price(model: AIModelRef | AIModel | null): string {
  if (!model || (model.inputPricePerMillion === null && model.outputPricePerMillion === null)) return 'price not set'
  return `$${model.inputPricePerMillion ?? '?'} in / $${model.outputPricePerMillion ?? '?'} out per 1M tokens`
}

function statusTone(status: string): 'info' | 'neutral' {
  return status === 'Verified' || status === 'Active' ? 'info' : 'neutral'
}

const pending = ref(false)

async function run<T>(action: () => Promise<T>, success: string): Promise<boolean> {
  pending.value = true
  try {
    await action()
    toast.success(success)
    await load()
    return true
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Something went wrong.')
    return false
  } finally {
    pending.value = false
  }
}

// --- Tier: change primary/fallback ---
const tierDialog = reactive({ open: false, slot: 'Basic' as AITierSlot, primaryModelId: '', fallbackModelId: '' })

function openTierDialog(tier: AITierAssignment) {
  tierDialog.slot = tier.slot
  tierDialog.primaryModelId = tier.primary?.id ?? ''
  tierDialog.fallbackModelId = tier.fallback?.id ?? ''
  tierDialog.open = true
}

const tierDialogCurrent = computed(() => tiers.value.find((t) => t.slot === tierDialog.slot) ?? null)
const tierDialogNew = computed(() => models.value.find((m) => m.id === tierDialog.primaryModelId) ?? null)

async function submitTier() {
  const current = tierDialogCurrent.value?.primary
  if (current && current.id !== tierDialog.primaryModelId && tierDialog.slot !== 'Embedding' &&
      !window.confirm(
        `Switch every school's ${tierDialog.slot} AI from ${current.displayName} to ${tierDialogNew.value?.displayName}?\n\n` +
        'Run the AI test sets on the new model first (the tutor\'s hint-mode cases must all pass), and review plan token limits if the price differs.',
      )) {
    return
  }
  await run(
    () => setAITierPrimary(tierDialog.slot, tierDialog.primaryModelId, tierDialog.fallbackModelId || null),
    `${tierDialog.slot} tier updated.`,
  )
  tierDialog.open = false
}

// --- Tier: trial ---
const trialDialog = reactive({ open: false, slot: 'Basic' as AITierSlot, modelId: '', tenants: [] as Tenant[] })

function openTrialDialog(tier: AITierAssignment) {
  trialDialog.slot = tier.slot
  trialDialog.modelId = ''
  trialDialog.tenants = []
  trialDialog.open = true
}

async function submitTrial() {
  await run(
    () => startAITierTrial(trialDialog.slot, trialDialog.modelId, trialDialog.tenants.map((t) => t.tenantId)),
    'Trial started.',
  )
  trialDialog.open = false
}

function confirmPromote(tier: AITierAssignment) {
  if (!tier.candidate) return
  const message =
    `Make ${tier.candidate.displayName} the ${tier.slot} model for every school?\n\n` +
    `Current: ${tier.primary?.displayName ?? 'none'} (${price(tier.primary)})\n` +
    `New: ${tier.candidate.displayName} (${price(tier.candidate)})\n\n` +
    'Run the AI test sets on it first, and review plan token limits if the price differs. You can roll back afterwards.'
  if (window.confirm(message)) {
    void run(() => promoteAITierCandidate(tier.slot), 'Trial model promoted.')
  }
}

function confirmRollback(tier: AITierAssignment) {
  if (tier.previous && window.confirm(`Switch the ${tier.slot} tier back to ${tier.previous.displayName} for every school?`)) {
    void run(() => rollbackAITier(tier.slot), 'Rolled back.')
  }
}

// --- Providers ---
const providerDialog = reactive({
  open: false,
  id: '' as string,
  name: '',
  endpoint: '',
  apiKey: '',
  status: 'Active' as AIProviderStatus,
})

function openProviderDialog(provider?: AIProvider) {
  providerDialog.id = provider?.id ?? ''
  providerDialog.name = provider?.name ?? ''
  providerDialog.endpoint = provider?.endpoint ?? ''
  providerDialog.status = provider?.status ?? 'Active'
  providerDialog.apiKey = ''
  providerDialog.open = true
}

async function submitProvider() {
  const { id, name, endpoint, apiKey, status } = providerDialog
  await run(
    () => id
      ? updateAIProvider(id, { name: name.trim(), endpoint: endpoint.trim(), status, apiKey: apiKey.trim() || null })
      : createAIProvider({ name: name.trim(), endpoint: endpoint.trim(), apiKey: apiKey.trim() }),
    id ? 'Provider updated.' : 'Provider added.',
  )
  providerDialog.open = false
}

// --- Models ---
const modelDialog = reactive({
  open: false,
  providerId: '',
  modelId: '',
  kind: 'Chat' as AIModelKind,
  displayName: '',
  inputPrice: '' as string | number,
  outputPrice: '' as string | number,
})

function openModelDialog() {
  Object.assign(modelDialog, {
    open: true, providerId: providers.value[0]?.id ?? '', modelId: '', kind: 'Chat',
    displayName: '', inputPrice: '', outputPrice: '',
  })
}

const checking = ref<string | null>(null)

// v-model on a type="number" input yields a number once typed in, '' when empty.
function toPrice(value: string | number): number | null {
  const text = String(value).trim()
  return text === '' ? null : Number(text)
}

// --- Edit: display name and prices only ---
const editDialog = reactive({
  open: false,
  model: null as AIModel | null,
  displayName: '',
  inputPrice: '' as string | number,
  outputPrice: '' as string | number,
})

function openEditDialog(model: AIModel) {
  Object.assign(editDialog, {
    open: true,
    model,
    displayName: model.displayName,
    inputPrice: model.inputPricePerMillion ?? '',
    outputPrice: model.outputPricePerMillion ?? '',
  })
}

async function submitEdit() {
  const model = editDialog.model
  if (!model) return
  const saved = await run(
    () => updateAIModel(model.id, {
      displayName: editDialog.displayName.trim() || model.modelId,
      inputPricePerMillion: toPrice(editDialog.inputPrice),
      outputPricePerMillion: toPrice(editDialog.outputPrice),
    }),
    'Model updated.',
  )
  if (saved) editDialog.open = false
}

function confirmDelete(model: AIModel) {
  if (window.confirm(`Delete ${model.displayName}? This can't be undone. Past usage keeps its name in reports.`)) {
    void run(() => deleteAIModel(model.id), 'Model deleted.')
  }
}

async function submitModel() {
  checking.value = 'new'
  try {
    const created = await createAIModel({
      providerId: modelDialog.providerId,
      modelId: modelDialog.modelId.trim(),
      kind: modelDialog.kind,
      displayName: modelDialog.displayName.trim() || modelDialog.modelId.trim(),
      inputPricePerMillion: toPrice(modelDialog.inputPrice),
      outputPricePerMillion: toPrice(modelDialog.outputPrice),
    })
    toast[created.status === 'Verified' ? 'success' : 'warning'](
      created.status === 'Verified' ? 'Model added and verified.' : 'Model added, but some checks failed.')
    modelDialog.open = false
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to add model.')
  } finally {
    checking.value = null
  }
}

async function recheck(model: AIModel) {
  checking.value = model.id
  try {
    const updated = await checkAIModel(model.id)
    toast[updated.status === 'Verified' ? 'success' : 'warning'](
      updated.status === 'Verified' ? 'All checks passed.' : 'Some checks failed.')
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to run checks.')
  } finally {
    checking.value = null
  }
}

function confirmRetire(model: AIModel) {
  if (window.confirm(`Retire ${model.displayName}? It can't be assigned to a tier afterwards.`)) {
    void run(() => retireAIModel(model.id), 'Model retired.')
  }
}

function failedChecks(model: AIModel): string {
  return (model.lastCheckResult?.checks ?? []).filter((c) => !c.passed).map((c) => `${c.name}: ${c.error ?? 'failed'}`).join(' · ')
}

// --- Health check ---
const healthResults = ref<AIHealthCheckResult[] | null>(null)
const healthRunning = ref(false)

async function submitHealthCheck() {
  healthRunning.value = true
  try {
    healthResults.value = await runAIHealthCheck()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Health check failed.')
  } finally {
    healthRunning.value = false
  }
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div class="flex items-start justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">AI Models</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Which model backs each AI tier for every school. Changes apply without a deploy.</p>
      </div>
      <Button variant="outline" :disabled="healthRunning" @click="submitHealthCheck">
        <Activity :size="14" />
        {{ healthRunning ? 'Checking…' : 'Run Health Check' }}
      </Button>
    </div>

    <RaCard v-if="healthResults" :padding="0" class="overflow-hidden">
      <ul class="m-0 flex list-none flex-col p-0">
        <li
          v-for="result in healthResults"
          :key="result.tier"
          class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6 text-sm last:border-b-0"
        >
          <span class="w-24 font-semibold text-(--fg-1)">{{ result.tier }}</span>
          <RaChip :tone="result.ok ? 'info' : 'neutral'">{{ result.ok ? 'OK' : 'Failed' }}</RaChip>
          <span class="text-(--fg-3)">
            {{ result.ok ? result.modelId : result.error }}
            <template v-if="result.usedFallbackModel"> (answered by the fallback model)</template>
          </span>
        </li>
      </ul>
    </RaCard>

    <p v-if="loading" class="m-0 text-center text-[13px] text-(--fg-3)">Loading…</p>

    <template v-else>
      <!-- Tiers -->
      <div class="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <RaCard v-for="tier in tiers" :key="tier.slot" :padding="0" class="flex flex-col overflow-hidden">
          <div class="border-b border-(--line-1) py-4 px-5">
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">{{ tier.slot }}</h3>
            <p class="m-0 mt-1 text-xs text-(--fg-3)">{{ TIER_HELP[tier.slot] }}</p>
          </div>
          <dl class="m-0 flex flex-1 flex-col gap-3 py-4 px-5 text-sm">
            <div>
              <dt class="text-xs text-(--fg-3)">Model</dt>
              <dd class="m-0 mt-0.5 font-semibold text-(--fg-1)">{{ tier.primary?.displayName ?? 'Not set' }}</dd>
              <dd v-if="tier.primary" class="m-0 text-xs text-(--fg-3)">{{ price(tier.primary) }}</dd>
            </div>
            <div v-if="tier.slot !== 'Embedding'">
              <dt class="text-xs text-(--fg-3)">Fallback (provider outage)</dt>
              <dd class="m-0 mt-0.5 text-(--fg-2)">{{ tier.fallback?.displayName ?? 'None' }}</dd>
            </div>
            <div v-if="tier.candidate">
              <dt class="text-xs text-(--fg-3)">On trial</dt>
              <dd class="m-0 mt-0.5 text-(--fg-1)">
                {{ tier.candidate.displayName }}
                <span class="text-xs text-(--fg-3)">· {{ tier.candidateTenantIds.length }} school{{ tier.candidateTenantIds.length === 1 ? '' : 's' }}</span>
              </dd>
            </div>
            <div v-if="tier.updatedAt" class="text-xs text-(--fg-4)">Changed {{ formatDate(tier.updatedAt) }}</div>
          </dl>
          <div class="flex flex-wrap gap-2 border-t border-(--line-1) py-3 px-5">
            <Button size="sm" variant="outline" :disabled="pending" @click="openTierDialog(tier)">
              {{ tier.primary ? 'Change' : 'Set model' }}
            </Button>
            <template v-if="tier.slot !== 'Embedding'">
              <Button v-if="!tier.candidate && tier.primary" size="sm" variant="outline" :disabled="pending" @click="openTrialDialog(tier)">Trial</Button>
              <Button v-if="tier.candidate" size="sm" :disabled="pending" @click="confirmPromote(tier)">Promote</Button>
              <Button v-if="tier.candidate" size="sm" variant="ghost" :disabled="pending" @click="run(() => endAITierTrial(tier.slot), 'Trial ended.')">End trial</Button>
              <Button v-if="tier.previous" size="sm" variant="ghost" :disabled="pending" @click="confirmRollback(tier)">Roll back</Button>
            </template>
          </div>
        </RaCard>
      </div>

      <!-- Models -->
      <RaCard :padding="0" class="overflow-hidden">
        <div class="flex items-center justify-between border-b border-(--line-1) py-5 px-6">
          <div>
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Models</h3>
            <p class="m-0 mt-1 text-xs text-(--fg-3)">A model must pass its checks (Verified) before it can back a tier.</p>
          </div>
          <Button size="sm" :disabled="providers.length === 0" @click="openModelDialog">
            <Plus :size="14" />
            Add Model
          </Button>
        </div>
        <p v-if="models.length === 0" class="m-0 p-6 text-center text-[13px] text-(--fg-3)">
          {{ providers.length === 0 ? 'Add a provider first.' : 'No models yet.' }}
        </p>
        <div
          v-for="model in models"
          :key="model.id"
          class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-(--line-1) py-3.5 px-6 last:border-b-0"
          :class="model.status === 'Retired' && 'opacity-60'"
        >
          <div class="min-w-0 flex-1">
            <p class="m-0 text-sm font-semibold text-(--fg-1)">
              {{ model.displayName }}
              <span class="font-mono text-xs font-normal text-(--fg-3)">{{ model.modelId }}</span>
            </p>
            <p class="m-0 text-xs text-(--fg-3)">
              {{ model.providerName }} · {{ model.kind }} · {{ price(model) }}
              <template v-if="model.embeddingDimensions"> · {{ model.embeddingDimensions }} dimensions</template>
            </p>
            <p v-if="model.status === 'Failed'" class="m-0 mt-1 text-xs text-(--danger)">{{ failedChecks(model) }}</p>
          </div>
          <span v-if="checking === model.id" class="inline-flex items-center gap-1.5 text-xs text-(--fg-3)">
            <Loader2 :size="12" class="animate-spin" /> Checking…
          </span>
          <RaChip :tone="statusTone(model.status)">{{ model.status }}</RaChip>
          <DropdownMenu>
            <DropdownMenuTrigger :class="menuTriggerClass" :disabled="pending || checking !== null">
              <MoreVertical :size="16" />
              <span class="sr-only">Actions for {{ model.displayName }}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="openEditDialog(model)">Edit</DropdownMenuItem>
              <template v-if="model.status !== 'Retired'">
                <DropdownMenuItem @select="recheck(model)">Run checks</DropdownMenuItem>
                <DropdownMenuItem @select="confirmRetire(model)">Retire</DropdownMenuItem>
              </template>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" @select="confirmDelete(model)">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </RaCard>

      <!-- Providers -->
      <RaCard :padding="0" class="overflow-hidden">
        <div class="flex items-center justify-between border-b border-(--line-1) py-5 px-6">
          <div>
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Providers</h3>
            <p class="m-0 mt-1 text-xs text-(--fg-3)">Any OpenAI-compatible API. Keys are stored encrypted and never shown again.</p>
          </div>
          <Button size="sm" @click="openProviderDialog()">
            <Plus :size="14" />
            Add Provider
          </Button>
        </div>
        <p v-if="providers.length === 0" class="m-0 p-6 text-center text-[13px] text-(--fg-3)">No providers yet.</p>
        <div
          v-for="provider in providers"
          :key="provider.id"
          class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-(--line-1) py-3.5 px-6 last:border-b-0"
        >
          <div class="min-w-0 flex-1">
            <p class="m-0 text-sm font-semibold text-(--fg-1)">{{ provider.name }}</p>
            <p class="m-0 truncate font-mono text-xs text-(--fg-3)">{{ provider.endpoint }}</p>
          </div>
          <RaChip :tone="statusTone(provider.status)">{{ provider.status }}</RaChip>
          <span class="text-xs text-(--fg-3)">{{ provider.hasApiKey ? 'Key set' : 'No key' }}</span>
          <DropdownMenu>
            <DropdownMenuTrigger :class="menuTriggerClass" :disabled="pending">
              <MoreVertical :size="16" />
              <span class="sr-only">Actions for {{ provider.name }}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="openProviderDialog(provider)">Edit</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </RaCard>
    </template>

    <!-- Tier dialog -->
    <Dialog v-model:open="tierDialog.open">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ tierDialog.slot }} tier</DialogTitle>
          <DialogDescription>Only Verified {{ kindFor(tierDialog.slot).toLowerCase() }} models are listed.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitTier">
          <div class="flex flex-col gap-1.5">
            <Label for="tier-primary">Model</Label>
            <select id="tier-primary" v-model="tierDialog.primaryModelId" :class="selectClass" required>
              <option v-for="model in verifiedModels(tierDialog.slot)" :key="model.id" :value="model.id">
                {{ model.displayName }} ({{ model.providerName }})
              </option>
            </select>
            <p v-if="tierDialog.slot === 'Embedding' && tierDialogCurrent?.primary" class="m-0 text-xs text-(--fg-3)">
              Changing the embedding model needs a full re-index, which isn't available yet.
            </p>
          </div>
          <div v-if="tierDialog.slot !== 'Embedding'" class="flex flex-col gap-1.5">
            <Label for="tier-fallback">Fallback if the provider fails</Label>
            <select id="tier-fallback" v-model="tierDialog.fallbackModelId" :class="selectClass">
              <option value="">None</option>
              <option
                v-for="model in verifiedModels(tierDialog.slot).filter((m) => m.id !== tierDialog.primaryModelId)"
                :key="model.id"
                :value="model.id"
              >
                {{ model.displayName }} ({{ model.providerName }})
              </option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="tierDialog.open = false">Cancel</Button>
            <Button type="submit" :disabled="pending || !tierDialog.primaryModelId">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Trial dialog -->
    <Dialog v-model:open="trialDialog.open">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trial a {{ trialDialog.slot }} model</DialogTitle>
          <DialogDescription>Only the chosen schools get the trial model; everyone else keeps the current one.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitTrial">
          <div class="flex flex-col gap-1.5">
            <Label for="trial-model">Model</Label>
            <select id="trial-model" v-model="trialDialog.modelId" :class="selectClass" required>
              <option
                v-for="model in verifiedModels(trialDialog.slot).filter((m) => m.id !== tiers.find((t) => t.slot === trialDialog.slot)?.primary?.id)"
                :key="model.id"
                :value="model.id"
              >
                {{ model.displayName }} ({{ model.providerName }})
              </option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Schools</Label>
            <TenantMultiSelect v-model="trialDialog.tenants" />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="trialDialog.open = false">Cancel</Button>
            <Button type="submit" :disabled="pending || !trialDialog.modelId || trialDialog.tenants.length === 0">Start Trial</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Provider dialog -->
    <Dialog v-model:open="providerDialog.open">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ providerDialog.id ? 'Edit provider' : 'Add provider' }}</DialogTitle>
          <DialogDescription>An OpenAI-compatible endpoint, e.g. Alibaba Model Studio's compatible-mode URL.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitProvider">
          <div class="flex flex-col gap-1.5">
            <Label for="provider-name">Name</Label>
            <Input id="provider-name" v-model="providerDialog.name" placeholder="Model Studio (Singapore)" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="provider-endpoint">Endpoint</Label>
            <Input id="provider-endpoint" v-model="providerDialog.endpoint" placeholder="https://…/compatible-mode/v1" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="provider-key">API key</Label>
            <Input
              id="provider-key"
              v-model="providerDialog.apiKey"
              type="password"
              autocomplete="off"
              :placeholder="providerDialog.id ? 'Leave blank to keep the current key' : ''"
              :required="!providerDialog.id"
            />
            <p v-if="providerDialog.id" class="m-0 text-xs text-(--fg-4)">Changing the endpoint or key resets this provider's models; run their checks again.</p>
          </div>
          <div v-if="providerDialog.id" class="flex flex-col gap-1.5">
            <Label for="provider-status">Status</Label>
            <select id="provider-status" v-model="providerDialog.status" :class="selectClass">
              <option value="Active">Active</option>
              <option value="Disabled">Disabled (its models stop serving)</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="providerDialog.open = false">Cancel</Button>
            <Button type="submit" :disabled="pending">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Edit model dialog -->
    <Dialog v-model:open="editDialog.open">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit model</DialogTitle>
          <DialogDescription>
            Name and list prices only. To use a different model ID, provider or kind, add a new model - it gets its own checks.
          </DialogDescription>
        </DialogHeader>
        <form v-if="editDialog.model" class="flex flex-col gap-4" @submit.prevent="submitEdit">
          <dl class="m-0 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt class="text-xs text-(--fg-3)">Model ID</dt>
              <dd class="m-0 mt-0.5 font-mono text-[13px] text-(--fg-1)">{{ editDialog.model.modelId }}</dd>
            </div>
            <div>
              <dt class="text-xs text-(--fg-3)">Provider</dt>
              <dd class="m-0 mt-0.5 text-(--fg-1)">{{ editDialog.model.providerName }}</dd>
            </div>
            <div>
              <dt class="text-xs text-(--fg-3)">Kind</dt>
              <dd class="m-0 mt-0.5 text-(--fg-1)">{{ editDialog.model.kind }}</dd>
            </div>
          </dl>
          <div class="flex flex-col gap-1.5">
            <Label for="edit-model-name">Display name</Label>
            <Input id="edit-model-name" v-model="editDialog.displayName" required />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="edit-model-in">Input $ / 1M tokens</Label>
              <Input id="edit-model-in" v-model="editDialog.inputPrice" type="number" min="0" step="any" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="edit-model-out">Output $ / 1M tokens</Label>
              <Input id="edit-model-out" v-model="editDialog.outputPrice" type="number" min="0" step="any" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="editDialog.open = false">Cancel</Button>
            <Button type="submit" :disabled="pending">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Model dialog -->
    <Dialog v-model:open="modelDialog.open">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add model</DialogTitle>
          <DialogDescription>Its capability checks run straight away (a few seconds).</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitModel">
          <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <div class="flex flex-col gap-1.5">
              <Label for="model-provider">Provider</Label>
              <select id="model-provider" v-model="modelDialog.providerId" :class="selectClass" required>
                <option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="model-kind">Kind</Label>
              <select id="model-kind" v-model="modelDialog.kind" :class="selectClass">
                <option value="Chat">Chat</option>
                <option value="Embedding">Embedding</option>
              </select>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="model-id">Model ID</Label>
            <Input id="model-id" v-model="modelDialog.modelId" placeholder="qwen3.8-flash" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="model-name">Display name</Label>
            <Input id="model-name" v-model="modelDialog.displayName" placeholder="Qwen3.8 Flash" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="model-in">Input $ / 1M tokens</Label>
              <Input id="model-in" v-model="modelDialog.inputPrice" type="number" min="0" step="any" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="model-out">Output $ / 1M tokens</Label>
              <Input id="model-out" v-model="modelDialog.outputPrice" type="number" min="0" step="any" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="modelDialog.open = false">Cancel</Button>
            <Button type="submit" :disabled="checking !== null">{{ checking === 'new' ? 'Adding and checking…' : 'Add Model' }}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
