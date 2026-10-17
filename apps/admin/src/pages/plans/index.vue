<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, RaKpi } from '@roboacademy/ui'
import { MoreVertical, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ApiError } from '@/api/client'
import {
  listPlans,
  createPlan,
  archivePlan,
  restorePlan,
  makeDefaultPlan,
  type Plan,
  type PlanEnforcementMode,
} from '@/api/plans'

const router = useRouter()

const plans = ref<Plan[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    plans.value = await listPlans()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load plans.')
  } finally {
    loading.value = false
  }
}

onMounted(load)

const activeCount = computed(() => plans.value.filter((p) => p.isActive).length)

// The two limits most plans are sold on, shown inline; the rest live on the plan page.
function limitSummary(plan: Plan): string {
  const fmt = (value: number | null) => (value === null ? '∞' : value.toLocaleString())
  return `${fmt(plan.limits.max_students ?? null)} students · ${fmt(plan.limits.max_courses ?? null)} courses`
}

function disabledFeatureCount(plan: Plan): number {
  return Object.values(plan.features).filter((enabled) => !enabled).length
}

const rowClass =
  'grid gap-2 grid-cols-[2fr_1fr_1fr_1.6fr_0.8fr_60px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

// --- Create plan ---
const createOpen = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({ name: '', code: '', enforcementMode: 'Hard' as PlanEnforcementMode })
const createErrors = ref<Record<string, string[]>>({})

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// The code follows the name until the admin edits it themselves.
const codeTouched = ref(false)
function onNameInput() {
  if (!codeTouched.value) createForm.code = slugify(createForm.name)
}

async function submitCreate() {
  createErrors.value = {}
  createSubmitting.value = true
  try {
    // Created with everything unlimited and every feature at its default; limits are set on the
    // plan page, where the whole catalog is laid out.
    const plan = await createPlan({
      name: createForm.name.trim(),
      code: createForm.code.trim(),
      description: null,
      enforcementMode: createForm.enforcementMode,
      defaultGraceDays: 14,
      sortOrder: (plans.value.at(-1)?.sortOrder ?? 0) + 10,
      limits: {},
      features: {},
    })
    toast.success('Plan created. Set its limits below.')
    createOpen.value = false
    router.push(`/plans/${plan.planId}`)
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      createErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create plan.')
    }
  } finally {
    createSubmitting.value = false
  }
}

function openCreate() {
  createForm.name = ''
  createForm.code = ''
  createForm.enforcementMode = 'Hard'
  createErrors.value = {}
  codeTouched.value = false
  createOpen.value = true
}

// --- Status actions ---
const pendingPlanId = ref<string | null>(null)

async function runAction(plan: Plan, action: (id: string) => Promise<unknown>, success: string) {
  pendingPlanId.value = plan.planId
  try {
    await action(plan.planId)
    toast.success(success)
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to update plan.')
  } finally {
    pendingPlanId.value = null
  }
}

