<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { RaButton } from '@roboacademy/ui'
import { Search, Loader2, Compass, AlertTriangle } from 'lucide-vue-next'
import { ApiError, type PageMeta } from '@/api/client'
import { listCourseCatalog, listLearningPaths, type CourseCatalogItem, type LearningPathItem } from '@/api/learning'
import CourseCatalogCard from '@/components/explore/CourseCatalogCard.vue'
import PathCatalogCard from '@/components/explore/PathCatalogCard.vue'

type Tab = 'courses' | 'paths'
type Level = 'All' | 'Beginner' | 'Intermediate' | 'Advanced'

const tabs: { id: Tab; label: string }[] = [
  { id: 'courses', label: 'Courses' },
  { id: 'paths', label: 'Learning Paths' },
]
const levels: Level[] = ['All', 'Beginner', 'Intermediate', 'Advanced']
const pageSize = 24

const route = useRoute()
// Lets other pages (e.g. the dashboard's "View All Paths" links) deep-link straight into the
// Learning Paths tab via /app/explore?tab=paths — checked once on load, not reactively watched.
const activeTab = ref<Tab>(route.query.tab === 'paths' ? 'paths' : 'courses')
const searchInput = ref('')
const search = ref('')
const activeCategory = ref('All')
const activeLevel = ref<Level>('All')

const courseItems = ref<CourseCatalogItem[]>([])
const pathItems = ref<LearningPathItem[]>([])
const meta = ref<PageMeta | null>(null)
const status = ref<'idle' | 'loading' | 'loading-more' | 'error'>('idle')
const errorMessage = ref('')

const categories = computed(() => [
  'All',
  ...new Set(courseItems.value.map(c => c.category).filter((c): c is string => !!c)),
])

const filteredCourses = computed(() => courseItems.value.filter(c => {
  if (activeCategory.value !== 'All' && c.category !== activeCategory.value) return false
  if (activeLevel.value !== 'All' && c.level !== activeLevel.value) return false
  return true
}))

const emptyMessage = computed(() => {
  const noun = activeTab.value === 'courses' ? 'courses' : 'learning paths'
  if (search.value) return `No ${noun} match "${search.value}".`
  if (activeTab.value === 'courses' && (activeCategory.value !== 'All' || activeLevel.value !== 'All')) {
    return `No ${noun} match your filters.`
  }
  return `No ${noun} available yet.`
})

let debounceHandle: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(debounceHandle)
  debounceHandle = setTimeout(() => { search.value = value }, 350)
})

watch(activeTab, () => {
  activeCategory.value = 'All'
  activeLevel.value = 'All'
  courseItems.value = []
  pathItems.value = []
  meta.value = null
})

let fetchId = 0
async function fetchPage(reset: boolean) {
  const requestId = ++fetchId
  status.value = reset ? 'loading' : 'loading-more'
  errorMessage.value = ''
  const targetPage = reset ? 1 : (meta.value?.page ?? 0) + 1
  try {
    const params = { search: search.value, page: targetPage, pageSize }
    if (activeTab.value === 'courses') {
      const result = await listCourseCatalog(params)
      if (requestId !== fetchId) return
      courseItems.value = reset ? result.data : [...courseItems.value, ...result.data]
      meta.value = result.meta
    } else {
      const result = await listLearningPaths(params)
      if (requestId !== fetchId) return
      pathItems.value = reset ? result.data : [...pathItems.value, ...result.data]
      meta.value = result.meta
    }
    status.value = 'idle'
  } catch (err) {
    if (requestId !== fetchId) return
    status.value = 'error'
    errorMessage.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  }
}

