<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { RaCard, RaChip, RaAvatar, RaButton } from '@roboacademy/ui'
import { KeyRound, LogOut } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { changePassword } from '@/api/identity'
import { getCurrentUser, logout } from '@/store/auth'

const router = useRouter()
const user = getCurrentUser()

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

const passwordDialogOpen = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const errorMessage = ref('')

function resetPasswordForm() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  errorMessage.value = ''
}

function closeDialog() {
  passwordDialogOpen.value = false
  resetPasswordForm()
}

async function submitChangePassword() {
  errorMessage.value = ''

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'New password and confirmation do not match.'
    return
  }

  saving.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    closeDialog()
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Unable to change password. Please try again.'
  } finally {
    saving.value = false
  }
}

function handleLogout() {
  logout()
  router.push('/auth')
}

const inputClass = 'w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-4 py-3 text-sm text-(--fg-1) outline-none transition-colors placeholder:text-(--fg-4) focus:border-(--brand-blue-ring)'
</script>

<template>
  <div class="flex flex-col gap-7 px-8 pt-8 pb-12 max-w-(--content-max) mx-auto max-sm:gap-5 max-sm:px-4 max-sm:pt-5 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold text-(--fg-1) tracking-[-0.01em] max-sm:text-2xl">Profile</h1>
      <p class="mt-2 mb-0 text-sm text-(--fg-3)">Manage your account.</p>
    </div>

    <RaCard class="flex max-w-md flex-col gap-4">
      <div class="flex items-center gap-3.5">
        <RaAvatar :name="user?.fullName ?? ''" :size="48" />
        <div class="min-w-0">
          <div class="truncate text-lg font-bold text-(--fg-1)">{{ user?.fullName }}</div>
          <div class="truncate text-sm text-(--fg-3)">{{ user?.email }}</div>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <RaChip v-for="role in user?.roles ?? []" :key="role" :tone="roleTone[role] ?? 'neutral'">{{ role }}</RaChip>
      </div>
      <div class="mt-2 flex flex-wrap gap-2.5">
        <RaButton variant="secondary" @click="passwordDialogOpen = true">
          <template #icon><KeyRound :size="14" /></template>
          Change Password
        </RaButton>
        <RaButton variant="secondary" @click="handleLogout">
          <template #icon><LogOut :size="14" /></template>
          Logout
        </RaButton>
      </div>
    </RaCard>

    <Teleport to="body">
      <div v-if="passwordDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="closeDialog" />
        <div class="relative w-full max-w-md rounded-(--ra-lg) border border-(--line-1) bg-(--bg-1) p-6 shadow-(--elev-2)">
          <h2 class="m-0 text-lg font-bold text-(--fg-1)">Change Password</h2>
          <p class="mt-1 mb-0 text-sm text-(--fg-3)">Enter your current password and choose a new one.</p>

          <form class="mt-5 flex flex-col gap-3.5" @submit.prevent="submitChangePassword">
            <div class="flex flex-col gap-1.5">
              <label for="currentPassword" class="text-xs font-medium text-(--fg-3)">Current Password</label>
              <input
                id="currentPassword"
                v-model="currentPassword"
                type="password"
                required
                autocomplete="current-password"
                :class="inputClass"
              >
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="newPassword" class="text-xs font-medium text-(--fg-3)">New Password</label>
              <input
                id="newPassword"
                v-model="newPassword"
                type="password"
                required
                minlength="8"
                autocomplete="new-password"
                :class="inputClass"
              >
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="confirmPassword" class="text-xs font-medium text-(--fg-3)">Confirm New Password</label>
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                type="password"
                required
                minlength="8"
                autocomplete="new-password"
                :class="inputClass"
              >
            </div>

            <p v-if="errorMessage" class="m-0 text-[13px] text-(--danger)">{{ errorMessage }}</p>

            <div class="mt-1.5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <RaButton variant="secondary" type="button" @click="closeDialog">Cancel</RaButton>
              <RaButton variant="primary" :disabled="saving">
                {{ saving ? 'Saving…' : 'Change Password' }}
              </RaButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
