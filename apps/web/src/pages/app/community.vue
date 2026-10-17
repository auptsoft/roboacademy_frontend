<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, ChevronRight, Loader2, UsersRound, Users } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import { getCommunityHome, getCourseQA, type CommunityHome, type Space } from '@/api/community'
import { brandingKey, featureConfirmed } from '@/branding'
import SpaceFeed from '@/components/community/SpaceFeed.vue'

// Community: the school board and the learner's class boards as tabs, or - at
// /app/community/courses/:courseId - one course's Q&A in full.

const route = useRoute()
const router = useRouter()
const branding = inject(brandingKey, null)
const brandingLoaded = computed(() => branding?.value?.features !== undefined)
const available = computed(() =>
  ['community_board', 'community_qa', 'community_study_groups'].some((key) => featureConfirmed(branding?.value, key)))

const courseId = computed(() => (route.params.courseId ? String(route.params.courseId) : null))
const home = ref<CommunityHome | null>(null)
const courseSpace = ref<Space | null>(null)
const status = ref<'loading' | 'idle' | 'error' | 'not-found'>('loading')

const boards = computed<Space[]>(() => {
  if (!home.value) return []
  return [...(home.value.schoolBoard ? [home.value.schoolBoard] : []), ...home.value.classBoards]
})
const activeId = computed(() => String(route.query.board ?? boards.value[0]?.id ?? ''))
const active = computed(() =>
  courseId.value ? courseSpace.value : boards.value.find((b) => b.id === activeId.value) ?? boards.value[0] ?? null)

async function load() {
  if (!available.value) return
  status.value = 'loading'
  try {
    home.value = await getCommunityHome()
    courseSpace.value = courseId.value ? await getCourseQA(courseId.value) : null
    status.value = 'idle'
  } catch (e) {
    status.value = e instanceof ApiError && (e.status === 404 || e.status === 403) ? 'not-found' : 'error'
  }
}
watch([available, courseId], load, { immediate: true })

function selectBoard(id: string) {
  router.replace({ query: { ...route.query, board: id } })
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-12 pt-12 pb-12 max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <button
      v-if="courseId"
      class="self-start inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-[13px] font-medium text-(--fg-3) hover:text-(--fg-1)"
      @click="router.push(`/app/courses/${courseId}`)"
    >
      <ArrowLeft :size="16" /> Back to the course
    </button>

    <header class="flex flex-col gap-1">
      <h1 class="m-0 text-[28px] font-semibold tracking-[-0.01em] text-(--heading) max-sm:text-2xl">
        {{ courseId ? (courseSpace ? `${courseSpace.name}: questions` : 'Questions') : 'Community' }}
      </h1>
      <p class="m-0 text-sm text-(--fg-3)">
        {{ courseId ? 'Ask about the course and help each other out.' : 'News from your school and your classes.' }}
      </p>
    </header>

    <div v-if="!brandingLoaded" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <p v-else-if="!available" class="m-0 py-16 text-center text-[13px] text-(--fg-3)">Community isn't available at your school.</p>
    <div v-else-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <div v-else-if="status !== 'idle' || !home" class="flex flex-col items-center gap-3 py-16 text-center">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-(--danger-soft) text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">
        {{ status === 'not-found' ? "This isn't open to you." : "Couldn't load the community." }}
      </p>
      <RaButton v-if="status === 'error'" variant="secondary" @click="load">Try again</RaButton>
    </div>

    <template v-else>
      <button
        v-if="!courseId && home.studyGroupsOn"
        type="button"
        class="flex items-center gap-3 rounded-(--ra-lg) border border-(--line-2) bg-(--bg-1) px-4 py-3 text-left cursor-pointer hover:border-(--brand-blue)"
        @click="router.push('/app/community/groups')"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-(--brand-blue-soft) text-(--brand-blue)"><UsersRound :size="18" /></span>
        <span class="flex flex-1 flex-col">
          <span class="text-sm font-semibold text-(--fg-1)">Study groups</span>
          <span class="text-[13px] text-(--fg-3)">Work through a course with classmates.</span>
        </span>
        <ChevronRight :size="18" class="text-(--fg-3)" />
      </button>

      <nav v-if="!courseId && boards.length > 1" class="flex flex-wrap gap-1.5" aria-label="Boards">
        <button
          v-for="board in boards"
          :key="board.id"
          type="button"
          :aria-current="active?.id === board.id ? 'page' : undefined"
          :class="[
            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold cursor-pointer',
            active?.id === board.id ? 'border-(--brand-blue) bg-(--brand-blue-soft) text-(--brand-blue)' : 'border-(--line-2) bg-transparent text-(--fg-2) hover:text-(--fg-1)',
          ]"
          @click="selectBoard(board.id)"
        >
          <Users v-if="board.kind === 'ClassBoard'" :size="14" />
          {{ board.name }}
        </button>
      </nav>

      <SpaceFeed v-if="active" :key="active.id" :space="active" :home="home" open-after-post />
      <p v-else-if="home.boardOn" class="m-0 py-16 text-center text-[13px] text-(--fg-3)">There are no boards for you yet.</p>
    </template>
  </div>
</template>
