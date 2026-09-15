<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, ShieldCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import BrandMark from '@/components/BrandMark.vue'
import { login, syncActiveTenantId } from '@/store/auth'
import { ApiError } from '@/api/client'
import { setStoredTenantId } from '@/api/session'
import { applyTenantBranding } from '@/branding'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

onMounted(() => {
  const tenantId = route.query.tenantId
  if (typeof tenantId === 'string' && tenantId.trim()) {
    setStoredTenantId(tenantId.trim())
    syncActiveTenantId()
    applyTenantBranding()
  }
})

async function signIn() {
  errorMessage.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    router.push('/')
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Unable to sign in. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center gap-8 bg-[radial-gradient(ellipse_at_center,var(--bg-2)_0%,var(--bg-0)_70%)] px-6 py-10 font-sans max-[480px]:px-4 max-[480px]:py-6"
  >
    <div class="text-center">
      <div class="inline-flex items-center gap-3">
        <BrandMark size="lg" />
        <span class="text-[22px] font-bold tracking-[-0.01em] text-(--brand-blue)">RoboAcademy Admin</span>
      </div>
      <p class="mt-2 text-[13px] text-(--fg-3)">Restricted access — administrators only</p>
    </div>

    <div class="w-[420px] max-w-full rounded-(--ra-lg) border border-(--line-1) bg-(--bg-2) p-7 max-[480px]:p-5">
      <h2 class="m-0 text-2xl font-bold text-(--fg-1)">Admin sign in</h2>
      <p class="mt-1.5 text-[13px] text-(--fg-3)">Enter your administrator credentials to continue.</p>
      <form class="mt-5 flex flex-col gap-3.5" @submit.prevent="signIn">
        <div class="flex flex-col gap-1.5">
          <Label for="email">Email Address</Label>
          <Input
            id="email"
            v-model="email"
            type="email"
            placeholder="admin@roboacademy.edu"
            required
            autocomplete="username"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="password">Password</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
          />
        </div>
        <p v-if="errorMessage" class="m-0 text-[13px] text-(--danger)">{{ errorMessage }}</p>
        <Button type="submit" class="mt-1.5 w-full" :disabled="loading">
          {{ loading ? 'Signing in…' : 'Sign In' }} <ArrowRight :size="14" />
        </Button>
      </form>
    </div>

    <div class="inline-flex items-center gap-2 text-[11px] tracking-[0.10em] text-(--fg-4) uppercase">
      <ShieldCheck :size="12" />
      Encrypted Secure Session
    </div>
  </div>
</template>
