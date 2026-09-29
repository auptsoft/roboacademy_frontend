<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Pagination from '@/components/Pagination.vue'
import EventFormDialog from '@/components/EventFormDialog.vue'
import { usePagedList } from '@/composables/usePagedList'
import { eventTypeLabel, listEvents, type EventDetail, type EventStatus } from '@/api/scheduling'

const router = useRouter()

const filters = reactive<{ status: EventStatus | ''; upcoming: boolean; search: string }>({
  status: '',
  upcoming: true,
  search: '',
})

const { items: events, loading, page, pageSize, meta, totalPages, load, goToPage, setPageSize } = usePagedList(
  (page, pageSize) =>
    listEvents(
      { status: filters.status || undefined, upcoming: filters.upcoming, search: filters.search || undefined },
      page,
      pageSize,
    ),
  { initialPageSize: 20, errorMessage: 'Failed to load events.' },
)

onMounted(load)

let searchDebounce: ReturnType<typeof setTimeout> | undefined
watch(() => filters.search, () => {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => { page.value = 1; load() }, 300)
})
watch(() => [filters.status, filters.upcoming], () => { page.value = 1; load() })

function statusTone(status: EventStatus) {
  return status === 'Published' ? 'info' : status === 'Cancelled' ? 'admin' : 'neutral'
}

function seats(e: { capacity: number | null; goingCount: number; waitlistCount: number }): string {
  const going = e.capacity === null ? `${e.goingCount}` : `${e.goingCount} / ${e.capacity}`
  return e.waitlistCount ? `${going} (+${e.waitlistCount} waiting)` : going
}

const createOpen = ref(false)

function onCreated(created: EventDetail) {
  router.push(`/events/${created.id}`)
}

const rowClass =
  'grid grid-cols-[2fr_1.4fr_110px_140px_110px] items-center py-3.5 px-6 cursor-pointer transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Events</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Workshops, competitions, open days and more. Learners are notified when you publish, and reminded the day before.</p>
      </div>
      <Button @click="createOpen = true">
        <Plus :size="14" /> New Event
      </Button>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) p-4">
        <select
          v-model="filters.status"
          aria-label="Filter by status"
          class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
        >
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Published">Published</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-(--fg-2)">
          <input v-model="filters.upcoming" type="checkbox" class="size-4" />
          Upcoming only
        </label>
        <Input v-model="filters.search" placeholder="Search by title…" class="h-9 flex-1 min-w-48" />
      </div>

      <div class="grid grid-cols-[2fr_1.4fr_110px_140px_110px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Title</span>
        <span>When</span>
        <span>Type</span>
        <span>Going</span>
        <span>Status</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading events…</p>
      <p v-else-if="events.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
        No events match these filters.
      </p>

      <div
        v-for="(item, i) in events"
        :key="item.id"
        :class="[rowClass, i < events.length - 1 && 'border-b border-(--line-1)']"
        role="link"
        tabindex="0"
        @click="router.push(`/events/${item.id}`)"
        @keydown.enter="router.push(`/events/${item.id}`)"
      >
        <div class="text-sm font-semibold text-(--fg-1) max-md:w-full">{{ item.title }}</div>
        <div class="text-sm text-(--fg-2)">{{ formatDate(item.startsAt) }}</div>
        <div class="text-sm text-(--fg-3)">{{ eventTypeLabel(item.type) }}</div>
        <div class="text-sm text-(--fg-2)">{{ seats(item) }}</div>
        <div><RaChip :tone="statusTone(item.status)">{{ item.status }}</RaChip></div>
      </div>

      <Pagination
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-count="meta?.totalCount ?? 0"
        @update:page="goToPage"
        @update:page-size="setPageSize"
      />
    </RaCard>

    <EventFormDialog v-model:open="createOpen" @saved="onCreated" />
  </div>
</template>
