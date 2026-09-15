<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, RaStatusDot, formatDate } from '@roboacademy/ui'
import { ShieldCheck, X, PauseCircle, PlayCircle, ImageUp, ChevronDown, LogIn } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import UserPreviewPopover from '@/components/UserPreviewPopover.vue'
import AuditLogFilters, { type AuditLogFilterState } from '@/components/AuditLogFilters.vue'
import { ApiError, postImpersonationToken } from '@/api/client'
import { enterTenant, hasPermission, isImpersonating } from '@/store/auth'
import {
  getTenant,
  updateTenant,
  deactivateTenant,
  reactivateTenant,
  addHost,
  removeHost,
  verifyHost,
  getTenantBranding,
  updateTenantBranding,
  uploadTenantLogo,
  uploadTenantFeatureImage,
  getTenantAuditLog,
  type Tenant,
  type AuditLogItem,
} from '@/api/tenancy'
import { createTenantAdmin } from '@/api/identity'
import { applyTenantBranding } from '@/branding'

const PLATFORM_TENANT_ID = import.meta.env.VITE_PLATFORM_TENANT_ID

const route = useRoute()
const router = useRouter()
const tenantId = computed(() => String(route.params.tenantId))
const isPlatformTenant = computed(() => tenantId.value === PLATFORM_TENANT_ID)

const canManage = hasPermission('tenancy:manage')
const canManageOwn = canManage || hasPermission('tenancy:manage-own')
const canImpersonate = hasPermission('tenancy:impersonate')

const sections = [
  { id: 'general', label: 'General' },
  { id: 'hosts', label: 'Hosts' },
  { id: 'branding', label: 'Branding' },
  ...(canImpersonate ? [{ id: 'admin-access', label: 'Admin Access' }] : []),
  ...(canManageOwn ? [{ id: 'activity', label: 'Activity' }] : []),
]

const tenant = ref<Tenant | null>(null)
const loading = ref(true)
const notFound = ref(false)

// Collapsed by default - each section owns its own collapse state.
const generalOpen = ref(false)
const hostsOpen = ref(false)
const brandingOpen = ref(false)
const adminAccessOpen = ref(false)
const activityOpen = ref(false)

async function loadTenant() {
  loading.value = true
  notFound.value = false
  try {
    tenant.value = await getTenant(tenantId.value)
    generalForm.name = tenant.value.name
    generalForm.slug = tenant.value.slug
    generalForm.allowRegistration = tenant.value.allowRegistration
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load tenant.')
    }
    notFound.value = true
  } finally {
    loading.value = false
  }
}

// --- General (name / slug) ---
const generalSubmitting = ref(false)
const generalForm = reactive({ name: '', slug: '', allowRegistration: true })
const generalErrors = ref<Record<string, string[]>>({})

async function submitGeneral() {
  if (!tenant.value) return
  generalErrors.value = {}
  generalSubmitting.value = true
  try {
    const updated = await updateTenant(tenant.value.tenantId, {
      name: generalForm.name.trim(),
      slug: generalForm.slug.trim(),
      allowRegistration: generalForm.allowRegistration,
    })
    tenant.value = {
      ...tenant.value,
      name: updated.name,
      slug: updated.slug,
      allowRegistration: updated.allowRegistration,
    }
    toast.success('Tenant updated.')
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      generalErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update tenant.')
    }
  } finally {
    generalSubmitting.value = false
  }
}

// --- Enter tenant ---
const enteringTenant = ref(false)

async function submitEnterTenant() {
  if (!tenant.value) return
  enteringTenant.value = true
  try {
    await enterTenant(tenant.value.tenantId, tenant.value.name)
    router.push('/')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to enter tenant.')
  } finally {
    enteringTenant.value = false
  }
}

// --- Deactivate / reactivate ---
const togglingActive = ref(false)

async function toggleActive() {
  if (!tenant.value) return
  if (tenant.value.isActive && !window.confirm(`Deactivate "${tenant.value.name}"? Its hosts will stop resolving.`)) {
    return
  }
  togglingActive.value = true
  try {
    if (tenant.value.isActive) {
      await deactivateTenant(tenant.value.tenantId)
      tenant.value = { ...tenant.value, isActive: false }
      toast.success('Tenant deactivated.')
    } else {
      await reactivateTenant(tenant.value.tenantId)
      tenant.value = { ...tenant.value, isActive: true }
      toast.success('Tenant reactivated.')
    }
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to update tenant.')
  } finally {
    togglingActive.value = false
  }
}

