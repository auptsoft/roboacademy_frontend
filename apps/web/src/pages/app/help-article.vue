<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RaButton } from '@roboacademy/ui'
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronRight, Loader2 } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { getHelpArticle, listHelpArticles, type HelpArticle, type HelpArticleSummary } from '@/api/help'
import { brandingKey } from '@/branding'
import { useAIAvailability } from '@/composables/useAIAvailability'
import { useAssistant } from '@/composables/useAssistant'
import { helpLinkLabel, helpTopicLabel } from '@/lib/help'
import { renderRichText } from '@/lib/rich-text'

const route = useRoute()
const router = useRouter()
const branding = inject(brandingKey, null)

const article = ref<HelpArticle | null>(null)
const related = ref<HelpArticleSummary[]>([])
const status = ref<'loading' | 'idle' | 'not-found' | 'error'>('loading')

const { assistantAvailable } = useAIAvailability()
const { openAssistant } = useAssistant()

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

// Articles link to each other and to app pages; keep those inside the app instead of reloading.
function onBodyClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a')
  const href = anchor?.getAttribute('href')
  if (href?.startsWith('/app')) {
    event.preventDefault()
    router.push(href)
  }
}

watch(slug, load, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-12 pb-12 max-w-[760px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <button
      class="inline-flex w-fit items-center gap-1.5 border-0 bg-transparent p-0 cursor-pointer text-[13px] text-(--fg-3) hover:text-(--fg-2)"
      @click="router.push('/app/help')"
    >
      <ArrowLeft :size="14" /> Help Center
    </button>

    <div v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>

    <section
      v-else-if="status !== 'idle' || !article"
      class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) flex flex-col items-center gap-3 py-12 px-6 text-center"
    >
      <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">
        {{ status === 'not-found' ? "This guide doesn't exist or doesn't apply to your school." : "Couldn't load this guide." }}
      </p>
      <RaButton v-if="status === 'error'" variant="secondary" @click="load">Try again</RaButton>
    </section>

    <template v-else>
      <article class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) px-9 pt-8 pb-9 max-sm:px-5 max-sm:pt-6">
        <span class="text-[11px] font-semibold uppercase tracking-[0.06em] text-(--fg-4)">{{ helpTopicLabel(article.topic) }}</span>
        <h1 class="m-0 mt-2 text-[26px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-[22px]">{{ article.title }}</h1>
        <p class="m-0 mt-2 text-[15px] text-(--fg-3)">{{ article.summary }}</p>

        <div class="rich-text mt-6 text-(--fg-2) leading-[1.7]" @click="onBodyClick" v-html="html"></div>

        <div v-if="article.links.length" class="mt-7 flex flex-wrap gap-2">
          <RaButton v-for="link in article.links" :key="link" variant="secondary" @click="router.push(link)">
            {{ helpLinkLabel(link) }}
            <template #icon-right><ArrowRight :size="14" /></template>
          </RaButton>
        </div>
      </article>

      <section class="flex items-center gap-4 rounded-(--ra-xl) border border-(--line-1) px-6 py-5 max-sm:flex-col max-sm:items-stretch max-sm:px-4">
        <div class="flex-1">
          <div class="text-sm font-semibold text-(--heading)">Still stuck?</div>
          <p class="m-0 mt-1 text-[13px] text-(--fg-3)">
            {{ assistantAvailable ? 'The assistant can look into it with you. Or ask' : 'Ask' }} your teacher, or contact your {{ branding?.name || 'school' }} administrator.
          </p>
        </div>
        <RaButton v-if="assistantAvailable" @click="openAssistant(`I read the guide &quot;${article.title}&quot; and I'm still stuck.`)">
          Ask the assistant
        </RaButton>
      </section>

      <section v-if="related.length" class="flex flex-col gap-2">
        <h2 class="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-(--fg-3)">More in {{ helpTopicLabel(article.topic) }}</h2>
        <div class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) overflow-hidden">
          <button
            v-for="item in related"
            :key="item.slug"
            class="flex w-full items-center gap-3 px-6 py-3.5 border-0 border-b border-(--line-1) last:border-b-0 bg-transparent text-left cursor-pointer text-sm text-(--fg-2) hover:bg-(--bg-3) max-sm:px-4"
            @click="router.push(`/app/help/${item.slug}`)"
          >
            <span class="flex-1">{{ item.title }}</span>
            <ChevronRight :size="14" class="shrink-0 text-(--fg-4)" />
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