watch([activeTab, search], () => { fetchPage(true) }, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-7 px-8 pt-8 pb-12 max-w-(--content-max) mx-auto max-sm:gap-5 max-sm:px-4 max-sm:pt-5 max-sm:pb-8">
    <!-- Header -->
    <div>
      <h1 class="m-0 text-[32px] font-bold text-(--fg-1) tracking-[-0.01em] max-sm:text-2xl">Explore</h1>
      <p class="mt-2 mb-0 text-sm text-(--fg-3)">Browse courses and learning paths, and enroll in something new.</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2">
      <button
        v-for="tab in tabs" :key="tab.id"
        class="py-2 px-4 rounded-(--ra-pill) text-sm font-semibold cursor-pointer border transition-colors duration-(--dur-1) ease-(--ease-out)"
        :class="activeTab === tab.id
          ? 'bg-(--brand-blue-soft) text-(--brand-blue) border-(--brand-blue-ring)'
          : 'bg-transparent text-(--fg-3) border-(--line-2) hover:bg-(--bg-3) hover:text-(--fg-1)'"
        @click="activeTab = tab.id"
      >{{ tab.label }}</button>
    </div>

    <!-- Search -->
    <div class="relative max-w-140">
      <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-(--fg-4)" />
      <input
        v-model="searchInput"
        type="text"
        :placeholder="activeTab === 'courses' ? 'Search courses...' : 'Search learning paths...'"
        class="w-full bg-(--bg-2) text-(--fg-1) border border-(--line-2) rounded-(--ra-md) py-2.5 pl-9 pr-3 text-sm outline-none transition-colors duration-(--dur-1) ease-(--ease-out) placeholder:text-(--fg-4) focus:border-(--brand-blue-ring)"
      />
    </div>

    <!-- Filters (courses only) -->
    <div v-if="activeTab === 'courses'" class="flex flex-col gap-3">
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="cat in categories" :key="cat"
          class="py-1.5 px-3 rounded-(--ra-pill) text-[13px] font-medium cursor-pointer border transition-colors duration-(--dur-1) ease-(--ease-out)"
          :class="activeCategory === cat
            ? 'bg-(--brand-blue-soft) text-(--brand-blue) border-(--brand-blue-ring)'
            : 'bg-transparent text-(--fg-3) border-(--line-2) hover:bg-(--bg-3) hover:text-(--fg-1)'"
          @click="activeCategory = cat"
        >{{ cat }}</button>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="lvl in levels" :key="lvl"
          class="py-1 px-2.5 rounded-(--ra-sm) text-xs font-semibold cursor-pointer border transition-colors duration-(--dur-1) ease-(--ease-out)"
          :class="activeLevel === lvl
            ? 'bg-(--bg-4) text-(--fg-1) border-(--line-3)'
            : 'bg-transparent text-(--fg-4) border-(--line-1) hover:text-(--fg-2)'"
          @click="activeLevel = lvl"
        >{{ lvl === 'All' ? 'All levels' : lvl }}</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="flex flex-col items-center gap-3 py-16 text-center">
      <Loader2 :size="22" class="animate-spin text-(--fg-4)" />
      <p class="m-0 text-[13px] text-(--fg-3)">Loading {{ activeTab === 'courses' ? 'courses' : 'learning paths' }}…</p>
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="flex flex-col items-center gap-3 py-16 text-center">
      <div class="w-12 h-12 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="22" /></div>
      <div class="text-sm font-semibold text-(--fg-1)">Something went wrong</div>
      <p class="m-0 text-[13px] text-(--fg-3) max-w-80">{{ errorMessage }}</p>
      <RaButton variant="secondary" @click="fetchPage(true)">Try again</RaButton>
    </div>

    <!-- Results: courses -->
    <template v-else-if="activeTab === 'courses'">
      <div v-if="filteredCourses.length" class="grid gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CourseCatalogCard v-for="course in filteredCourses" :key="course.id" v-bind="course" />
      </div>
      <div v-else class="flex flex-col items-center gap-3 py-16 text-center">
        <div class="w-12 h-12 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-4)"><Compass :size="22" /></div>
        <div class="text-sm font-semibold text-(--fg-1)">{{ emptyMessage }}</div>
        <p class="m-0 text-[13px] text-(--fg-3) max-w-80">Try a different category, level, or search term.</p>
      </div>
    </template>

    <!-- Results: learning paths -->
    <template v-else>
      <div v-if="pathItems.length" class="grid gap-4.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <PathCatalogCard v-for="path in pathItems" :key="path.id" v-bind="path" />
      </div>
      <div v-else class="flex flex-col items-center gap-3 py-16 text-center">
        <div class="w-12 h-12 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-4)"><Compass :size="22" /></div>
        <div class="text-sm font-semibold text-(--fg-1)">{{ emptyMessage }}</div>
        <p class="m-0 text-[13px] text-(--fg-3) max-w-80">Try a different search term.</p>
      </div>
    </template>

    <!-- Load more -->
    <div v-if="meta && meta.page < meta.totalPages && status !== 'loading' && status !== 'error'" class="flex justify-center">
      <RaButton variant="secondary" :disabled="status === 'loading-more'" @click="fetchPage(false)">
        {{ status === 'loading-more' ? 'Loading…' : 'Load more' }}
      </RaButton>
    </div>
  </div>
</template>
