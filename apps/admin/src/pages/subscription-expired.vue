<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RaCard, formatDate } from '@roboacademy/ui'
import { LockKeyhole, LogOut, RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import BrandMark from '@/components/BrandMark.vue'
import { getMySubscriptionStatus, type SubscriptionStatus } from '@/api/plans'
import { getCurrentUser, isAuthenticated, logout } from '@/store/auth'

// Where a locked tenant's school admin lands (see the subscription_expired redirect in
// api/client.ts). Outside AdminLayout on purpose: every other screen would only fail.
const router = useRouter()
const user = getCurrentUser()
const status = ref<SubscriptionStatus | null>(null)
const checking = ref(false)

async function check() {
  if (!isAuthenticated()) {
    router.replace('/login')
    return
  }
  checking.value = true
  try {
    status.value = await getMySubscriptionStatus()
    // Renewed (or never locked) - back to work.
    if (status.value.state !== 'Locked') {
      window.location.assign('/')
    }
  } catch {
    status.value = null
  } finally {
    checking.value = false
  }
}

function signOut() {
  logout()
  router.replace('/login')
}

onMounted(check)
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-(--bg-0) px-4 py-12">
    <RaCard class="flex w-full max-w-lg flex-col gap-5 p-8 max-sm:p-6">
      <div class="flex items-center gap-2.5">
        <BrandMark />
        <span class="text-base font-bold tracking-[-0.01em] text-(--brand-blue)">RoboAcademy Admin</span>
      </div>

      <div class="flex size-11 items-center justify-center rounded-full bg-(--danger-soft) text-(--danger)">
        <LockKeyhole :size="20" />
      </div>

      <div>
        <h1 class="m-0 text-2xl font-bold tracking-[-0.01em] text-(--fg-1)">Your school's subscription has expired</h1>
        <p class="mt-2 text-sm leading-relaxed text-(--fg-2)">
          The grace period has ended, so teachers and students can't sign in right now. Nothing has been deleted —
          everything comes back as soon as the subscription is renewed.
        </p>
      </div>

      <dl v-if="status" class="m-0 grid grid-cols-3 gap-4 rounded-(--ra-md) bg-(--bg-3) p-4 max-sm:grid-cols-1">
        <div>
          <dt class="text-xs text-(--fg-3)">Plan</dt>
          <dd class="m-0 mt-1 text-sm font-semibold text-(--fg-1)">{{ status.planName }}</dd>
        </div>
        <div>
          <dt class="text-xs text-(--fg-3)">Expired</dt>
          <dd class="m-0 mt-1 text-sm text-(--fg-1)">{{ status.endsAt ? formatDate(status.endsAt) : '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-(--fg-3)">Access ended</dt>
          <dd class="m-0 mt-1 text-sm text-(--fg-1)">{{ status.lockedAt ? formatDate(status.lockedAt) : '—' }}</dd>
        </div>
      </dl>

      <p class="m-0 text-sm text-(--fg-2)">
        To renew, contact RoboAcademy. Once it's renewed, select <strong>Check again</strong>.
      </p>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-(--line-1) pt-5">
        <span v-if="user" class="text-xs text-(--fg-3)">Signed in as {{ user.email }}</span>
        <div class="flex gap-2">
          <Button variant="outline" @click="signOut"><LogOut :size="14" /> Sign out</Button>
          <Button :disabled="checking" @click="check">
            <RefreshCw :size="14" /> {{ checking ? 'Checking…' : 'Check again' }}
          </Button>
        </div>
      </div>
    </RaCard>
  </div>
</template>