// --- Hosts ---
const newHost = ref('')
const hostActionPending = ref(false)

async function submitAddHost() {
  if (!tenant.value || !newHost.value.trim()) return
  hostActionPending.value = true
  try {
    const response = await addHost(tenant.value.tenantId, newHost.value.trim())
    tenant.value = { ...tenant.value, hosts: response.hosts }
    newHost.value = ''
    toast.success('Host attached.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to add host.')
  } finally {
    hostActionPending.value = false
  }
}

async function submitRemoveHost(host: string) {
  if (!tenant.value) return
  hostActionPending.value = true
  try {
    const response = await removeHost(tenant.value.tenantId, host)
    tenant.value = { ...tenant.value, hosts: response.hosts }
    toast.success('Host detached.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to remove host.')
  } finally {
    hostActionPending.value = false
  }
}

async function submitVerifyHost(host: string) {
  if (!tenant.value) return
  hostActionPending.value = true
  try {
    const response = await verifyHost(tenant.value.tenantId, host)
    tenant.value = { ...tenant.value, hosts: response.hosts }
    toast.success('Host verified.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to verify host.')
  } finally {
    hostActionPending.value = false
  }
}

// --- Branding ---
const brandingLoading = ref(true)
const brandingSubmitting = ref(false)
const brandingForm = reactive({
  logoUrl: '',
  primaryColor: '',
  secondaryColor: '',
  welcomeMessage: '',
  featureImageUrl: '',
  tagline: '',
})
const brandingErrors = ref<Record<string, string[]>>({})
const logoUploading = ref(false)
const logoFileInput = ref<HTMLInputElement | null>(null)
const featureImageUploading = ref(false)
const featureImageFileInput = ref<HTMLInputElement | null>(null)

async function loadBranding() {
  brandingLoading.value = true
  brandingErrors.value = {}
  try {
    const branding = await getTenantBranding(tenantId.value)
    brandingForm.logoUrl = branding.logoUrl ?? ''
    brandingForm.primaryColor = branding.primaryColor ?? ''
    brandingForm.secondaryColor = branding.secondaryColor ?? ''
    brandingForm.welcomeMessage = branding.welcomeMessage ?? ''
    brandingForm.featureImageUrl = branding.featureImageUrl ?? ''
    brandingForm.tagline = branding.tagline ?? ''
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load branding.')
  } finally {
    brandingLoading.value = false
  }
}

async function submitBranding() {
  brandingErrors.value = {}
  brandingSubmitting.value = true
  try {
    await updateTenantBranding(tenantId.value, {
      logoUrl: brandingForm.logoUrl.trim() || null,
      primaryColor: brandingForm.primaryColor.trim() || null,
      secondaryColor: brandingForm.secondaryColor.trim() || null,
      welcomeMessage: brandingForm.welcomeMessage.trim() || null,
      featureImageUrl: brandingForm.featureImageUrl.trim() || null,
      tagline: brandingForm.tagline.trim() || null,
    })
    toast.success('Branding updated.')
    await applyTenantBranding();
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      brandingErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update branding.')
    }
  } finally {
    brandingSubmitting.value = false
  }
}

async function onLogoFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  logoUploading.value = true
  try {
    const result = await uploadTenantLogo(tenantId.value, file)
    brandingForm.logoUrl = result.logoUrl
    await submitBranding()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to upload logo.')
  } finally {
    logoUploading.value = false
  }
}

async function onFeatureImageFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  featureImageUploading.value = true
  try {
    const result = await uploadTenantFeatureImage(tenantId.value, file)
    brandingForm.featureImageUrl = result.featureImageUrl
    await submitBranding()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to upload feature image.')
  } finally {
    featureImageUploading.value = false
  }
}

// --- Create admin (bootstrap a tenant that has no users yet) ---
const createAdminSubmitting = ref(false)
const createAdminForm = reactive({ email: '', password: '', firstName: '', lastName: '' })
const createAdminErrors = ref<Record<string, string[]>>({})

