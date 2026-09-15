<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { login } from '@/store/auth'
import { ApiError } from '@/api/client'

const emit = defineEmits<{ success: []; 'forgot-password': [] }>()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    emit('success')
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Unable to sign in. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="m-0 text-[28px] font-bold text-(--fg-1)">Log In</h1>
    <p class="mt-1.5 mb-0 text-sm text-(--fg-3)">Enter your account details</p>

    <form class="mt-6 flex flex-col gap-3.5" @submit.prevent="submit">
      <input
        v-model="email"
        type="text"
        placeholder="Email Address"
        aria-label="Email Address"
        required
        autocomplete="username"
        class="w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-4 py-3 text-sm text-(--fg-1) outline-none transition-colors placeholder:text-(--fg-4) focus:border-(--brand-blue-ring)"
      >

      <div class="relative">
        <input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Password"
          aria-label="Password"
          required
          autocomplete="current-password"
          class="w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-4 py-3 pr-11 text-sm text-(--fg-1) outline-none transition-colors placeholder:text-(--fg-4) focus:border-(--brand-blue-ring)"
        >
        <button
          type="button"
          class="absolute inset-y-0 right-0 flex w-11 items-center justify-center border-0 bg-transparent text-(--fg-4) hover:text-(--fg-2)"
          :aria-label="showPassword ? 'Hide password' : 'Show password'"
          @click="showPassword = !showPassword"
        >
          <EyeOff v-if="showPassword" :size="16" />
          <Eye v-else :size="16" />
        </button>
      </div>

      <button type="button" class="self-end border-0 bg-transparent p-0 text-xs font-medium text-(--brand-blue) hover:text-(--brand-blue-hover)" @click="$emit('forgot-password')">Forgot Password?</button>

      <p v-if="errorMessage" class="m-0 text-[13px] text-(--danger)">{{ errorMessage }}</p>

      <Button type="submit" class="mt-1.5 h-auto w-full rounded-(--ra-md) bg-(--brand-blue) py-3 text-sm font-semibold text-(--brand-blue-foreground) hover:bg-(--brand-blue-hover)" :disabled="loading">
        {{ loading ? 'Logging in…' : 'Login' }}
      </Button>
    </form>
  </div>
</template>
