<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertTriangle, Loader2 } from 'lucide-vue-next'
import { getLegalDocument, type LegalDocumentName } from '@/api/identity'
import { renderRichText } from '@/lib/rich-text'

// Public, signed-out page for /terms and /privacy. The text is served by the backend, which
// also owns the version users accept (see register-view and TermsGate).
const props = defineProps<{ document: LegalDocumentName }>()

const titles: Record<LegalDocumentName, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
}

const status = ref<'loading' | 'ready' | 'error'>('loading')
const html = ref('')
const title = computed(() => titles[props.document])

async function load() {
  status.value = 'loading'
  document.title = `${title.value} · RoboAcademy`
  try {
    html.value = renderRichText((await getLegalDocument(props.document)).markdown)
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

watch(() => props.document, load, { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-(--bg-2) px-4 py-12 max-sm:py-8">
    <main class="mx-auto w-full max-w-[760px]">
      <nav class="mb-6 flex items-center justify-between gap-4 text-[13px]">
        <span class="text-lg font-semibold text-(--heading)">RoboAcademy</span>
        <div class="flex gap-4">
          <RouterLink to="/terms" class="text-(--fg-3) no-underline hover:text-(--fg-1)" active-class="!text-(--fg-1) font-medium">Terms</RouterLink>
          <RouterLink to="/privacy" class="text-(--fg-3) no-underline hover:text-(--fg-1)" active-class="!text-(--fg-1) font-medium">Privacy</RouterLink>
        </div>
      </nav>

      <article class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) px-9 pt-8 pb-9 max-sm:px-5 max-sm:pt-6">
        <h1 class="m-0 text-[26px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-[22px]">{{ title }}</h1>

        <div v-if="status === 'loading'" class="mt-6 flex items-center gap-2 text-[13px] text-(--fg-3)">
          <Loader2 :size="16" class="animate-spin" /> Loading…
        </div>

        <div v-else-if="status === 'error'" class="mt-6 flex items-center gap-2 text-[13px] text-(--fg-3)">
          <AlertTriangle :size="16" class="text-(--danger)" />
          Couldn't load this page.
          <button type="button" class="border-0 bg-transparent p-0 font-medium text-(--brand-blue) cursor-pointer" @click="load">Try again</button>
        </div>

        <div v-else class="rich-text mt-6 text-(--fg-2) leading-[1.7]" v-html="html"></div>
      </article>
    </main>
  </div>
</template>
