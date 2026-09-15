<script setup lang="ts">
import AppTopBar from '@/components/layout/AppTopBar.vue'
import AppBottomNav from '@/components/layout/AppBottomNav.vue'
import { onMounted } from 'vue'

import { useRoute } from 'vue-router'
import { getTenantId } from '@/api/client'
import { setStoredTenantId } from '@/api/session'
import { ref } from 'vue'
import { getTenantBranding, type TenantBranding } from '@/api/tenancy'
import { applyTenantBranding } from '@/branding'

const route = useRoute()

const branding = ref<TenantBranding>({
      name: 'RoboAcademy',
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      welcomeMessage: null,
      featureImageUrl: null,
      tagline: 'Learn robotics anywhere, at your own pace.',
      allowRegistration: true,
})

onMounted(async () => {
  const tenantId = route.query.tenantId
  if (typeof tenantId === 'string' && tenantId.trim()) {
    setStoredTenantId(tenantId.trim())
  }

  try {
    branding.value = await getTenantBranding(getTenantId())
  } catch {
    // No branding available (unknown/platform tenant, or a network error) — keep the defaults.
  }

  applyTenantBranding(branding.value)
})

</script>

<template>
  <div class="flex flex-col h-screen bg-(--bg-0) overflow-hidden">
    <AppTopBar :branding="branding" />
    <div class="flex-1 overflow-y-auto max-md:pb-[60px]">
      <router-view />
    </div>
    <footer class="flex justify-between shrink-0 py-3.5 px-8 border-t border-(--line-1) text-xs text-(--fg-4) max-md:hidden">
      <span>© {{ new Date().getFullYear() }} powered by RoboAcademy. Professional Robotics LMS.</span>
      <div class="flex gap-4.5">
        <a href="#" class="text-(--fg-3) no-underline hover:text-(--fg-2)">Privacy Policy</a>
        <a href="#" class="text-(--fg-3) no-underline hover:text-(--fg-2)">Terms of Service</a>
        <a href="#" class="text-(--fg-3) no-underline hover:text-(--fg-2)">System Status</a>
      </div>
    </footer>
    <AppBottomNav />
  </div>
</template>
