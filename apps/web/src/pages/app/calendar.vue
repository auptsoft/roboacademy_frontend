<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Ticket } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { getMyCalendar, type CalendarItem, type CalendarItemKind } from '@/api/scheduling'
import { formatRange, formatTime, isSameDay } from '@/lib/datetime'

const router = useRouter()

type View = 'month' | 'agenda'

const KIND_META: Record<CalendarItemKind, { label: string; dot: string; chip: string }> = {
  event: { label: 'Events', dot: 'bg-(--brand-blue)', chip: 'bg-(--brand-blue-soft) text-(--brand-blue)' },
  live_class: { label: 'Live classes', dot: 'bg-(--brand-violet)', chip: 'bg-[color-mix(in_srgb,var(--brand-violet)_14%,transparent)] text-(--brand-violet)' },
  lab_session: { label: 'Lab sessions', dot: 'bg-(--brand-sand)', chip: 'bg-[color-mix(in_srgb,var(--brand-sand)_18%,transparent)] text-(--brand-sand)' },
}

const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' }),
) // 1 Jan 2024 was a Monday, so this yields Mon..Sun

const today = new Date()
const cursor = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const view = ref<View>(window.matchMedia('(max-width: 767px)').matches ? 'agenda' : 'month')
const items = ref<CalendarItem[]>([])
const status = ref<'loading' | 'idle' | 'error'>('loading')

const monthLabel = computed(() => cursor.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))

// The visible grid: whole weeks (Monday-first) covering the month - 5 or 6 rows.
const gridDays = computed(() => {
  const first = cursor.value
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const cells = Math.ceil((offset + last.getDate()) / 7) * 7
  return Array.from({ length: cells }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
})

async function load() {
  status.value = 'loading'
  const days = gridDays.value
  const from = days[0]
  const to = new Date(days[days.length - 1].getFullYear(), days[days.length - 1].getMonth(), days[days.length - 1].getDate() + 1)
  try {
    items.value = await getMyCalendar(from, to)
    status.value = 'idle'
  } catch {
    status.value = 'error'
  }
}

watch(cursor, load)
onMounted(load)

function shiftMonth(delta: number) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
}

function goToday() {
  cursor.value = new Date(today.getFullYear(), today.getMonth(), 1)
}

function itemsOn(day: Date): CalendarItem[] {
  return items.value.filter(i => isSameDay(new Date(i.startsAt), day))
}

const agenda = computed(() => {
  const inMonth = items.value.filter(i => new Date(i.startsAt).getMonth() === cursor.value.getMonth())
  const groups = new Map<string, { day: Date; items: CalendarItem[] }>()
  for (const item of inMonth) {
    const d = new Date(item.startsAt)
    const key = d.toDateString()
    if (!groups.has(key)) groups.set(key, { day: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [] })
    groups.get(key)!.items.push(item)
  }
  return [...groups.values()]
})

