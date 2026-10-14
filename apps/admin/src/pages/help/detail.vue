<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RaCard } from '@roboacademy/ui'
import { ArrowLeft, ArrowRight, ChevronRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/api/client'
import { getHelpArticle, listHelpArticles, type HelpArticle, type HelpArticleSummary } from '@/api/help'
import { helpLinkLabel, helpTopicLabel } from '@/lib/help'
import { renderRichText } from '@/lib/rich-text'
import { useAIAvailability } from '@/composables/useAIAvailability'
import { useStaffAssistant } from '@/composables/useStaffAssistant'

const route = useRoute()
const router = useRouter()

const { feature } = useAIAvailability()
const { openAssistant } = useStaffAssistant()

const article = ref<HelpArticle | null>(null)
const related = ref<HelpArticleSummary[]>([])
const status = ref<'loading' | 'idle' | 'not-found' | 'error'>('loading')

const slug = computed(() => String(route.params.slug ?? ''))
const html = computed(() => renderRichText(article.value?.body))

async function load() {
  status.value = 'loading'
  related.value = []
  try {
    article.value = await getHelpArticle(slug.value)
    status.value = 'idle'
    const sameTopic = await listHelpArticles({ topic: article.value.topic }).catch(() => [])
    related.value = sameTopic.filter((a) => a.slug !== slug.value)
  } catch (error) {
    status.value = error instanceof ApiError && error.status === 404 ? 'not-found' : 'error'
  }
}

// Guides link to each other ("/help/...") and to admin pages; keep those inside the app.
function onBodyClick(event: MouseEvent) {
  const href = (event.target as HTMLElement).closest('a')?.getAttribute('href')
  if (href?.startsWith('/') && !href.startsWith('//')) {
    event.preventDefault()
    router.push(href)
  }
}

watch(slug, load, { immediate: true })
</script>

<template>
  <div class="flex max-w-[820px] mx-auto flex-col gap-6 pt-8 px-8 pb-12 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <button
      class="inline-flex w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] text-(--fg-3) hover:text-(--fg-2)"
      @click="router.push('/help')"
    >
      <ArrowLeft :size="14" /> Help
    </button>

    <p v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </p>

    <RaCard v-else-if="status !== 'idle' || !article" class="flex flex-col items-center gap-3 text-center">
      <p class="m-0 text-[13px] text-(--fg-3)">
        {{ status === 'not-found' ? "This guide doesn't exist or doesn't apply to your role or school." : "Couldn't load this guide." }}
      </p>
      <Button v-if="status === 'error'" variant="outline" @click="load">Try again</Button>
    </RaCard>

    <template v-else>
      <RaCard>
        <span class="text-[11px] font-semibold uppercase tracking-[0.06em] text-(--fg-4)">{{ helpTopicLabel(article.topic) }}</span>
        <h1 class="m-0 mt-2 text-[26px] font-bold tracking-[-0.01em] text-(--fg-1)">{{ article.title }}</h1>
        <p class="m-0 mt-2 text-[15px] text-(--fg-3)">{{ article.summary }}</p>

        <div class="rich-text mt-6 text-sm leading-[1.7] text-(--fg-2)" @click="onBodyClick" v-html="html" />

        <div v-if="article.links.length" class="mt-7 flex flex-wrap gap-2">
          <Button v-for="link in article.links" :key="link" variant="outline" @click="router.push(link)">
            {{ helpLinkLabel(link) }}
            <ArrowRight :size="14" />
          </Button>
        </div>
      </RaCard>

      <RaCard v-if="feature('StaffAssistant')?.available" class="flex items-center gap-4 max-sm:flex-col max-sm:items-stretch">
        <div class="flex-1">
          <div class="text-sm font-semibold text-(--fg-1)">Still stuck?</div>
          <p class="m-0 mt-1 text-[13px] text-(--fg-3)">The assistant can look into it with you.</p>
        </div>
        <Button @click="openAssistant(`I read the guide &quot;${article.title}&quot; and I'm still stuck.`)">Ask the assistant</Button>
      </RaCard>

      <section v-if="related.length" class="flex flex-col gap-2">
        <h2 class="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-(--fg-3)">More in {{ helpTopicLabel(article.topic) }}</h2>
        <RaCard :padding="0" class="overflow-hidden">
          <button
            v-for="item in related"
            :key="item.slug"
            class="flex w-full cursor-pointer items-center gap-3 border-0 border-b border-(--line-1) bg-transparent px-6 py-3.5 text-left text-sm text-(--fg-2) last:border-b-0 hover:bg-(--bg-3)"
            @click="router.push(`/help/${item.slug}`)"
          >
            <span class="flex-1">{{ item.title }}</span>
            <ChevronRight :size="14" class="shrink-0 text-(--fg-4)" />
          </button>
        </RaCard>
      </section>
    </template>
  </div>
</template>
