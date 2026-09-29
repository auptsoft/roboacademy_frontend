<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { RaKpi, RaCard, RaChip, RaStatusDot, formatDate } from '@roboacademy/ui'
import { ArrowRight, Building2, Users as UsersIcon, History } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import UserPreviewPopover from '@/components/UserPreviewPopover.vue'
import type { PageMeta } from '@/api/client'
import { listTenants, type Tenant } from '@/api/tenancy'
import { listUsers, getIdentityAuditLog, type AdminUser, type IdentityAuditLogItem } from '@/api/identity'
import { listCourseCatalog, listLiveClasses } from '@/api/learning'
import { listCertificates } from '@/api/certification'
import { listSessions } from '@/api/roboticsLab'
import { listAttempts } from '@/api/assessment'
import { hasPermission, getImpersonationTarget } from '@/store/auth'
import { getTenantId } from '@/api/session'
import { getEnv } from '@/lib/runtime-env'
import { useCachedQuery } from '@/composables/useCachedQuery'

const router = useRouter()

const PLATFORM_TENANT_ID = getEnv('VITE_PLATFORM_TENANT_ID')

const {
  data: tenantsData, loading: tenantsLoading, error: tenantsError,
} = useCachedQuery('dashboard:tenants', () => listTenants(1, 5), {
  enabled: hasPermission('tenancy:manage'),
  errorMessage: 'Failed to load tenants.',
})
const tenants = computed<Tenant[]>(() => tenantsData.value?.items ?? [])
const totalTenants = computed(() => tenantsData.value?.meta.totalCount ?? 0)

const {
  data: usersData, loading: usersLoading, error: usersError,
} = useCachedQuery('dashboard:users', () => listUsers(1, 5), {
  enabled: hasPermission('identity:users:manage'),
  errorMessage: 'Failed to load users.',
})
const users = computed<AdminUser[]>(() => usersData.value?.items ?? [])
const totalUsers = computed(() => usersData.value?.meta.totalCount ?? 0)

const storedTenantId = getTenantId()
const isPlatformWide = computed(() => PLATFORM_TENANT_ID === storedTenantId)
const impersonation = computed(() => getImpersonationTarget())

const subtitle = computed(() => {
  if (impersonation.value) return `Viewing ${impersonation.value.tenantName}.`
  if (isPlatformWide.value) return 'An overview of your platform.'
  return 'An overview of your school.'
})

// Dashboard only surfaces the platform tenant's own info here — other tenants' names/slugs
// aren't listed on this overview (they're fully visible on the dedicated Tenants page).
const previewTenants = computed(() => tenants.value.filter((t) => t.tenantId !== PLATFORM_TENANT_ID))
const previewUsers = computed(() => users.value)

const roleTone: Record<string, 'admin' | 'instructor' | 'student' | 'neutral'> = {
  PlatformAdmin: 'admin',
  SchoolAdmin: 'admin',
  RobotLabAdmin: 'admin',
  PlatformSupport: 'admin',
  Teacher: 'instructor',
  TeachingAssistant: 'instructor',
  Student: 'student',
  Individual: 'neutral',
  Guest: 'neutral',
}

// --- Module KPI tiles (each tenant-scoped to whichever tenant is currently active) ---
// A failed count shows as '—' (null) rather than an error message.
function useCount(key: string, fetcher: () => Promise<{ meta: PageMeta }>, enabled = true) {
  const { data } = useCachedQuery(`dashboard:count:${key}`, fetcher, { enabled })
  return computed(() => data.value?.meta.totalCount ?? null)
}

const totalCourses = useCount('courses', () => listCourseCatalog({}, 1, 1))
const totalLiveClasses = useCount('live-classes', () => listLiveClasses(undefined, 1, 1))
const totalCertificates = useCount(
  'certificates', () => listCertificates({}, 1, 1), hasPermission('certification:certificates:issue'),
)
const totalRoboticsSessions = useCount(
  'robotics-sessions', () => listSessions({}, 1, 1), hasPermission('roboticslab:robots:manage'),
)
const totalPendingGrading = useCount(
  'pending-grading', () => listAttempts({ status: 'Submitted' }, 1, 1), hasPermission('assessment:assessments:author'),
)

