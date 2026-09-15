<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { confirmPasswordReset, requestPasswordReset } from '@/api/identity'
import { ApiError } from '@/api/client'

const emit = defineEmits<{ success: []; 'back-to-login': [] }>()

const step = ref<'request' | 'reset'>('request')

const email = ref('')
const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)

const submitting = ref(false)
const resending = ref(false)
const errorMessage = ref('')

const passwordsMatch = computed(() => !confirmPassword.value || newPassword.value === confirmPassword.value)

async function submitRequest() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await requestPasswordReset(email.value)
    step.value = 'reset'
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Unable to send a verification code.'
  } finally {
    submitting.value = false
  }
}

async function resendCode() {
  errorMessage.value = ''
  resending.value = true
  try {
    await requestPasswordReset(email.value)
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Unable to resend the verification code.'
  } finally {
    resending.value = false
  }
}

async function submitReset() {
  errorMessage.value = ''
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  submitting.value = true
  try {
    await confirmPasswordReset({ email: email.value, code: code.value, newPassword: newPassword.value })
    emit('success')
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Unable to reset your password.'
  } finally {
    submitting.value = false
  }
}

const inputClass = 'w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-4 py-3 text-sm text-(--fg-1) outline-none transition-colors placeholder:text-(--fg-4) focus:border-(--brand-blue-ring)'
</script>

<template>
  <div>
    <template v-if="step === 'request'">
      <h1 class="m-0 text-[28px] font-bold text-(--fg-1)">Forgot Password</h1>
      <p class="mt-1.5 mb-0 text-sm text-(--fg-3)">Enter your email and we'll send you a code to reset your password</p>

      <form class="mt-6 flex flex-col gap-3.5" @submit.prevent="submitRequest">
        <input v-model="email" type="email" placeholder="Email Address" aria-label="Email Address" required autocomplete="username" :class="inputClass">

        <p v-if="errorMessage" class="m-0 text-[13px] text-(--danger)">{{ errorMessage }}</p>

        <Button type="submit" class="mt-1.5 h-auto w-full rounded-(--ra-md) bg-(--brand-blue) py-3 text-sm font-semibold text-(--brand-blue-foreground) hover:bg-(--brand-blue-hover)" :disabled="submitting">
          {{ submitting ? 'Sending code…' : 'Send code' }}
        </Button>

        <button type="button" class="self-center border-0 bg-transparent p-0 text-xs font-medium text-(--fg-3) hover:text-(--fg-1)" @click="$emit('back-to-login')">Back to login</button>
      </form>
    </template>

    <template v-else>
      <h1 class="m-0 text-[28px] font-bold text-(--fg-1)">Check your email</h1>
      <p class="mt-1.5 mb-0 text-sm text-(--fg-3)">If an account exists for {{ email }}, we've sent a 6-digit code.</p>

      <form class="mt-6 flex flex-col gap-3.5" @submit.prevent="submitReset">
        <input
          v-model="code"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="6-digit code"
          aria-label="Verification code"
          required
          :class="[inputClass, 'text-center text-lg tracking-[0.3em]']"
        >

        <div class="relative">
          <input
            v-model="newPassword"
            :type="showPassword ? 'text' : 'password'"
            placeholder="New Password"
            aria-label="New Password"
            required
            minlength="8"
            autocomplete="new-password"
            :class="[inputClass, 'pr-11']"
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
        <p class="-mt-2 text-[11px] text-(--fg-4)">Must be at least 8 characters.</p>

        <input
          v-model="confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Confirm New Password"
          aria-label="Confirm New Password"
          required
          autocomplete="new-password"
          :class="inputClass"
        >
        <p v-if="!passwordsMatch" class="-mt-2 text-[11px] text-(--danger)">Passwords do not match.</p>

        <p v-if="errorMessage" class="m-0 text-[13px] text-(--danger)">{{ errorMessage }}</p>

        <Button type="submit" class="h-auto w-full rounded-(--ra-md) bg-(--brand-blue) py-3 text-sm font-semibold text-(--brand-blue-foreground) hover:bg-(--brand-blue-hover)" :disabled="submitting">
          {{ submitting ? 'Resetting…' : 'Reset password' }}
        </Button>

        <div class="flex items-center justify-between text-xs">
          <button type="button" class="border-0 bg-transparent p-0 text-(--fg-3) hover:text-(--fg-1)" @click="step = 'request'">Back</button>
          <button type="button" class="border-0 bg-transparent p-0 font-medium text-(--brand-blue) hover:text-(--brand-blue-hover)" :disabled="resending" @click="resendCode">
            {{ resending ? 'Resending…' : 'Resend code' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
