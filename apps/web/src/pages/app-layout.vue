<script setup lang="ts">
import AppTopBar from '@/components/layout/AppTopBar.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppBottomNav from '@/components/layout/AppBottomNav.vue'
import AssistantLauncher from '@/components/assistant/AssistantLauncher.vue'
import TermsGate from '@/components/legal/TermsGate.vue'
import { RaCelebration } from '@roboacademy/ui'
import AchievementToasts from '@/components/gamification/AchievementToasts.vue'
import { useAchievements } from '@/composables/useAchievements'
import { onMounted, provide } from 'vue'

import { getTenantId } from '@/api/client'
import { ref } from 'vue'
import { getTenantBranding, type TenantBranding } from '@/api/tenancy'
import { applyTenantBranding, brandingKey, featureConfirmed } from '@/branding'

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

provide(brandingKey, branding)

onMounted(async () => {
  try {
    branding.value = await getTenantBranding(getTenantId())
  } catch {
    // No branding available (unknown/platform tenant, or a network error) — keep the defaults.
  }

  applyTenantBranding(branding.value)
  useAchievements().setEnabled(featureConfirmed(branding.value, 'gamification'))
})

</script>

<template>
  <div class="flex h-screen bg-(--canvas) overflow-hidden">
    <AppSidebar :branding="branding" />
    <div class="flex-1 min-w-0 flex flex-col">
      <AppTopBar :branding="branding" />
      <div class="flex-1 overflow-y-auto max-md:pb-[60px]">
        <router-view />
      </div>
      <!-- <footer class="flex justify-between shrink-0 py-3.5 px-12 border-t border-(--line-1) text-xs text-(--fg-4) max-lg:px-8 max-md:hidden">
        <span>© {{ new Date().getFullYear() }} powered by RoboAcademy. Professional Robotics LMS.</span>
        <div class="flex gap-4.5">
          <RouterLink to="/privacy" class="text-(--fg-3) no-underline hover:text-(--fg-2)">Privacy Policy</RouterLink>
          <RouterLink to="/terms" class="text-(--fg-3) no-underline hover:text-(--fg-2)">Terms of Service</RouterLink>
          <a href="#" class="text-(--fg-3) no-underline hover:text-(--fg-2)">System Status</a>
        </div>
      </footer> -->
    </div>
    <AppBottomNav />
    <AssistantLauncher />
    <TermsGate />
    <RaCelebration />
    <AchievementToasts />
  </div>
</template>