function open(item: CalendarItem) {
  router.push(item.linkPath)
}
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-12 pb-12 max-w-[1440px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">Calendar</h1>
      <div class="flex items-center gap-3">
        <RaButton variant="ghost" @click="router.push('/app/events')">
          <template #icon><Ticket :size="16" /></template>
          Browse events
        </RaButton>
        <div class="flex items-center gap-1 p-1 rounded-(--ra-md) bg-(--bg-3)" role="tablist" aria-label="Calendar view">
          <button
            v-for="v in (['month', 'agenda'] as const)"
            :key="v"
            role="tab"
            :aria-selected="view === v"
            class="px-3 py-1.5 rounded-(--ra-sm) border-0 cursor-pointer text-[13px] font-medium capitalize"
            :class="view === v ? 'bg-(--bg-1) text-(--heading) shadow-(--elev-1)' : 'bg-transparent text-(--fg-3) hover:text-(--fg-1)'"
            @click="view = v"
          >{{ v }}</button>
        </div>
      </div>
    </div>

    <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
      <div class="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div class="flex items-center gap-2">
          <button class="w-8 h-8 rounded-(--ra-md) border border-(--line-2) bg-transparent flex items-center justify-center cursor-pointer text-(--fg-2) hover:bg-(--bg-3)" aria-label="Previous month" @click="shiftMonth(-1)"><ChevronLeft :size="16" /></button>
          <button class="w-8 h-8 rounded-(--ra-md) border border-(--line-2) bg-transparent flex items-center justify-center cursor-pointer text-(--fg-2) hover:bg-(--bg-3)" aria-label="Next month" @click="shiftMonth(1)"><ChevronRight :size="16" /></button>
          <h2 class="m-0 ml-2 text-lg font-medium text-(--heading)">{{ monthLabel }}</h2>
          <Loader2 v-if="status === 'loading'" :size="16" class="animate-spin text-(--fg-3)" />
        </div>
        <div class="flex items-center gap-4 flex-wrap">
          <span v-for="(meta, kind) in KIND_META" :key="kind" class="inline-flex items-center gap-1.5 text-xs text-(--fg-3)">
            <span class="w-2 h-2 rounded-full" :class="meta.dot" />{{ meta.label }}
          </span>
          <RaButton variant="secondary" @click="goToday">Today</RaButton>
        </div>
      </div>

      <div v-if="status === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your calendar.</p>
        <RaButton variant="secondary" @click="load">Try again</RaButton>
      </div>

      <!-- Month grid -->
      <div v-else-if="view === 'month'" class="overflow-x-auto">
        <div class="grid grid-cols-7 min-w-[640px] border-t border-l border-(--line-1)">
          <div v-for="d in WEEKDAYS" :key="d" class="px-2 py-2 text-xs font-semibold text-(--fg-3) border-r border-b border-(--line-1)">{{ d }}</div>
          <div
            v-for="day in gridDays"
            :key="day.toISOString()"
            class="min-h-[112px] p-1.5 border-r border-b border-(--line-1) flex flex-col gap-1"
            :class="day.getMonth() === cursor.getMonth() ? '' : 'bg-(--bg-2)'"
          >
            <span
              class="self-start w-6 h-6 rounded-full flex items-center justify-center text-xs"
              :class="isSameDay(day, today) ? 'bg-(--brand-blue) text-white font-semibold' : day.getMonth() === cursor.getMonth() ? 'text-(--fg-2)' : 'text-(--fg-4)'"
            >{{ day.getDate() }}</span>
            <button
              v-for="item in itemsOn(day).slice(0, 3)"
              :key="item.kind + item.id"
              class="w-full text-left px-1.5 py-1 rounded-(--ra-sm) border-0 cursor-pointer text-[11px] leading-tight truncate hover:opacity-80"
              :class="[KIND_META[item.kind].chip, { 'line-through opacity-60': item.status === 'Cancelled', 'font-semibold': item.attending }]"
              :title="`${item.title} · ${formatRange(item.startsAt, item.endsAt)}`"
              @click="open(item)"
            >{{ formatTime(item.startsAt) }} {{ item.title }}</button>
            <button
              v-if="itemsOn(day).length > 3"
              class="self-start bg-transparent border-0 p-0 px-1.5 cursor-pointer text-[11px] font-medium text-(--link) hover:underline"
              @click="view = 'agenda'"
            >+{{ itemsOn(day).length - 3 }} more</button>
          </div>
        </div>
      </div>

      <!-- Agenda -->
      <template v-else>
        <p v-if="status === 'idle' && !agenda.length" class="m-0 py-10 text-center text-[13px] text-(--fg-3)">Nothing scheduled this month.</p>
        <div v-for="group in agenda" :key="group.day.toISOString()" class="flex gap-4 py-4 border-b border-(--line-1) last:border-b-0 max-sm:flex-col max-sm:gap-2">
          <div class="w-28 shrink-0 text-sm font-medium" :class="isSameDay(group.day, today) ? 'text-(--brand-blue)' : 'text-(--heading)'">
            {{ group.day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) }}
          </div>
          <div class="flex-1 flex flex-col gap-2 min-w-0">
            <button
              v-for="item in group.items"
              :key="item.kind + item.id"
              class="flex items-start gap-3 w-full text-left bg-transparent border-0 p-2 -m-2 rounded-(--ra-md) cursor-pointer hover:bg-(--bg-3)"
              @click="open(item)"
            >
              <span class="mt-1.5 w-2 h-2 shrink-0 rounded-full" :class="KIND_META[item.kind].dot" />
              <span class="flex flex-col gap-0.5 min-w-0">
                <span class="text-sm font-medium text-(--heading)" :class="{ 'line-through opacity-60': item.status === 'Cancelled' }">{{ item.title }}</span>
                <span class="text-[13px] text-(--fg-3)">
                  {{ formatRange(item.startsAt, item.endsAt) }}<template v-if="item.location"> · {{ item.location }}</template>
                  <template v-if="item.kind === 'event' && item.attending"> · Going</template>
                  <template v-if="item.status === 'Cancelled'"> · Cancelled</template>
                </span>
              </span>
            </button>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
