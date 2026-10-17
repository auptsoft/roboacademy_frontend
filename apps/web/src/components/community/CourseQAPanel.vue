<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowRight, Loader2, MessagesSquare, X } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { getCommunityHome, getCourseQA, type CommunityHome, type Space } from '@/api/community'
import SpaceFeed from './SpaceFeed.vue'

// A course's Q&A beside the lesson, narrowed to the lesson open now - so learners see what others
// asked here before asking themselves. Same drawer shape as the tutor panel.

const props = defineProps<{ courseId: string; lessonId: string | null }>()
const open = defineModel<boolean>('open', { default: false })

const home = ref<CommunityHome | null>(null)
const space = ref<Space | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    home.value = home.value ?? await getCommunityHome()
    space.value = await getCourseQA(props.courseId)
  } catch (e) {
    error.value = e instanceof ApiError && e.status === 404
      ? 'Questions open once you join this course.'
      : e instanceof Error ? e.message : "Couldn't load the questions."
  } finally {
    loading.value = false
  }
}

watch(open, (value) => { if (value && !space.value) load() })
watch(() => props.courseId, () => { space.value = null; if (open.value) load() })
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[39] bg-black/40 md:hidden" @click="open = false" />
  <aside
    v-if="open"
    class="fixed top-0 right-0 bottom-0 z-40 flex w-[440px] max-w-full flex-col border-l border-(--line-1) bg-(--bg-0) shadow-xl max-md:w-full"
    aria-label="Questions about this lesson"
  >
    <header class="flex items-center justify-between gap-2 border-b border-(--line-1) px-4 py-3.5">
      <span class="flex items-center gap-2 text-[15px] font-bold text-(--fg-1)">
        <MessagesSquare :size="16" class="text-(--brand-blue)" /> Questions
      </span>
      <button type="button" class="rounded-(--ra-md) border-0 bg-transparent p-1.5 text-(--fg-3) hover:bg-(--bg-3) hover:text-(--fg-1) cursor-pointer" aria-label="Close" @click="open = false">
        <X :size="16" />
      </button>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div v-if="loading" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Loading…
      </div>
      <p v-else-if="error" class="m-0 text-[13px] text-(--fg-3)">{{ error }}</p>
      <template v-else-if="space && home">
        <SpaceFeed :space="space" :home="home" :lesson-id="lessonId" compact />
        <RouterLink
          :to="`/app/community/courses/${courseId}`"
          class="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-(--link) no-underline hover:underline"
        >
          All questions for this course <ArrowRight :size="14" />
        </RouterLink>
      </template>
    </div>
  </aside>
</template>