// --- Recent activity ---
const {
  data: activityData, loading: activityLoading, error: activityError,
} = useCachedQuery('dashboard:activity', () => getIdentityAuditLog(1, 8), {
  enabled: hasPermission('identity:audit:view'),
  errorMessage: 'Failed to load activity.',
})
const activity = computed<IdentityAuditLogItem[]>(() => activityData.value?.items ?? [])
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Dashboard</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">{{ subtitle }}</p>
    </div>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
      <RaKpi v-if="isPlatformWide" label="Total Tenants" :value="String(totalTenants)" class="ring-1 ring-inset ring-(--brand-blue-ring)" />
      <RaKpi label="Total Users" :value="String(totalUsers)" class="ring-1 ring-inset ring-(--brand-blue-ring)" />
      <RaKpi label="Courses" :value="totalCourses === null ? '—' : String(totalCourses)" class="ring-1 ring-inset ring-(--brand-blue-ring)" />
      <RaKpi label="Live Classes" :value="totalLiveClasses === null ? '—' : String(totalLiveClasses)" class="ring-1 ring-inset ring-(--brand-blue-ring)" />
      <RaKpi v-if="hasPermission('assessment:assessments:author')" label="Pending Grading" :value="totalPendingGrading === null ? '—' : String(totalPendingGrading)" class="ring-1 ring-inset ring-(--brand-blue-ring)" />
      <RaKpi v-if="hasPermission('certification:certificates:issue')" label="Certificates Issued" :value="totalCertificates === null ? '—' : String(totalCertificates)" class="ring-1 ring-inset ring-(--brand-blue-ring)" />
      <RaKpi v-if="hasPermission('roboticslab:robots:manage')" label="Robotics Sessions" :value="totalRoboticsSessions === null ? '—' : String(totalRoboticsSessions)" class="ring-1 ring-inset ring-(--brand-blue-ring)" />
    </div>

    <div class="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
      <RaCard v-if="isPlatformWide" :padding="0" class="relative overflow-hidden ring-1 ring-inset ring-(--brand-blue-ring)">
        <div class="pointer-events-none absolute -top-20 -right-20 -z-10 h-56 w-56 rounded-full bg-(--brand-blue-soft) blur-3xl" aria-hidden="true" />
        <div class="absolute inset-x-0 top-0 h-0.75 bg-primary" aria-hidden="true" />
        <div class="flex items-center justify-between border-b border-(--line-1) py-5 px-6">
          <div class="flex items-center gap-2.5">
            <span class="flex size-7 items-center justify-center rounded-full bg-(--brand-blue-soft) text-primary">
              <Building2 :size="14" />
            </span>
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Tenants</h3>
          </div>
          <Button variant="ghost" size="sm" @click="router.push('/tenants')">
            View all <ArrowRight :size="14" />
          </Button>
        </div>

        <p v-if="tenantsLoading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading…</p>
        <p v-else-if="tenantsError" class="p-6 text-center text-[13px] text-(--danger)">{{ tenantsError }}</p>
        <p v-else-if="previewTenants.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No tenants yet.</p>
        <ul v-else class="m-0 flex list-none flex-col p-0">
          <li
            v-for="tenant in previewTenants"
            :key="tenant.tenantId"
            class="flex items-center justify-between border-b border-(--line-1) py-3 px-6 last:border-b-0"
          >
            <div>
              <div class="text-sm font-semibold text-(--fg-1)">{{ tenant.name }}</div>
              <div class="font-mono text-xs text-(--fg-3)">{{ tenant.slug }}</div>
            </div>
            <RaStatusDot
              :status="tenant.isActive ? 'active' : 'offline'"
              :label="tenant.isActive ? 'Active' : 'Inactive'"
            />
          </li>
        </ul>
      </RaCard>

      <RaCard :padding="0" class="relative overflow-hidden ring-1 ring-inset ring-(--brand-blue-ring)">
        <div class="pointer-events-none absolute -top-20 -right-20 -z-10 h-56 w-56 rounded-full bg-(--brand-blue-soft) blur-3xl" aria-hidden="true" />
        <div class="absolute inset-x-0 top-0 h-0.75 bg-primary" aria-hidden="true" />
        <div class="flex items-center justify-between border-b border-(--line-1) py-5 px-6">
          <div class="flex items-center gap-2.5">
            <span class="flex size-7 items-center justify-center rounded-full bg-(--brand-blue-soft) text-primary">
              <UsersIcon :size="14" />
            </span>
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">Users</h3>
          </div>
          <Button variant="ghost" size="sm" @click="router.push('/users')">
            View all <ArrowRight :size="14" />
          </Button>
        </div>

        <p v-if="usersLoading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading…</p>
        <p v-else-if="usersError" class="p-6 text-center text-[13px] text-(--danger)">{{ usersError }}</p>
        <p v-else-if="previewUsers.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No users yet.</p>
        <ul v-else class="m-0 flex list-none flex-col p-0">
          <li
            v-for="user in previewUsers"
            :key="user.userId"
            class="flex items-center justify-between gap-3 border-b border-(--line-1) py-3 px-6 last:border-b-0"
          >
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-(--fg-1)">{{ user.fullName }}</div>
              <div class="truncate text-xs text-(--fg-3)">{{ user.email }}</div>
            </div>
            <div class="flex shrink-0 flex-wrap justify-end gap-1">
              <RaChip v-for="role in user.roles" :key="role" :tone="roleTone[role] ?? 'neutral'">{{ role }}</RaChip>
            </div>
          </li>
        </ul>
      </RaCard>
    </div>

    <RaCard v-if="hasPermission('identity:audit:view')" :padding="0" class="overflow-hidden">
      <div class="flex items-center justify-between border-b border-(--line-1) py-5 px-6">
        <div class="flex items-center gap-2.5">
          <span class="flex size-7 items-center justify-center rounded-full bg-(--brand-blue-soft) text-primary">
            <History :size="14" />
          </span>
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">Recent Activity</h3>
        </div>
        <Button variant="ghost" size="sm" @click="router.push('/audit')">
          View all <ArrowRight :size="14" />
        </Button>
      </div>

      <p v-if="activityLoading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading…</p>
      <p v-else-if="activityError" class="p-6 text-center text-[13px] text-(--danger)">{{ activityError }}</p>
      <p v-else-if="activity.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No activity recorded yet.</p>
      <ul v-else class="m-0 flex list-none flex-col p-0">
        <li
          v-for="entry in activity"
          :key="entry.id"
          class="flex items-start justify-between gap-3 border-b border-(--line-1) py-3 px-6 last:border-b-0 max-md:flex-col"
        >
          <div class="flex flex-wrap items-center gap-1.5 text-sm text-(--fg-1)">
            <span class="font-semibold">{{ entry.action }}</span> — {{ entry.entityType }}
            <UserPreviewPopover v-if="entry.userId" :user-id="entry.userId" />
            <span v-else class="text-xs text-(--fg-4)">System</span>
          </div>
          <span class="shrink-0 text-xs text-(--fg-3)">{{ formatDate(entry.occurredAt) }}</span>
        </li>
      </ul>
    </RaCard>
  </div>
</template>
