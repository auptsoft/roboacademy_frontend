<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { AlertTriangle, BadgeCheck, Loader2, SearchX, ShieldOff } from 'lucide-vue-next'
import { ApiError, getTenantId } from '@/api/client'
import { getTenantBranding, type TenantBranding } from '@/api/tenancy'
import { verifyCertificate, type CertificateVerification } from '@/api/certification'
import { applyTenantBranding } from '@/branding'

// Public, signed-out page. The issuing tenant travels in ?tenantId= (see verificationUrl) and is
// used for this request only - never persisted, so it can't switch the viewer's own tenant.
const route = useRoute()
const verificationId = String(route.params.verificationId ?? '')
const tenantId = typeof route.query.tenantId === 'string' && route.query.tenantId.trim()
  ? route.query.tenantId.trim()
  : getTenantId()

const status = ref<'loading' | 'valid' | 'revoked' | 'not-found' | 'error'>('loading')
const result = ref<CertificateVerification | null>(null)
const branding = ref<TenantBranding | null>(null)

const title = computed(() => result.value?.courseTitle ?? result.value?.pathTitle ?? 'Certificate')
const kindLabel = computed(() => (result.value?.pathTitle ? 'Learning path' : 'Course'))
const longDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })
const issuedOn = computed(() => (result.value ? longDate.format(new Date(result.value.issuedAt)) : ''))
const revokedOn = computed(() => (result.value?.revokedAt ? longDate.format(new Date(result.value.revokedAt)) : ''))
// The name snapshotted on the certificate wins over the tenant's current one.
const issuerName = computed(() => result.value?.issuerName ?? branding.value?.name ?? null)

async function load() {
  status.value = 'loading'
  getTenantBranding(tenantId)
    .then((b) => { branding.value = b; applyTenantBranding(b) })
    .catch(() => { /* Unbranded fallback is fine for verification. */ })

  try {
    result.value = await verifyCertificate(verificationId, tenantId)
    status.value = result.value.valid ? 'valid' : 'revoked'
  } catch (error) {
    status.value = error instanceof ApiError && error.status === 404 ? 'not-found' : 'error'
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-(--bg-2) flex flex-col items-center px-4 py-12 max-sm:py-8">
    <header class="flex items-center gap-3 mb-8">
      <img v-if="branding?.logoUrl" :src="branding.logoUrl" alt="" class="h-9 w-auto max-w-[140px] object-contain" />
      <span class="text-lg font-semibold text-(--heading)">{{ branding?.name ?? 'RoboAcademy' }}</span>
    </header>

    <main class="w-full max-w-[560px] bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) overflow-hidden">
      <div v-if="status === 'loading'" class="flex items-center justify-center gap-2 py-16 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Checking certificate…
      </div>

      <template v-else-if="status === 'valid' || status === 'revoked'">
        <div
          class="flex items-center gap-3 px-8 py-5 max-sm:px-5"
          :class="status === 'valid' ? 'bg-(--success-soft) text-(--success)' : 'bg-(--danger-soft) text-(--danger)'"
        >
          <component :is="status === 'valid' ? BadgeCheck : ShieldOff" :size="22" class="shrink-0" />
          <span class="text-[15px] font-semibold">
            {{ status === 'valid' ? 'Valid certificate' : 'This certificate has been revoked' }}
          </span>
        </div>
        <dl class="m-0 flex flex-col gap-5 px-8 py-7 max-sm:px-5">
          <div v-if="result?.holderName" class="flex flex-col gap-1">
            <dt class="text-xs font-semibold uppercase tracking-[0.04em] text-(--fg-4)">Awarded to</dt>
            <dd class="m-0 text-xl font-semibold text-(--heading)">{{ result.holderName }}</dd>
          </div>
          <div class="flex flex-col gap-1">
            <dt class="text-xs font-semibold uppercase tracking-[0.04em] text-(--fg-4)">{{ kindLabel }}</dt>
            <dd class="m-0 text-xl font-semibold text-(--heading)">{{ title }}</dd>
          </div>
          <div class="flex flex-col gap-1">
            <dt class="text-xs font-semibold uppercase tracking-[0.04em] text-(--fg-4)">Issued</dt>
            <dd class="m-0 text-[15px] text-(--fg-2)">{{ issuedOn }}</dd>
          </div>
          <div v-if="revokedOn" class="flex flex-col gap-1">
            <dt class="text-xs font-semibold uppercase tracking-[0.04em] text-(--fg-4)">Revoked</dt>
            <dd class="m-0 text-[15px] text-(--fg-2)">{{ revokedOn }}</dd>
          </div>
          <div class="flex flex-col gap-1">
            <dt class="text-xs font-semibold uppercase tracking-[0.04em] text-(--fg-4)">Verification ID</dt>
            <dd class="m-0 font-mono text-[13px] text-(--fg-3) break-all">{{ verificationId }}</dd>
          </div>
          <div v-if="issuerName" class="flex flex-col gap-1">
            <dt class="text-xs font-semibold uppercase tracking-[0.04em] text-(--fg-4)">Issued by</dt>
            <dd class="m-0 text-[15px] text-(--fg-2)">{{ issuerName }}</dd>
          </div>
        </dl>
      </template>

      <div v-else-if="status === 'not-found'" class="flex flex-col items-center gap-3 py-14 px-6 text-center">
        <div class="w-10 h-10 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-3)"><SearchX :size="18" /></div>
        <p class="m-0 text-[15px] font-semibold text-(--heading)">No certificate found</p>
        <p class="m-0 text-[13px] text-(--fg-3) max-w-[380px]">
          Check that the link is complete. Certificates can only be verified through the link shared by their holder.
        </p>
      </div>

      <div v-else class="flex flex-col items-center gap-3 py-14 px-6 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't check this certificate right now.</p>
        <button
          class="text-sm font-semibold text-(--brand-blue) bg-transparent border-0 cursor-pointer"
          @click="load"
        >Try again</button>
      </div>
    </main>
  </div>
</template>
