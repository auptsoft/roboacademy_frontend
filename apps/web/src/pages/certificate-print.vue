<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, Loader2, Printer } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import { getMyCertificate, verificationUrl, type CertificateDetail } from '@/api/certification'
import QrCode from '@/components/certificates/QrCode.vue'

// Printable certificate: the browser's print dialog is the "download" (Save as PDF). Colours and
// logo come from the issuance snapshot, not the tenant's live branding, so a rebrand never
// alters a certificate already issued. Not cryptographically signed - the verification link /
// QR is what makes it checkable.
const route = useRoute()
const router = useRouter()
const certificateId = String(route.params.id ?? '')

const status = ref<'loading' | 'idle' | 'not-found' | 'error'>('loading')
const cert = ref<CertificateDetail | null>(null)

const HEX = /^#[0-9a-fA-F]{6}$/
const primary = computed(() => (cert.value?.brandPrimaryColor && HEX.test(cert.value.brandPrimaryColor)
  ? cert.value.brandPrimaryColor : '#14213d'))
const accent = computed(() => (cert.value?.brandSecondaryColor && HEX.test(cert.value.brandSecondaryColor)
  ? cert.value.brandSecondaryColor : primary.value))

const link = computed(() => (cert.value ? verificationUrl(cert.value.verificationId) : ''))
const issuedOn = computed(() => cert.value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(cert.value.issuedAt))
  : '')
const title = computed(() => cert.value?.title ?? (cert.value?.kind === 'Path' ? 'Learning path' : 'Course'))

async function load() {
  status.value = 'loading'
  try {
    cert.value = await getMyCertificate(certificateId)
    status.value = 'idle'
    document.title = `Certificate - ${title.value}`
  } catch (error) {
    status.value = error instanceof ApiError && error.status === 404 ? 'not-found' : 'error'
  }
}

function print() {
  window.print()
}

onMounted(load)
</script>

<template>
  <div class="cert-page min-h-screen bg-(--bg-2) flex flex-col items-center gap-6 px-4 py-8">
    <div class="no-print flex w-full max-w-[1000px] items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
      <RaButton variant="ghost" @click="router.push('/app/certificates')">
        <template #icon><ArrowLeft :size="16" /></template>
        Back to certificates
      </RaButton>
      <RaButton v-if="status === 'idle'" :disabled="cert?.status === 'Revoked'" @click="print">
        <template #icon><Printer :size="16" /></template>
        Print or save as PDF
      </RaButton>
    </div>

    <div v-if="status === 'loading'" class="no-print flex items-center gap-2 py-16 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading certificate…
    </div>
    <div v-else-if="status === 'not-found' || status === 'error'" class="no-print flex flex-col items-center gap-3 py-16 text-center">
      <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">
        {{ status === 'not-found' ? "This certificate doesn't exist or isn't yours." : "Couldn't load this certificate." }}
      </p>
      <RaButton v-if="status === 'error'" variant="secondary" @click="load">Try again</RaButton>
    </div>

    <template v-else-if="cert">
      <p
        v-if="cert.status === 'Revoked'"
        class="no-print m-0 w-full max-w-[1000px] rounded-(--ra-md) bg-(--danger-soft) px-4 py-3 text-sm text-(--danger)"
      >
        This certificate was revoked{{ cert.revokedReason ? `: ${cert.revokedReason}` : '.' }} It can no longer be printed.
      </p>

      <!-- Fixed light palette on purpose: it's a paper document, not themed UI. -->
      <article
        class="certificate relative w-full max-w-[1000px] aspect-[297/210] bg-white text-[#1b1f2a] shadow-(--surface-shadow) overflow-hidden"
        :class="cert.status === 'Revoked' && 'opacity-50'"
        :style="{ '--cert-primary': primary, '--cert-accent': accent }"
      >
        <div class="absolute inset-[2.2%] border-[3px] border-(--cert-primary)" />
        <div class="absolute inset-[3.4%] border border-(--cert-accent) opacity-60" />

        <div class="relative flex h-full flex-col items-center justify-between px-[9%] py-[7%] text-center">
          <header class="flex flex-col items-center gap-[0.6em]">
            <img v-if="cert.brandLogoUrl" :src="cert.brandLogoUrl" alt="" class="h-[3.2em] w-auto max-w-[12em] object-contain" />
            <span class="text-[1.05em] font-semibold tracking-[0.02em] text-(--cert-primary)">{{ cert.issuerName }}</span>
          </header>

          <div class="flex flex-col items-center gap-[0.9em]">
            <span class="text-[0.85em] font-semibold uppercase tracking-[0.3em] text-(--cert-accent)">Certificate of completion</span>
            <span class="text-[0.95em] text-[#5b6070]">This certifies that</span>
            <span class="cert-name text-[2.6em] font-semibold leading-tight text-(--cert-primary)">{{ cert.holderName }}</span>
            <span class="text-[0.95em] text-[#5b6070]">
              has successfully completed the {{ cert.kind === 'Path' ? 'learning path' : 'course' }}
            </span>
            <span class="text-[1.6em] font-semibold leading-snug">{{ title }}</span>
          </div>

          <footer class="flex w-full items-end justify-between gap-[1.5em] text-left">
            <div class="flex flex-col gap-[0.25em]">
              <span class="text-[0.7em] font-semibold uppercase tracking-[0.12em] text-[#8a8f9c]">Issued</span>
              <span class="text-[0.95em]">{{ issuedOn }}</span>
            </div>
            <div class="flex items-end gap-[0.9em]">
              <div class="flex flex-col items-end gap-[0.25em] text-right">
                <span class="text-[0.7em] font-semibold uppercase tracking-[0.12em] text-[#8a8f9c]">Verify at</span>
                <span class="max-w-[22em] break-all font-mono text-[0.62em] text-[#5b6070]">{{ link }}</span>
                <span class="font-mono text-[0.62em] text-[#8a8f9c]">ID {{ cert.verificationId }}</span>
              </div>
              <QrCode :value="link" :size="84" />
            </div>
          </footer>
        </div>
      </article>

      <p class="no-print m-0 max-w-[1000px] text-center text-xs text-(--fg-3)">
        Anyone can scan the code or open the link to confirm this certificate is genuine.
        {{ cert.holderNameVisible ? 'Your name is shown on that page.' : 'Your name is hidden on that page - you can change this on your certificates page.' }}
      </p>
    </template>
  </div>
</template>

<style scoped>
/* Scales every em-sized piece with the certificate's width, so the layout holds on a phone
   and on paper alike. */
.certificate {
  font-size: clamp(8px, 1.6vw, 16px);
}

.cert-name {
  font-family: Georgia, 'Times New Roman', serif;
}

@media print {
  @page {
    size: A4 landscape;
    margin: 0;
  }

  .no-print {
    display: none !important;
  }

  .cert-page {
    background: white;
    padding: 0;
    min-height: 0;
  }

  .certificate {
    max-width: none;
    width: 297mm;
    height: 210mm;
    aspect-ratio: auto;
    box-shadow: none;
    font-size: 16px;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
</style>