async function submitCreateAdmin() {
  createAdminErrors.value = {}
  createAdminSubmitting.value = true
  try {
    const impersonation = await postImpersonationToken(tenantId.value)
    await createTenantAdmin(tenantId.value, impersonation.access_token, {
      email: createAdminForm.email,
      password: createAdminForm.password,
      firstName: createAdminForm.firstName,
      lastName: createAdminForm.lastName,
    })
    toast.success('Admin created.')
    createAdminForm.email = ''
    createAdminForm.password = ''
    createAdminForm.firstName = ''
    createAdminForm.lastName = ''
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      createAdminErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create admin.')
    }
  } finally {
    createAdminSubmitting.value = false
  }
}

// --- Activity (audit log) ---
const auditItems = ref<AuditLogItem[]>([])
const auditLoading = ref(false)
const auditPage = ref(1)
const auditTotalCount = ref(0)
const auditPageSize = 20
const hasMoreAudit = computed(() => auditItems.value.length < auditTotalCount.value)
const auditFilters = ref<AuditLogFilterState>({ userId: null, fromDate: '', toDate: '', entityType: '', action: '' })
const TENANCY_ENTITY_TYPES = [
  { value: 'Tenant', label: 'Tenant' },
  { value: 'TenantHost', label: 'Tenant Host' },
]
let auditFilterDebounce: ReturnType<typeof setTimeout> | undefined

async function loadAudit(page = 1) {
  auditLoading.value = true
  try {
    const result = await getTenantAuditLog(tenantId.value, page, auditPageSize, auditFilters.value)
    auditItems.value = page === 1 ? result.items : [...auditItems.value, ...result.items]
    auditTotalCount.value = result.meta.totalCount
    auditPage.value = page
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load activity.')
  } finally {
    auditLoading.value = false
  }
}

watch(auditFilters, () => {
  clearTimeout(auditFilterDebounce)
  auditFilterDebounce = setTimeout(() => loadAudit(1), 300)
}, { deep: true })

onMounted(async () => {
  await loadTenant()
  if (notFound.value) return
  await loadBranding()
  if (canManageOwn) await loadAudit(1)
})

