<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaKpi, RaCard, RaStatusDot } from '@roboacademy/ui'
import { MoreVertical, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import Pagination from '@/components/Pagination.vue'
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
import { usePagedList } from '@/composables/usePagedList'
import { listTenants, createTenant, deactivateTenant, reactivateTenant, type Tenant } from '@/api/tenancy'
import { enterTenant, hasPermission, isImpersonating } from '@/store/auth'

const router = useRouter()

function openTenant(tenant: Tenant) {
  router.push(`/tenants/${tenant.tenantId}`)
}

const canImpersonate = hasPermission('tenancy:impersonate')
const enteringTenantId = ref<string | null>(null)

async function submitEnterTenant(tenant: Tenant) {
  enteringTenantId.value = tenant.tenantId
  try {
    await enterTenant(tenant.tenantId, tenant.name)
    router.push('/')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to enter tenant.')
  } finally {
    enteringTenantId.value = null
  }
}

const PLATFORM_TENANT_ID = import.meta.env.VITE_PLATFORM_TENANT_ID

const {
  items: tenants,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList(listTenants, { initialPageSize: 20, errorMessage: 'Failed to load tenants.' })

const rowClass =
  'grid gap-2 grid-cols-[1.5fr_2fr_1.5fr_1fr_220px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(load)

// --- Create tenant ---
const createOpen = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({ name: '', slug: '', hostsInput: '' })
const createErrors = ref<Record<string, string[]>>({})

function resetCreateForm() {
  createForm.name = ''
  createForm.slug = ''
  createForm.hostsInput = ''
  createErrors.value = {}
}

async function submitCreate() {
  createErrors.value = {}
  createSubmitting.value = true
  try {
    const hosts = createForm.hostsInput
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
    await createTenant({
      name: createForm.name,
      slug: createForm.slug,
      hosts: hosts.length > 0 ? hosts : undefined,
    })
    toast.success('Tenant created.')
    createOpen.value = false
    resetCreateForm()
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      createErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create tenant.')
    }
  } finally {
    createSubmitting.value = false
  }
}

// --- Deactivate / reactivate ---
const togglingTenantId = ref<string | null>(null)

async function toggleActive(tenant: Tenant) {
  if (tenant.isActive && !window.confirm(`Deactivate "${tenant.name}"? Its hosts will stop resolving.`)) {
    return
  }
  togglingTenantId.value = tenant.tenantId
  try {
    if (tenant.isActive) {
      await deactivateTenant(tenant.tenantId)
      toast.success('Tenant deactivated.')
    } else {
      await reactivateTenant(tenant.tenantId)
      toast.success('Tenant reactivated.')
    }
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to update tenant.')
  } finally {
    togglingTenantId.value = null
  }
}

</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div class="flex items-start justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Tenant Management</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Provision schools, manage their hostnames, and control platform access.</p>
      </div>
      <Button @click="createOpen = true">
        <Plus :size="14" />
        Create Tenant
      </Button>
    </div>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
      <RaKpi label="Total Tenants" :value="String(meta?.totalCount ?? 0)" />
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex items-center justify-between border-b border-(--line-1) py-5 px-6">
        <h3 class="m-0 text-lg font-bold text-(--fg-1)">Tenants</h3>
      </div>

      <div
        class="grid grid-cols-[1.5fr_2fr_1.5fr_1fr_220px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden"
      >
        <span>Id</span>
        <span>Name</span>
        <span>Slug</span>
        <span>Status</span>
        <!-- <span>Hosts</span> -->
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading tenants…</p>
      <p v-else-if="tenants.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No tenants yet — create one to get started.</p>

      <div
        v-for="(tenant, i) in tenants"
        :key="tenant.tenantId"
        :class="[rowClass, i < tenants.length - 1 && 'border-b border-(--line-1)']"
      >
        <div class="text-sm font-semibold text-(--fg-1)">{{ tenant.tenantId }}</div>
        <div>
          <button
            class="cursor-pointer bg-transparent p-0 text-left text-sm font-semibold text-(--fg-1) underline-offset-2 hover:underline"
            @click="openTenant(tenant)"
          >
            {{ tenant.name }}
          </button>
        </div>
        <div class="font-mono text-[13px] text-(--fg-3)">{{ tenant.slug }}</div>
        <div>
          <RaStatusDot
            :status="tenant.isActive ? 'active' : 'offline'"
            :label="tenant.isActive ? 'Active' : 'Inactive'"
          />
        </div>
        <!-- <div class="flex">
          <RaChip tone="neutral">{{ tenant.hosts.length }} host{{ tenant.hosts.length === 1 ? '' : 's' }}</RaChip>
        </div> -->
        <div class="flex justify-end max-md:w-full max-md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem @select="openTenant(tenant)">Manage tenant</DropdownMenuItem>
              <DropdownMenuItem
                v-if="canImpersonate && tenant.tenantId !== PLATFORM_TENANT_ID && !isImpersonating()"
                :disabled="enteringTenantId === tenant.tenantId"
                @select="submitEnterTenant(tenant)"
              >
                {{ enteringTenantId === tenant.tenantId ? 'Entering…' : 'Enter tenant' }}
              </DropdownMenuItem>
              <template v-if="tenant.tenantId !== PLATFORM_TENANT_ID">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  :variant="tenant.isActive ? 'destructive' : 'default'"
                  :disabled="togglingTenantId === tenant.tenantId"
                  @select="toggleActive(tenant)"
                >
                  {{ tenant.isActive ? 'Deactivate' : 'Reactivate' }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Pagination
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-count="meta?.totalCount ?? 0"
        @update:page="goToPage"
        @update:page-size="setPageSize"
      />
    </RaCard>

    <!-- Create tenant dialog -->
    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Tenant</DialogTitle>
          <DialogDescription>Provision a new school. You can attach hostnames now or later.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitCreate">
          <div class="flex flex-col gap-1.5">
            <Label for="tenant-name">Name</Label>
            <Input id="tenant-name" v-model="createForm.name" placeholder="Acme School" required />
            <p v-for="msg in createErrors.Name" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="tenant-slug">Slug</Label>
            <Input id="tenant-slug" v-model="createForm.slug" placeholder="acme-school" required />
            <p class="m-0 text-xs text-(--fg-4)">Lower-case letters, digits, and hyphens only.</p>
            <p v-for="msg in createErrors.Slug" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="tenant-hosts">Initial hostnames (optional)</Label>
            <Input id="tenant-hosts" v-model="createForm.hostsInput" placeholder="acme.roboacademy.local, acme.example.com" />
            <p class="m-0 text-xs text-(--fg-4)">Comma-separated.</p>
            <p v-for="msg in createErrors.Hosts" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="createOpen = false">Cancel</Button>
            <Button type="submit" :disabled="createSubmitting">
              {{ createSubmitting ? 'Creating…' : 'Create Tenant' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