function confirmArchive(plan: Plan) {
  if (!window.confirm(`Archive "${plan.name}"? Tenants already on it keep it, but it can't be assigned to new tenants.`)) {
    return
  }
  runAction(plan, archivePlan, 'Plan archived.')
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div class="flex items-start justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Subscription Plans</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Define what each tier includes, then assign schools to it from their setup page.</p>
      </div>
      <Button @click="openCreate">
        <Plus :size="14" />
        New Plan
      </Button>
    </div>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
      <RaKpi label="Active Plans" :value="String(activeCount)" />
      <RaKpi label="Archived" :value="String(plans.length - activeCount)" />
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex items-center justify-between border-b border-(--line-1) py-5 px-6">
        <h3 class="m-0 text-lg font-bold text-(--fg-1)">Plans</h3>
      </div>

      <div
        class="grid grid-cols-[2fr_1fr_1fr_1.6fr_0.8fr_60px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden"
      >
        <span>Name</span>
        <span>Code</span>
        <span>When full</span>
        <span>Limits</span>
        <span>Tenants</span>
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading plans…</p>
      <p v-else-if="plans.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No plans yet.</p>

      <div
        v-for="(plan, i) in plans"
        :key="plan.planId"
        :class="[rowClass, i < plans.length - 1 && 'border-b border-(--line-1)', !plan.isActive && 'opacity-60']"
      >
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="cursor-pointer bg-transparent p-0 text-left text-sm font-semibold text-(--fg-1) underline-offset-2 hover:underline"
            @click="router.push(`/plans/${plan.planId}`)"
          >
            {{ plan.name }}
          </button>
          <RaChip v-if="plan.isDefault" tone="info">Default</RaChip>
          <RaChip v-if="!plan.isActive" tone="neutral">Archived</RaChip>
        </div>
        <div class="font-mono text-[13px] text-(--fg-3)">{{ plan.code }}</div>
        <div class="text-[13px] text-(--fg-2)">
          {{ plan.enforcementMode === 'Hard' ? 'Block' : 'Warn' }}
        </div>
        <div class="text-[13px] text-(--fg-2)">
          {{ limitSummary(plan) }}
          <span v-if="disabledFeatureCount(plan) > 0" class="text-(--fg-4)">
            · {{ disabledFeatureCount(plan) }} feature{{ disabledFeatureCount(plan) === 1 ? '' : 's' }} off
          </span>
        </div>
        <div class="text-sm font-semibold text-(--fg-1)">{{ plan.tenantCount }}</div>
        <div class="flex justify-end max-md:w-full max-md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-lg border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem @select="router.push(`/plans/${plan.planId}`)">Edit plan</DropdownMenuItem>
              <DropdownMenuItem
                v-if="plan.isActive && !plan.isDefault"
                :disabled="pendingPlanId === plan.planId"
                @select="runAction(plan, makeDefaultPlan, 'Default plan changed.')"
              >
                Make default
              </DropdownMenuItem>
              <template v-if="!plan.isDefault">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  v-if="plan.isActive"
                  variant="destructive"
                  :disabled="pendingPlanId === plan.planId"
                  @select="confirmArchive(plan)"
                >
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-else
                  :disabled="pendingPlanId === plan.planId"
                  @select="runAction(plan, restorePlan, 'Plan restored.')"
                >
                  Restore
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </RaCard>

    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Plan</DialogTitle>
          <DialogDescription>Starts with no limits; you'll set them on the next screen.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitCreate">
          <div class="flex flex-col gap-1.5">
            <Label for="plan-name">Name</Label>
            <Input id="plan-name" v-model="createForm.name" placeholder="School" required @input="onNameInput" />
            <p v-for="msg in createErrors.Name" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="plan-code">Code</Label>
            <Input id="plan-code" v-model="createForm.code" placeholder="school" required @input="codeTouched = true" />
            <p class="m-0 text-xs text-(--fg-4)">Lower-case letters, digits, and hyphens only.</p>
            <p v-for="msg in createErrors.Code" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
            <legend class="mb-1.5 text-sm font-medium text-(--fg-1)">When a school reaches a limit</legend>
            <label class="flex items-start gap-2.5 text-sm text-(--fg-1)">
              <input v-model="createForm.enforcementMode" type="radio" value="Hard" class="mt-0.5 size-4 accent-(--primary)">
              <span>Block<span class="block text-xs text-(--fg-3)">Creation is refused until they upgrade or free space.</span></span>
            </label>
            <label class="flex items-start gap-2.5 text-sm text-(--fg-1)">
              <input v-model="createForm.enforcementMode" type="radio" value="Soft" class="mt-0.5 size-4 accent-(--primary)">
              <span>Warn<span class="block text-xs text-(--fg-3)">Creation goes through; the school is flagged as over its limit.</span></span>
            </label>
          </fieldset>
          <DialogFooter>
            <Button variant="outline" type="button" @click="createOpen = false">Cancel</Button>
            <Button type="submit" :disabled="createSubmitting">
              {{ createSubmitting ? 'Creating…' : 'Create Plan' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
