<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, Award, Check, ExternalLink, FileText, Link2, Loader2 } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import {
  certificateTitle,
  getMyCertificates,
  setHolderNameVisibility,
  verificationUrl,
  type CertificateItem,
} from '@/api/certification'

const router = useRouter()

const PAGE_SIZE = 20

const items = ref<CertificateItem[]>([])
const page = ref(1)
const totalPages = ref(0)
const status = ref<'loading' | 'idle' | 'error'>('loading')
const loadingMore = ref(false)
const copiedId = ref<string | null>(null)

const issuedDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })

async function load(reset = true) {
  if (reset) {
    status.value = 'loading'
    page.value = 1
  } else {
    loadingMore.value = true
  }
  try {
    const { data, meta } = await getMyCertificates({ page: page.value, pageSize: PAGE_SIZE })
    items.value = reset ? data : [...items.value, ...data]
    totalPages.value = meta.totalPages
    status.value = 'idle'
  } catch {
    if (reset) status.value = 'error'
  } finally {
    loadingMore.value = false
  }
}

function loadMore() {
  page.value += 1
  void load(false)
}

let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function copyLink(cert: CertificateItem) {
  try {
    await navigator.clipboard.writeText(verificationUrl(cert.verificationId))
    copiedId.value = cert.id
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copiedId.value = null }, 2000)
  } catch {
    // Clipboard blocked (insecure context / permissions) - the Verify button still opens the link.
  }
}

function openVerify(cert: CertificateItem) {
  window.open(verificationUrl(cert.verificationId), '_blank', 'noopener')
}

const savingVisibilityId = ref<string | null>(null)
const visibilityErrorId = ref<string | null>(null)

async function toggleHolderName(cert: CertificateItem) {
  const next = !cert.holderNameVisible
  savingVisibilityId.value = cert.id
  visibilityErrorId.value = null
  try {
    const result = await setHolderNameVisibility(cert.id, next)
    cert.holderNameVisible = result.holderNameVisible
  } catch {
    visibilityErrorId.value = cert.id
  } finally {
    savingVisibilityId.value = null
  }
}

onMounted(() => load())
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-12 pb-12 max-w-[960px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <div class="flex flex-col gap-1.5">
      <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">Certificates</h1>
      <p class="m-0 text-sm text-(--fg-3)">View or print your certificates, and share a verification link so anyone can confirm they're genuine.</p>
    </div>

    <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) overflow-hidden">
      <div v-if="status === 'loading'" class="flex items-center gap-2 p-6 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Loading…
      </div>
      <div v-else-if="status === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your certificates.</p>
        <RaButton variant="secondary" @click="load()">Try again</RaButton>
      </div>
      <div v-else-if="!items.length" class="flex flex-col items-center gap-3 py-16 px-6 text-center">
        <div class="w-10 h-10 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-3)"><Award :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3) max-w-[360px]">
          No certificates yet. Finish a course's required lessons, assessments and practical, or complete a learning path, to earn one.
        </p>
      </div>
      <template v-else>
        <article
          v-for="cert in items"
          :key="cert.id"
          class="flex items-center gap-4 px-6 py-5 border-b border-(--line-1) last:border-b-0 max-sm:flex-col max-sm:items-stretch max-sm:px-4"
        >
          <div class="flex items-start gap-4 min-w-0 flex-1">
            <div
              class="w-11 h-11 shrink-0 rounded-full flex items-center justify-center"
              :class="cert.status === 'Issued' ? 'bg-(--brand-blue-soft) text-(--brand-blue)' : 'bg-(--bg-3) text-(--fg-4)'"
            >
              <Award :size="20" />
            </div>
            <div class="flex flex-col gap-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="text-[15px] font-semibold"
                  :class="cert.status === 'Issued' ? 'text-(--heading)' : 'text-(--fg-3) line-through'"
                >{{ certificateTitle(cert) }}</span>
                <span class="text-[11px] font-semibold uppercase tracking-[0.04em] text-(--fg-4)">{{ cert.kind === 'Path' ? 'Learning path' : 'Course' }}</span>
                <span
                  v-if="cert.status === 'Revoked'"
                  class="inline-flex px-2 py-0.5 rounded-(--ra-pill) text-[11px] font-semibold bg-(--danger-soft) text-(--danger)"
                >Revoked</span>
              </div>
              <span class="text-[13px] text-(--fg-3)">Issued {{ issuedDate.format(new Date(cert.issuedAt)) }}</span>
              <span class="font-mono text-xs text-(--fg-4) break-all">ID {{ cert.verificationId }}</span>
              <label
                v-if="cert.status === 'Issued'"
                class="mt-1.5 inline-flex w-fit cursor-pointer items-center gap-2 text-[13px] text-(--fg-2)"
              >
                <button
                  type="button"
                  role="switch"
                  :aria-checked="cert.holderNameVisible"
                  :disabled="savingVisibilityId === cert.id"
                  class="relative h-5 w-9 shrink-0 cursor-pointer rounded-(--ra-pill) border-0 p-0 transition-colors duration-(--dur-1) ease-(--ease-out) disabled:opacity-60"
                  :class="cert.holderNameVisible ? 'bg-(--brand-blue)' : 'bg-(--line-2)'"
                  @click="toggleHolderName(cert)"
                >
                  <span
                    class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-(--dur-1) ease-(--ease-out)"
                    :class="cert.holderNameVisible && 'translate-x-4'"
                  />
                </button>
                Show my name on the verification page
              </label>
              <span v-if="visibilityErrorId === cert.id" class="text-xs text-(--danger)">Couldn't save that. Try again.</span>
            </div>
          </div>

          <div class="flex shrink-0 flex-wrap items-center gap-2 max-sm:pl-15">
            <RaButton v-if="cert.status === 'Issued'" variant="secondary" @click="router.push(`/certificates/${cert.id}`)">
              <template #icon><FileText :size="14" /></template>
              View
            </RaButton>
            <RaButton variant="secondary" @click="copyLink(cert)">
              <template #icon><component :is="copiedId === cert.id ? Check : Link2" :size="14" /></template>
              {{ copiedId === cert.id ? 'Copied' : 'Copy link' }}
            </RaButton>
            <RaButton variant="ghost" @click="openVerify(cert)">
              <template #icon><ExternalLink :size="14" /></template>
              Verify
            </RaButton>
          </div>
        </article>
      </template>
    </section>

    <div v-if="status === 'idle' && page < totalPages" class="flex justify-center">
      <RaButton variant="secondary" :disabled="loadingMore" @click="loadMore">
        <template v-if="loadingMore" #icon><Loader2 :size="16" class="animate-spin" /></template>
        Load more
      </RaButton>
    </div>
  </div>
</template>
