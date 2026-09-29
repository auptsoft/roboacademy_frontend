<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, CalendarDays, CalendarX, Loader2 } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { listEvents, type EventItem } from '@/api/scheduling'
import FolderTabs from '@/components/layout/FolderTabs.vue'
import EventListItem from '@/components/events/EventListItem.vue'

type Tab = 'upcoming' | 'past'

const router = useRouter()

const PAGE_SIZE = 20
const tabs: { id: Tab; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

const tab = ref<Tab>('upcoming')
const events = ref<EventItem[]>([])
const page = ref(1)
const totalPages = ref(0)
const status = ref<'loading' | 'idle' | 'error'>('loading')
const loadingMore = ref(false)

async function load(reset = true) {
  if (reset) {
    status.value = 'loading'
    page.value = 1
  } else {
    loadingMore.value = true
  }
  try {
    const { data, meta } = await listEvents({ past: tab.value === 'past', page: page.value, pageSize: PAGE_SIZE })
    events.value = reset ? data : [...events.value, ...data]
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

watch(tab, () => load(), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-12 pb-12 max-w-[960px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <div class="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
      <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">Events</h1>
      <RaButton variant="secondary" @click="router.push('/app/calendar')">
        <template #icon><CalendarDays :size="16" /></template>
        My calendar
      </RaButton>
    </div>

    <div>
      <FolderTabs v-model="tab" :tabs="tabs" />

      <section class="bg-(--surface) rounded-(--ra-xl) rounded-tl-none shadow-(--surface-shadow) overflow-hidden">
        <div v-if="status === 'loading'" class="flex items-center gap-2 p-6 text-[13px] text-(--fg-3)">
          <Loader2 :size="16" class="animate-spin" /> Loading…
        </div>
        <div v-else-if="status === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
          <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
          <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load events.</p>
          <RaButton variant="secondary" @click="load()">Try again</RaButton>
        </div>
        <div v-else-if="!events.length" class="flex flex-col items-center gap-3 py-16 text-center">
          <div class="w-10 h-10 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-3)"><CalendarX :size="18" /></div>
          <p class="m-0 text-[13px] text-(--fg-3)">{{ tab === 'upcoming' ? 'No upcoming events right now — check back soon.' : 'No past events yet.' }}</p>
        </div>
        <template v-else>
          <EventListItem v-for="e in events" :key="e.id" :event="e" @open="router.push(`/app/events/${e.id}`)" />
        </template>
      </section>
    </div>

    <div v-if="status === 'idle' && page < totalPages" class="flex justify-center">
      <RaButton variant="secondary" :disabled="loadingMore" @click="loadMore">
        <template v-if="loadingMore" #icon><Loader2 :size="16" class="animate-spin" /></template>
        Load more
      </RaButton>
    </div>
  </div>
</template>
