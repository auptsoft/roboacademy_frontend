import { computed } from 'vue'
import { getActiveTenantId, hasPermission, isImpersonating } from '@/store/auth'

const PLATFORM_TENANT_ID = import.meta.env.VITE_PLATFORM_TENANT_ID

// Gate for every cross-tenant copy/import entry point (courses, assessments, question bank).
// A computed, not a plain const captured at setup time - this codebase has a recurring bug
// pattern of capturing hasPermission()/getActiveTenantId() into a const, which then never
// reacts to enterTenant()/exitTenant(). The backend enforces the same rule independently
// (PlatformContentCopy.CallerIsPlatform) - this only controls whether the UI entry points show.
export function useCanCopyCrossTenant() {
  return computed(
    () => hasPermission('tenancy:manage') && !isImpersonating() && getActiveTenantId() === PLATFORM_TENANT_ID,
  )
}
