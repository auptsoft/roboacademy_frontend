<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { registerConfirm, registerStart } from '@/api/identity'
import { login } from '@/store/auth'
import { ApiError } from '@/api/client'

const emit = defineEmits<{ success: [] }>()

const step = ref<'details' | 'verify'>('details')

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const code = ref('')

const submitting = ref(false)
const resending = ref(false)
const errorMessage = ref('')

const passwordsMatch = computed(() => !confirmPassword.value || password.value === confirmPassword.value)

async function submitDetails() {
  errorMessage.value = ''
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  submitting.value = true
  try {
    await registerStart(email.value)
    step.value = 'verify'
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
    await registerStart(email.value)
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Unable to resend the verification code.'
  } finally {
    resending.value = false
  }
}

async function confirmCode() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await registerConfirm({
      email: email.value,
      code: code.value,
      password: password.value,
      firstName: firstName.value,
      lastName: lastName.value,
    })
    await login(email.value, password.value)
    emit('success')
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Unable to confirm your account.'
  } finally {
    submitting.value = false
  }
}

const inputClass = 'w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-4 py-3 text-sm text-(--fg-1) outline-none transition-colors placeholder:text-(--fg-4) focus:border-(--brand-blue-ring)'
</script>

<template>
  <div>
    <template v-if="step === 'details'">
      <h1 class="m-0 text-[28px] font-bold text-(--fg-1)">Sign Up</h1>
      <p class="mt-1.5 mb-0 text-sm text-(--fg-3)">Create your account</p>

      <form class="mt-6 flex flex-col gap-3.5" @submit.prevent="submitDetails">
        <div class="grid grid-cols-2 gap-3">
          <input v-model="firstName" type="text" placeholder="First Name" aria-label="First Name" required :class="inputClass">
          <input v-model="lastName" type="text" placeholder="Last Name" aria-label="Last Name" required :class="inputClass">
        </div>

        <input v-model="email" type="email" placeholder="Email Address" aria-label="Email Address" required autocomplete="username" :class="inputClass">

        <div class="relative">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Password"
            aria-label="Password"
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
          placeholder="Confirm Password"
          aria-label="Confirm Password"
          required
          autocomplete="new-password"
          :class="inputClass"
        >
        <p v-if="!passwordsMatch" class="-mt-2 text-[11px] text-(--danger)">Passwords do not match.</p>

        <p v-if="errorMessage" class="m-0 text-[13px] text-(--danger)">{{ errorMessage }}</p>

        <Button type="submit" class="mt-1.5 h-auto w-full rounded-(--ra-md) bg-(--brand-blue) py-3 text-sm font-semibold text-(--brand-blue-foreground) hover:bg-(--brand-blue-hover)" :disabled="submitting">
          {{ submitting ? 'Sending code…' : 'Create account' }}
        </Button>
      </form>
    </template>

    <template v-else>
      <h1 class="m-0 text-[28px] font-bold text-(--fg-1)">Check your email</h1>
      <p class="mt-1.5 mb-0 text-sm text-(--fg-3)">Enter the 6-digit code we sent to {{ email }}</p>

      <form class="mt-6 flex flex-col gap-3.5" @submit.prevent="confirmCode">
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

        <p v-if="errorMessage" class="m-0 text-[13px] text-(--danger)">{{ errorMessage }}</p>

        <Button type="submit" class="h-auto w-full rounded-(--ra-md) bg-(--brand-blue) py-3 text-sm font-semibold text-(--brand-blue-foreground) hover:bg-(--brand-blue-hover)" :disabled="submitting">
          {{ submitting ? 'Confirming…' : 'Confirm' }}
        </Button>

        <div class="flex items-center justify-between text-xs">
          <button type="button" class="border-0 bg-transparent p-0 text-(--fg-3) hover:text-(--fg-1)" @click="step = 'details'">Back</button>
          <button type="button" class="border-0 bg-transparent p-0 font-medium text-(--brand-blue) hover:text-(--brand-blue-hover)" :disabled="resending" @click="resendCode">
            {{ resending ? 'Resending…' : 'Resend code' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
