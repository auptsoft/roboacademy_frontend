<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, Loader2, MessageSquarePlus } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { listPosts, type CommunityHome, type PostDetail, type PostFilter, type PostSort, type PostSummary, type Space } from '@/api/community'
import PostComposer from './PostComposer.vue'
import PostListItem from './PostListItem.vue'

// The posts in one space - a board or a course's Q&A - with the composer on top. Q&A can be
// narrowed to one lesson (the lesson panel) and filtered to unanswered questions or the learner's own.

const props = defineProps<{
  space: Space
  home: CommunityHome
  lessonId?: string | null
  sceneId?: string | null
  /** Open the new post after creating it (the full page) rather than staying on the list (the panel). */
  openAfterPost?: boolean
  compact?: boolean
}>()

const router = useRouter()
const isQA = computed(() => props.space.kind === 'CourseQA')

const posts = ref<PostSummary[]>([])
const page = ref(1)
const totalPages = ref(1)
const status = ref<'loading' | 'idle' | 'error'>('loading')
const loadingMore = ref(false)
const filter = ref<PostFilter>('all')
const sort = ref<PostSort>('recent')
const composing = ref(false)
const notice = ref('')

const filters = computed<{ value: PostFilter; label: string }[]>(() =>
  isQA.value
    ? [{ value: 'all', label: 'All' }, { value: 'unanswered', label: 'Unanswered' }, { value: 'mine', label: 'Mine' }]
    : [])

async function load(reset = true) {
  if (reset) {
    status.value = 'loading'
    page.value = 1
  } else {
    loadingMore.value = true
  }
  try {
    const result = await listPosts(props.space.id, {
      lessonId: props.lessonId, sceneId: props.sceneId, filter: filter.value, sort: sort.value, page: page.value,
    })
    posts.value = reset ? result.data : [...posts.value, ...result.data]
    totalPages.value = result.meta.totalPages
    status.value = 'idle'
  } catch {
    if (reset) status.value = 'error'
  } finally {
    loadingMore.value = false
  }
}

function loadMore() {
  page.value += 1
  load(false)
}

watch(() => [props.space.id, props.lessonId, props.sceneId, filter.value, sort.value], () => load(), { immediate: true })

function onCreated(detail: PostDetail, message: string) {
  composing.value = false
  notice.value = message
  if (props.openAfterPost && detail.post.status === 'Visible') {
    router.push(`/app/community/posts/${detail.post.id}`)
    return
  }
  posts.value = [detail.post, ...posts.value.filter((p) => p.id !== detail.post.id)]
}

const muted = computed(() => !!props.home.mutedUntil && Date.parse(props.home.mutedUntil) > Date.now())
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <div v-if="filters.length" class="flex gap-1">
        <button
          v-for="option in filters"
          :key="option.value"
          type="button"
          :class="[
            'rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer',
            filter === option.value ? 'border-(--brand-blue) bg-(--brand-blue-soft) text-(--brand-blue)' : 'border-(--line-2) bg-transparent text-(--fg-3)',
          ]"
          @click="filter = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <select
        v-if="isQA"
        v-model="sort"
        aria-label="Sort"
        class="rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-2 py-1 text-xs text-(--fg-2)"
      >
        <option value="recent">Latest activity</option>
        <option value="new">Newest</option>
        <option value="top">Most asked</option>
      </select>
      <RaButton v-if="space.canPost && !composing && !muted" class="ml-auto" @click="composing = true">
        <template #icon><MessageSquarePlus :size="16" /></template>
        {{ isQA ? 'Ask a question' : 'New post' }}
      </RaButton>
    </div>

    <p v-if="muted" class="m-0 rounded-(--ra-md) bg-(--warning-soft) px-3 py-2 text-[13px] text-(--fg-1)">
      You've been muted, so you can read but not post right now.
    </p>
    <p v-if="notice" class="m-0 rounded-(--ra-md) bg-(--success-soft) px-3 py-2 text-[13px] text-(--fg-1)">{{ notice }}</p>

    <div v-if="composing" :class="compact ? '' : 'rounded-(--ra-xl) bg-(--surface) p-5 shadow-(--surface-shadow)'">
      <PostComposer
        :space="space"
        :rules="home.rules"
        :is-staff="home.isStaff"
        :sim-runs-on="home.simRunsOn"
        :lesson-id="lessonId"
        :scene-id="sceneId"
        @created="onCreated"
        @cancel="composing = false"
      />
    </div>

    <div v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <div v-else-if="status === 'error'" class="flex flex-col items-center gap-3 py-10 text-center">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-(--danger-soft) text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load the posts.</p>
      <RaButton variant="secondary" @click="load()">Try again</RaButton>
    </div>
    <p v-else-if="!posts.length" class="m-0 py-8 text-center text-[13px] text-(--fg-3)">
      {{ isQA ? (lessonId ? 'No questions about this lesson yet.' : 'No questions yet.') : 'Nothing posted here yet.' }}
    </p>
    <template v-else>
      <PostListItem v-for="post in posts" :key="post.id" :post="post" />
      <RaButton v-if="page < totalPages" variant="secondary" class="self-center" :disabled="loadingMore" @click="loadMore">
        <template v-if="loadingMore" #icon><Loader2 :size="16" class="animate-spin" /></template>
        Load more
      </RaButton>
    </template>
  </div>
</template>
