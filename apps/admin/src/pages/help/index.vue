<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { RaCard } from '@roboacademy/ui'
import { ChevronRight, Loader2, Search } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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
  router.push(`/help/${article.slug}`)
}

onMounted(load)
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Help</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">Step-by-step guides for the parts of the admin app you use.</p>
    </div>

    <div class="relative max-w-140">
      <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-(--fg-4)" />
      <input
        v-model="searchInput"
        type="search"
        placeholder="Search guides, e.g. “grade” or “import users”"
        aria-label="Search guides"
        class="w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) py-2.5 pl-9 pr-3 text-sm text-(--fg-1) outline-none placeholder:text-(--fg-4) focus:border-(--brand-blue)"
      />
    </div>

    <p v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading guides…
    </p>

    <RaCard v-else-if="status === 'error'" class="flex flex-col items-center gap-3 text-center">
      <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load the guides.</p>
      <Button variant="outline" @click="load">Try again</Button>
    </RaCard>

    <RaCard v-else-if="query" :padding="0" class="overflow-hidden">
      <p v-if="searching" class="flex items-center gap-2 p-6 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Searching…
      </p>
      <div v-else-if="!results.length" class="flex flex-col items-center gap-3 p-8 text-center">
        <p class="m-0 text-[13px] text-(--fg-3)">No guides match “{{ query }}”. Try another word, or browse the topics.</p>
        <Button variant="outline" @click="searchInput = ''">Show all topics</Button>
      </div>
      <button
        v-for="article in results"
        v-else
        :key="article.slug"
        class="flex w-full cursor-pointer items-center gap-4 border-0 border-b border-(--line-1) bg-transparent px-6 py-4 text-left last:border-b-0 hover:bg-(--bg-3)"
        @click="open(article)"
      >
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-[15px] font-semibold text-(--fg-1)">{{ article.title }}</span>
          <span class="text-[13px] text-(--fg-3)">{{ article.summary }}</span>
        </span>
        <ChevronRight :size="16" class="shrink-0 text-(--fg-4)" />
      </button>
    </RaCard>

    <div v-else class="grid grid-cols-2 gap-5 max-md:grid-cols-1">
      <RaCard v-for="group in groups" :key="group.topic">
        <h2 class="m-0 mb-2 flex items-center gap-2.5 text-base font-semibold text-(--fg-1)">
          <component :is="group.icon" :size="18" class="text-(--brand-blue)" />
          {{ group.label }}
        </h2>
        <ul class="m-0 list-none p-0">
          <li v-for="article in group.articles" :key="article.slug" class="border-b border-(--line-1) last:border-b-0">
            <button
              class="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-2.5 text-left text-sm text-(--fg-2) hover:text-(--brand-blue)"
              @click="open(article)"
            >
              <span class="flex-1">{{ article.title }}</span>
              <ChevronRight :size="14" class="shrink-0 text-(--fg-4)" />
            </button>
          </li>
        </ul>
      </RaCard>
    </div>
  </div>
</template>
