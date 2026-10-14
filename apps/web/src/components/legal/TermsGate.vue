<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RaButton } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import { acceptTerms, getMe } from '@/api/identity'
import { logout } from '@/store/auth'

// Blocks the app until the signed-in user has accepted the current Terms of Service and Privacy
// Policy: accounts an admin created (they never saw the sign-up form) and anyone on an older
// version. Checked on every app load, so a version bump reaches users already signed in.
const router = useRouter()

const open = ref(false)
const isUpdate = ref(false)
const version = ref('')
const agreed = ref(false)
const saving = ref(false)
const errorMessage = ref('')

async function check() {
  try {
    const me = await getMe()
    version.value = me.currentTermsVersion
    isUpdate.value = me.acceptedTermsVersion !== null
    open.value = me.acceptedTermsVersion !== me.currentTermsVersion
  } catch {
    // Don't lock anyone out over a failed check; the next app load tries again.
  }
}

async function accept() {
  errorMessage.value = ''
  saving.value = true
  try {
    await acceptTerms(version.value)
    open.value = false
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : 'Unable to save. Please try again.'
    // The terms may have changed while this was open; pick up the new version.
    agreed.value = false
    await check()
  } finally {
    saving.value = false
  }
}

function signOut() {
  logout()
  router.push('/auth')
}

onMounted(check)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50" />
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-gate-title"
      class="relative w-full max-w-md rounded-(--ra-lg) border border-(--line-1) bg-(--bg-1) p-6 shadow-(--elev-2)"
    >
      <h2 id="terms-gate-title" class="m-0 text-lg font-bold text-(--fg-1)">
        {{ isUpdate ? 'We\'ve updated our terms' : 'Before you continue' }}
      </h2>
      <p class="mt-1.5 mb-0 text-sm leading-relaxed text-(--fg-3)">
        {{ isUpdate
          ? 'Please review the updated Terms of Service and Privacy Policy to keep using RoboAcademy.'
          : 'Please review and accept the Terms of Service and Privacy Policy to start using RoboAcademy.' }}
      </p>

      <form class="mt-5 flex flex-col gap-4" @submit.prevent="accept">
        <label class="flex items-start gap-2.5 text-sm leading-relaxed text-(--fg-2)">
          <input v-model="agreed" type="checkbox" required class="mt-1 size-4 shrink-0 accent-(--brand-blue)">
          <span>
            I agree to the
            <a href="/terms" target="_blank" rel="noopener" class="font-medium text-(--brand-blue) hover:text-(--brand-blue-hover)">Terms of Service</a>
            and have read the
            <a href="/privacy" target="_blank" rel="noopener" class="font-medium text-(--brand-blue) hover:text-(--brand-blue-hover)">Privacy Policy</a>.
          </span>
        </label>

        <p v-if="errorMessage" class="m-0 text-[13px] text-(--danger)">{{ errorMessage }}</p>

        <div class="flex justify-end gap-2.5">
          <RaButton variant="secondary" type="button" @click="signOut">Sign out</RaButton>
          <RaButton variant="primary" :disabled="!agreed || saving">{{ saving ? 'Saving…' : 'Continue' }}</RaButton>
        </div>
      </form>
    </div>
  </div>
</template>
