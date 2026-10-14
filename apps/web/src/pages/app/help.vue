<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { RaButton } from '@roboacademy/ui'
import { AlertTriangle, ChevronRight, HelpCircle, Loader2, Search } from 'lucide-vue-next'
import { listHelpArticles, type HelpArticleSummary } from '@/api/help'
import { HELP_TOPICS } from '@/lib/help'

const router = useRouter()

const articles = ref<HelpArticleSummary[]>([])
const status = ref<'loading' | 'idle' | 'error'>('loading')

const searchInput = ref('')
const results = ref<HelpArticleSummary[]>([])
const searching = ref(false)

async function load() {
  status.value = 'loading'
  try {
    articles.value = await listHelpArticles()
    status.value = 'idle'
  } catch {
    status.value = 'error'
  }
}

// Grouped in the backend's topic order; articles arrive already sorted.
const groups = computed(() =>
  Object.entries(HELP_TOPICS)
    .map(([topic, meta]) => ({ topic, ...meta, articles: articles.value.filter((a) => a.topic === topic) }))
    .filter((g) => g.articles.length),
)

const query = computed(() => searchInput.value.trim())

let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0

watch(query, (q) => {
  clearTimeout(searchTimer)
  if (!q) {
    results.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq
    try {
      const found = await listHelpArticles({ q })
      if (seq === searchSeq) results.value = found
    } catch {
      if (seq === searchSeq) results.value = []
    } finally {
      if (seq === searchSeq) searching.value = false
    }
  }, 300)
})

function open(article: HelpArticleSummary) {
  router.push(`/app/help/${article.slug}`)
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-12 pb-12 max-w-[960px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <div class="flex flex-col gap-1.5">
      <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">Help Center</h1>
      <p class="m-0 text-sm text-(--fg-3)">Short guides to getting things done in the app.</p>
    </div>

    <div class="relative max-w-140">
      <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-(--fg-4)" />
      <input
        v-model="searchInput"
        type="search"
        placeholder="Search help, e.g. “certificate” or “reset password”"
        aria-label="Search help"
        class="w-full bg-(--surface) text-(--fg-1) border border-(--line-2) rounded-(--ra-md) py-2.5 pl-9 pr-3 text-sm outline-none transition-colors duration-(--dur-1) ease-(--ease-out) placeholder:text-(--fg-4) focus:border-(--brand-blue-ring)"
      />
    </div>

    <div v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>

    <section v-else-if="status === 'error'" class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) flex flex-col items-center gap-3 py-12 text-center">
      <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load the Help Center.</p>
      <RaButton variant="secondary" @click="load">Try again</RaButton>
    </section>

    <!-- Search results -->
    <section v-else-if="query" class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) overflow-hidden">
      <div v-if="searching" class="flex items-center gap-2 p-6 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Searching…
      </div>
      <div v-else-if="!results.length" class="flex flex-col items-center gap-3 py-12 px-6 text-center">
        <div class="w-10 h-10 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-3)"><HelpCircle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3) max-w-[360px]">No guides match “{{ query }}”. Try another word, or browse the topics below.</p>
        <RaButton variant="secondary" @click="searchInput = ''">Show all topics</RaButton>
      </div>
      <button
        v-for="article in results"
        v-else
        :key="article.slug"
        class="flex w-full items-center gap-4 px-6 py-4 border-0 border-b border-(--line-1) last:border-b-0 bg-transparent text-left cursor-pointer transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--bg-3) max-sm:px-4"
        @click="open(article)"
      >
        <span class="flex flex-col gap-0.5 min-w-0 flex-1">
          <span class="text-[15px] font-semibold text-(--heading)">{{ article.title }}</span>
          <span class="text-[13px] text-(--fg-3)">{{ article.summary }}</span>
        </span>
        <ChevronRight :size="16" class="shrink-0 text-(--fg-4)" />
      </button>
    </section>

    <!-- Topics -->
    <div v-else class="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <section
        v-for="group in groups"
        :key="group.topic"
        class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) px-6 pt-5 pb-3 max-sm:px-4"
      >
        <h2 class="m-0 mb-2 flex items-center gap-2.5 text-base font-semibold text-(--heading)">
          <span class="w-8 h-8 rounded-full bg-(--brand-blue-soft) text-(--brand-blue) flex items-center justify-center shrink-0">
            <component :is="group.icon" :size="16" />
          </span>
          {{ group.label }}
        </h2>
        <ul class="m-0 p-0 list-none">
          <li v-for="article in group.articles" :key="article.slug" class="border-b border-(--line-1) last:border-b-0">
            <button
              class="flex w-full items-center gap-3 py-3 border-0 bg-transparent text-left cursor-pointer text-sm text-(--fg-2) hover:text-(--link)"
              @click="open(article)"
            >
              <span class="flex-1">{{ article.title }}</span>
              <ChevronRight :size="14" class="shrink-0 text-(--fg-4)" />
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
