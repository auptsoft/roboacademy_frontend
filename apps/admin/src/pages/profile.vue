<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { RaCard, RaChip, RaAvatar } from '@roboacademy/ui'
import { KeyRound, LogOut } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { ApiError } from '@/api/client'
import { changePassword } from '@/api/identity'
import { getCurrentUser, logout as logoutAdmin } from '@/store/auth'

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

async function submitChangePassword() {
  errorMessage.value = ''

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'New password and confirmation do not match.'
    return
  }

  saving.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    passwordDialogOpen.value = false
    resetPasswordForm()
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Unable to change password. Please try again.'
  } finally {
    saving.value = false
  }
}

function logout() {
  logoutAdmin()
  router.push('/login')
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Profile</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">Manage your account.</p>
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
        <Button variant="outline" @click="passwordDialogOpen = true">
          <KeyRound :size="14" /> Change Password
        </Button>
        <Button variant="outline" @click="logout">
          <LogOut :size="14" /> Logout
        </Button>
      </div>
    </RaCard>

    <Dialog v-model:open="passwordDialogOpen" @update:open="(open) => { if (!open) resetPasswordForm() }">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-3.5" @submit.prevent="submitChangePassword">
          <div class="flex flex-col gap-1.5">
            <Label for="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              v-model="currentPassword"
              type="password"
              required
              autocomplete="current-password"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="newPassword">New Password</Label>
            <Input
              id="newPassword"
              v-model="newPassword"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
            />
          </div>
          <p v-if="errorMessage" class="m-0 text-[13px] text-(--danger)">{{ errorMessage }}</p>
          <DialogFooter>
            <Button variant="outline" type="button" @click="passwordDialogOpen = false">Cancel</Button>
            <Button type="submit" :disabled="saving">
              {{ saving ? 'Saving…' : 'Change Password' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
