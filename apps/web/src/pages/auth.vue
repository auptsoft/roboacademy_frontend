<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Cpu } from 'lucide-vue-next'
import LoginView from '@/components/auth/login-view.vue'
import RegisterView from '@/components/auth/register-view.vue'
import ForgotPasswordView from '@/components/auth/forgot-password-view.vue'
import { getTenantId } from '@/api/client'
import { setStoredTenantId } from '@/api/session'
import { getTenantBranding, type TenantBranding } from '@/api/tenancy'
import { applyTenantBranding } from '@/branding'

const route = useRoute()
const router = useRouter()

const tab = ref<'login' | 'register' | 'forgot-password'>('login')
const resetSuccessMessage = ref('')
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

  if (!branding.value.allowRegistration) {
    tab.value = 'login'
  }
})

function onSuccess() {
  router.push('/app')
}

function onResetSuccess() {
  tab.value = 'login'
  resetSuccessMessage.value = 'Password updated — please log in.'
}
</script>

<template>
  <div class=" grid min-h-screen grid-cols-2 bg-(--bg-1) max-lg:grid-cols-1">
    <!-- Left: form -->
    <div class="container mx-auto flex flex-col items-center justify-center px-8 py-12 max-[480px]:px-5">
      <div class="w-full max-w-100">
        <div class="mb-9 flex flex-col items-center text-center">
          <img v-if="branding.logoUrl" :src="branding.logoUrl" :alt="branding.name" class="mb-3 h-24 max-w-55 object-contain">
          <div v-else class="mb-3 inline-flex items-center gap-2.5">
            <span class="flex size-10 items-center justify-center rounded-(--ra-md) bg-(--brand-blue) text-white"><Cpu :size="20" /></span>
            <span class="text-lg font-bold tracking-[-0.01em] text-(--brand-blue)">{{ branding.name }}</span>
          </div>
        </div>

        <p v-if="resetSuccessMessage && tab === 'login'" class="m-0 mb-4 rounded-(--ra-md) bg-(--brand-blue)/10 px-4 py-2.5 text-sm text-(--brand-blue)">{{ resetSuccessMessage }}</p>

        <LoginView v-if="tab === 'login'" @success="onSuccess" @forgot-password="resetSuccessMessage = ''; tab = 'forgot-password'" />
        <RegisterView v-else-if="tab === 'register'" @success="onSuccess" />
        <ForgotPasswordView v-else @success="onResetSuccess" @back-to-login="tab = 'login'" />

        <p v-if="branding.allowRegistration && tab !== 'forgot-password'" class="mt-7 text-center text-sm text-(--fg-3)">
          <template v-if="tab === 'login'">
            New here?
            <button type="button" class="border-0 bg-transparent p-0 font-semibold text-(--brand-blue) hover:text-(--brand-blue-hover)" @click="tab = 'register'">Create an account</button>
          </template>
          <template v-else>
            Already have an account?
            <button type="button" class="border-0 bg-transparent p-0 font-semibold text-(--brand-blue) hover:text-(--brand-blue-hover)" @click="tab = 'login'">Log in</button>
          </template>
        </p>
      </div>
    </div>

    <!-- Right: hero -->
    <div class="relative py-30 pl-0 pr-44 max-lg:hidden">
      <div class="relative size-full overflow-hidden rounded-(--ra-2xl) " :class="!branding.featureImageUrl && 'bg-(--brand-blue)'">
        <img
          v-if="branding.featureImageUrl"
          :src="branding.featureImageUrl"
          :alt="branding.name"
          class="absolute inset-0 size-full object-cover"
        >
        <div class="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
        <div class="absolute inset-x-0 bottom-0 p-10">
          <h1 class="m-0 text-4xl font-bold text-white">{{ branding.name }}</h1>
          <p v-if="branding.tagline" class="mt-3 max-w-110 text-base text-white/90">{{ branding.tagline }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