watch(tenantId, async () => {
  await loadTenant()
  if (notFound.value) return
  await loadBranding()
  if (canManageOwn) await loadAudit(1)
})
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-6 pt-8 px-8 pb-16 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <!-- <button
      class="inline-flex w-fit items-center gap-1.5 text-sm text-(--fg-3) transition-colors hover:text-(--fg-1)"
      @click="router.push('/tenants')"
    >
      <ArrowLeft :size="14" /> Back to Tenants
    </button> -->

    <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading tenant…</p>

    <template v-else-if="notFound">
      <RaCard class="p-10 text-center">
        <p class="m-0 text-sm text-(--fg-3)">Tenant not found.</p>
      </RaCard>
    </template>

    <template v-else-if="tenant">
      <div class="flex items-start justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">{{ tenant.name }}</h1>
            <RaStatusDot :status="tenant.isActive ? 'active' : 'offline'" :label="tenant.isActive ? 'Active' : 'Inactive'" />
          </div>
          <p class="mt-1.5 font-mono text-sm text-(--fg-3)">{{ tenant.slug }}</p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="canImpersonate && !isPlatformTenant && !isImpersonating()"
            variant="outline"
            :disabled="enteringTenant"
            @click="submitEnterTenant"
          >
            <LogIn :size="14" />
            {{ enteringTenant ? 'Entering…' : 'Enter Tenant' }}
          </Button>
          <Button
            v-if="canManage && !isPlatformTenant"
            :variant="tenant.isActive ? 'secondary' : 'default'"
            :disabled="togglingActive"
            @click="toggleActive"
          >
            <PauseCircle v-if="tenant.isActive" :size="14" />
            <PlayCircle v-else :size="14" />
            {{ togglingActive ? 'Working…' : tenant.isActive ? 'Deactivate Tenant' : 'Reactivate Tenant' }}
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-[180px_1fr] gap-8 max-xl:grid-cols-1 max-xl:gap-6">
        <!-- Section nav -->
        <nav class="sticky top-0 flex h-fit flex-col gap-1 max-xl:hidden">
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="rounded-(--ra-md) px-3 py-2 text-sm text-(--fg-3) transition-colors hover:bg-(--bg-3) hover:text-(--fg-1)"
          >
            {{ section.label }}
          </a>
        </nav>

        <div class="flex flex-col gap-6">
          <!-- General -->
          <RaCard id="general" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="generalOpen">
              <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
                <div>
                  <h3 class="m-0 text-lg font-bold text-(--fg-1)">General</h3>
                  <p class="m-0 mt-1 text-xs text-(--fg-3)">Core identifiers for this tenant.</p>
                </div>
                <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="generalOpen && 'rotate-180'" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="py-5 px-6">
                  <form class="flex flex-col gap-4" @submit.prevent="submitGeneral">
                    <div class="flex flex-col gap-1.5">
                      <Label>Tenant Id</Label>
                      <p class="m-0 font-mono text-[13px] text-(--fg-3)">{{ tenant.tenantId }}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                      <div class="flex flex-col gap-1.5">
                        <Label for="general-name">Name</Label>
                        <Input id="general-name" v-model="generalForm.name" placeholder="Acme School" required />
                        <p v-for="msg in generalErrors.Name" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <Label for="general-slug">Slug</Label>
                        <Input id="general-slug" v-model="generalForm.slug" placeholder="acme-school" required />
                        <p class="m-0 text-xs text-(--fg-4)">Lower-case letters, digits, and hyphens only.</p>
                        <p v-for="msg in generalErrors.Slug" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                      </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label>Status</Label>
                      <div>
                        <RaChip :tone="tenant.isActive ? 'info' : 'neutral'">{{ tenant.isActive ? 'Active' : 'Inactive' }}</RaChip>
                      </div>
                    </div>
                    <label class="flex items-center gap-2.5 text-sm text-(--fg-1)" for="general-allow-registration">
                      <input
                        id="general-allow-registration"
                        v-model="generalForm.allowRegistration"
                        type="checkbox"
                        class="size-4 cursor-pointer accent-(--primary)"
                      >
                      Allow user registration
                    </label>
                    <p class="m-0 -mt-2.5 text-xs text-(--fg-4)">
                      When off, this tenant's login page hides the register option.
                    </p>
                    <div class="flex justify-end">
                      <Button type="submit" :disabled="generalSubmitting">
                        {{ generalSubmitting ? 'Saving…' : 'Save Changes' }}
                      </Button>
                    </div>
                  </form>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </RaCard>

          <!-- Hosts -->
          <RaCard id="hosts" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="hostsOpen">
              <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
                <div>
                  <h3 class="m-0 text-lg font-bold text-(--fg-1)">Hosts</h3>
                  <p class="m-0 mt-1 text-xs text-(--fg-3)">Hostnames that resolve to this tenant.</p>
                </div>
                <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="hostsOpen && 'rotate-180'" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="py-5 px-6">
                  <ul class="m-0 flex list-none flex-col gap-2 p-0">
                    <li
                      v-for="host in tenant.hosts"
                      :key="host.host"
                      class="flex items-center gap-2.5 border-b border-(--line-1) py-2 last:border-b-0"
                    >
                      <span class="flex-1 font-mono text-[13px] text-(--fg-1)">{{ host.host }}</span>
                      <ShieldCheck v-if="host.isVerified" :size="14" class="text-(--success)" />
                      <RaChip v-else tone="neutral">Unverified</RaChip>
                      <div class="flex gap-1.5">
                        <Button
                          v-if="!host.isVerified"
                          variant="outline"
                          size="sm"
                          :disabled="hostActionPending"
                          @click="submitVerifyHost(host.host)"
                        >
                          Verify
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          :disabled="hostActionPending"
                          @click="submitRemoveHost(host.host)"
                        >
                          <X :size="14" />
                        </Button>
                      </div>
                    </li>
                    <li v-if="tenant.hosts.length === 0" class="py-4 text-center text-[13px] text-(--fg-3)">No hosts attached.</li>
                  </ul>

                  <form class="mt-4 flex gap-2" @submit.prevent="submitAddHost">
                    <Input v-model="newHost" placeholder="new-host.example.com" class="flex-1" />
                    <Button type="submit" :disabled="hostActionPending || !newHost.trim()">Add host</Button>
                  </form>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </RaCard>

          <!-- Branding -->
          <RaCard id="branding" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="brandingOpen">
              <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
                <div>
                  <h3 class="m-0 text-lg font-bold text-(--fg-1)">Branding</h3>
                  <p class="m-0 mt-1 text-xs text-(--fg-3)">
                    Logo, feature image, theme colors, and the welcome message/tagline shown on this tenant's login page.
                    Leave a field blank to clear it.
                  </p>
                </div>
                <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="brandingOpen && 'rotate-180'" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="py-5 px-6">
                  <p v-if="brandingLoading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading current branding…</p>
                  <form v-else class="flex flex-col gap-4" @submit.prevent="submitBranding">
                    <div class="flex flex-col gap-1.5">
                      <Label for="branding-logo">Logo</Label>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) disabled:pointer-events-none disabled:opacity-50"
                          :disabled="logoUploading"
                          @click="logoFileInput?.click()"
                        >
                          <img v-if="brandingForm.logoUrl" :src="brandingForm.logoUrl" alt="Logo preview" class="size-full object-contain">
                          <ImageUp v-else :size="16" class="text-(--fg-3)" />
                        </button>
                        <Input
                          id="branding-logo"
                          v-model="brandingForm.logoUrl"
                          placeholder="https://acme.example.com/logo.png or upload a file"
                          class="flex-1"
                        />
                        <input
                          ref="logoFileInput"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          class="hidden"
                          @change="onLogoFileSelected"
                        >
                      </div>
                      <p v-if="logoUploading" class="m-0 text-xs text-(--fg-3)">Uploading…</p>
                      <p v-for="msg in brandingErrors.LogoUrl" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="branding-feature-image">Feature Image</Label>
                      <p class="m-0 text-xs text-(--fg-4)">The hero image shown beside the login form on this tenant's login page.</p>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) disabled:pointer-events-none disabled:opacity-50"
                          :disabled="featureImageUploading"
                          @click="featureImageFileInput?.click()"
                        >
                          <img
                            v-if="brandingForm.featureImageUrl"
                            :src="brandingForm.featureImageUrl"
                            alt="Feature image preview"
                            class="size-full object-cover"
                          >
                          <ImageUp v-else :size="16" class="text-(--fg-3)" />
                        </button>
                        <Input
                          id="branding-feature-image"
                          v-model="brandingForm.featureImageUrl"
                          placeholder="https://acme.example.com/feature.jpg or upload a file"
                          class="flex-1"
                        />
                        <input
                          ref="featureImageFileInput"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          class="hidden"
                          @change="onFeatureImageFileSelected"
                        >
                      </div>
                      <p v-if="featureImageUploading" class="m-0 text-xs text-(--fg-3)">Uploading…</p>
                      <p v-for="msg in brandingErrors.FeatureImageUrl" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                      <div class="flex flex-col gap-1.5">
                        <Label for="branding-primary">Primary Color</Label>
                        <div class="flex items-center gap-2">
                          <input
                            v-model="brandingForm.primaryColor"
                            type="color"
                            class="size-9 shrink-0 cursor-pointer rounded-(--ra-md) border border-(--line-2) bg-transparent p-0.5"
                          >
                          <Input id="branding-primary" v-model="brandingForm.primaryColor" placeholder="#3B82F6" class="flex-1" />
                        </div>
                        <p v-for="msg in brandingErrors.PrimaryColor" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <Label for="branding-secondary">Secondary Color</Label>
                        <div class="flex items-center gap-2">
                          <input
                            v-model="brandingForm.secondaryColor"
                            type="color"
                            class="size-9 shrink-0 cursor-pointer rounded-(--ra-md) border border-(--line-2) bg-transparent p-0.5"
                          >
                          <Input id="branding-secondary" v-model="brandingForm.secondaryColor" placeholder="#7C5CFF" class="flex-1" />
                        </div>
                        <p v-for="msg in brandingErrors.SecondaryColor" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                      </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="branding-tagline">Tagline</Label>
                      <p class="m-0 text-xs text-(--fg-4)">A short motto shown over the feature image on the login page.</p>
                      <Input
                        id="branding-tagline"
                        v-model="brandingForm.tagline"
                        placeholder="Affordable higher education you can take wherever life takes you."
                      />
                      <p v-for="msg in brandingErrors.Tagline" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="branding-welcome">Welcome Message</Label>
                      <textarea
                        id="branding-welcome"
                        v-model="brandingForm.welcomeMessage"
                        rows="3"
                        placeholder="Welcome back! Sign in to continue your courses."
                        class="w-full resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-sans text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)"
                      />
                      <p v-for="msg in brandingErrors.WelcomeMessage" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                    </div>
                    <div class="flex justify-end">
                      <Button type="submit" :disabled="brandingSubmitting">
                        {{ brandingSubmitting ? 'Saving…' : 'Save Branding' }}
                      </Button>
                    </div>
                  </form>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </RaCard>

         <!-- Admin access -->
          <RaCard v-if="canImpersonate" id="admin-access" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="adminAccessOpen">
              <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
                <div>
                  <h3 class="m-0 text-lg font-bold text-(--fg-1)">Admin Access</h3>
                  <p class="m-0 mt-1 text-xs text-(--fg-3)">
                    Create the first SchoolAdmin for this tenant, so it can be managed and logged into going forward.
                  </p>
                </div>
                <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="adminAccessOpen && 'rotate-180'" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="py-5 px-6">
                  <form class="flex flex-col gap-4" @submit.prevent="submitCreateAdmin">
                    <div class="flex flex-col gap-1.5">
                      <Label for="create-admin-email">Email</Label>
                      <Input id="create-admin-email" v-model="createAdminForm.email" type="email" placeholder="principal@acme.edu" required />
                      <p v-for="msg in createAdminErrors.Email" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label for="create-admin-password">Password</Label>
                      <Input id="create-admin-password" v-model="createAdminForm.password" type="password" required />
                      <p class="m-0 text-xs text-(--fg-4)">Min. 8 characters.</p>
                      <p v-for="msg in createAdminErrors.Password" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                      <div class="flex flex-col gap-1.5">
                        <Label for="create-admin-first-name">First Name</Label>
                        <Input id="create-admin-first-name" v-model="createAdminForm.firstName" required />
                        <p v-for="msg in createAdminErrors.FirstName" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <Label for="create-admin-last-name">Last Name</Label>
                        <Input id="create-admin-last-name" v-model="createAdminForm.lastName" required />
                        <p v-for="msg in createAdminErrors.LastName" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
                      </div>
                    </div>
                    <div class="flex justify-end">
                      <Button type="submit" :disabled="createAdminSubmitting">
                        {{ createAdminSubmitting ? 'Creating…' : 'Create Admin' }}
                      </Button>
                    </div>
                  </form>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </RaCard>

          <!-- Activity -->
          <RaCard v-if="canManageOwn" id="activity" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="activityOpen">
              <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
                <div>
                  <h3 class="m-0 text-lg font-bold text-(--fg-1)">Activity</h3>
                  <p class="m-0 mt-1 text-xs text-(--fg-3)">Recent changes to this tenant, its hosts, and its branding.</p>
                </div>
                <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="activityOpen && 'rotate-180'" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <AuditLogFilters v-model="auditFilters" :entity-type-options="TENANCY_ENTITY_TYPES" />
                <div>
                  <p v-if="auditLoading && auditItems.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">Loading activity…</p>
                  <p v-else-if="auditItems.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No activity recorded yet.</p>
                  <ul v-else class="m-0 flex list-none flex-col p-0">
                    <li
                      v-for="item in auditItems"
                      :key="item.id"
                      class="flex items-start justify-between gap-3 border-b border-(--line-1) py-3 px-6 last:border-b-0 flex-col"
                    >
                      <div>
                        <div class="flex flex-wrap items-center gap-1.5 text-sm text-(--fg-1)">
                          <span class="font-semibold">{{ item.action }}</span> — {{ item.entityType }}
                          <UserPreviewPopover v-if="item.userId" :user-id="item.userId" />
                          <span v-else class="text-xs text-(--fg-4)">System</span>
                        </div>
                        <div v-if="item.changes" class="mt-1 font-mono text-xs text-(--fg-4) ">{{ item.changes }}</div>
                      </div>
                      <span class="shrink-0 text-xs text-(--fg-3)">{{ formatDate(item.occurredAt) }}</span>
                    </li>
                  </ul>
                  <div v-if="hasMoreAudit" class="flex justify-center border-t border-(--line-1) py-3">
                    <Button variant="ghost" size="sm" :disabled="auditLoading" @click="loadAudit(auditPage + 1)">
                      {{ auditLoading ? 'Loading…' : 'Load more' }}
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </RaCard>
        </div>
      </div>
    </template>
  </div>
</template>
