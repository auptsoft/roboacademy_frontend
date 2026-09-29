<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard } from '@roboacademy/ui'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/api/client'
import { getTenantCalendar, type CalendarItem, type CalendarItemKind } from '@/api/scheduling'

// Tenant-wide month view: every event (drafts included), live class and timed lab session, so
// clashes are visible before publishing. Clicking an entry opens its admin page.
const router = useRouter()

const KIND_META: Record<CalendarItemKind, { label: string; dot: string; chip: string }> = {
  event: { label: 'Events', dot: 'bg-(--brand-blue)', chip: 'bg-[color-mix(in_srgb,var(--brand-blue)_14%,transparent)] text-(--brand-blue)' },
  live_class: { label: 'Live classes', dot: 'bg-(--brand-violet)', chip: 'bg-[color-mix(in_srgb,var(--brand-violet)_14%,transparent)] text-(--brand-violet)' },
  lab_session: { label: 'Lab sessions', dot: 'bg-(--success)', chip: 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-(--success)' },
}

const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' }),
) // 1 Jan 2024 was a Monday

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

const today = new Date()
const cursor = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const items = ref<CalendarItem[]>([])
const loading = ref(true)
const expandedDay = ref<string | null>(null)

const monthLabel = computed(() => cursor.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))

const gridDays = computed(() => {
  const first = cursor.value
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const cells = Math.ceil((offset + last.getDate()) / 7) * 7
  return Array.from({ length: cells }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
})

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

async function load() {
  loading.value = true
  const days = gridDays.value
  const last = days[days.length - 1]
  try {
    items.value = await getTenantCalendar(days[0], new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1))
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load the calendar.')
  } finally {
    loading.value = false
  }
}

watch(cursor, () => {
  expandedDay.value = null
  void load()
})
onMounted(load)

function itemsOn(day: Date) {
  return items.value.filter((i) => sameDay(new Date(i.startsAt), day))
}

function shiftMonth(delta: number) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
}

function chipClass(item: CalendarItem) {
  return [
    KIND_META[item.kind].chip,
    item.status === 'Cancelled' && 'line-through opacity-60',
    item.status === 'Draft' && 'border border-dashed border-current opacity-80',
  ]
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Calendar</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Everything scheduled in this school. Dashed entries are unpublished drafts.</p>
      </div>
      <Button @click="router.push('/events')">Manage events</Button>
    </div>

    <RaCard class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" @click="shiftMonth(-1)"><ChevronLeft :size="16" /></Button>
          <Button variant="outline" size="icon" aria-label="Next month" @click="shiftMonth(1)"><ChevronRight :size="16" /></Button>
          <h2 class="m-0 ml-2 text-lg font-semibold text-(--fg-1)">{{ monthLabel }}</h2>
          <Loader2 v-if="loading" :size="16" class="animate-spin text-(--fg-3)" />
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <span v-for="(meta, kind) in KIND_META" :key="kind" class="inline-flex items-center gap-1.5 text-xs text-(--fg-3)">
            <span class="size-2 rounded-full" :class="meta.dot" />{{ meta.label }}
          </span>
          <Button variant="outline" size="sm" @click="cursor = new Date(today.getFullYear(), today.getMonth(), 1)">Today</Button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <div class="grid min-w-[720px] grid-cols-7 border-t border-l border-(--line-1)">
          <div v-for="d in WEEKDAYS" :key="d" class="border-r border-b border-(--line-1) px-2 py-2 text-xs font-semibold text-(--fg-3)">{{ d }}</div>
          <div
            v-for="day in gridDays"
            :key="day.toISOString()"
            class="flex min-h-[120px] flex-col gap-1 border-r border-b border-(--line-1) p-1.5"
            :class="day.getMonth() === cursor.getMonth() ? '' : 'bg-(--bg-2)'"
          >
            <span
              class="flex size-6 items-center justify-center self-start rounded-full text-xs"
              :class="sameDay(day, today) ? 'bg-(--brand-blue) font-semibold text-white' : day.getMonth() === cursor.getMonth() ? 'text-(--fg-2)' : 'text-(--fg-4)'"
            >{{ day.getDate() }}</span>
            <button
              v-for="item in (expandedDay === day.toDateString() ? itemsOn(day) : itemsOn(day).slice(0, 3))"
              :key="item.kind + item.id"
              class="w-full truncate rounded-sm border-0 px-1.5 py-1 text-left text-[11px] leading-tight cursor-pointer hover:opacity-80"
              :class="chipClass(item)"
              :title="`${item.title} · ${time.format(new Date(item.startsAt))}${item.status === 'Draft' ? ' · Draft' : ''}`"
              @click="router.push(item.linkPath)"
            >{{ time.format(new Date(item.startsAt)) }} {{ item.title }}</button>
            <button
              v-if="itemsOn(day).length > 3 && expandedDay !== day.toDateString()"
              class="self-start border-0 bg-transparent p-0 px-1.5 text-[11px] font-medium text-(--brand-blue) cursor-pointer hover:underline"
              @click="expandedDay = day.toDateString()"
            >+{{ itemsOn(day).length - 3 }} more</button>
          </div>
        </div>
      </div>
    </RaCard>
  </div>
</template>
