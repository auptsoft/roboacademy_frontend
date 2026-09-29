<script setup lang="ts">
import { computed } from 'vue'
import { MapPin, Video } from 'lucide-vue-next'
import { EVENT_TYPE_LABELS, type EventItem } from '@/api/scheduling'
import { dateBlock, formatRange } from '@/lib/datetime'

const props = defineProps<{ event: EventItem }>()
defineEmits<{ open: [] }>()

const block = computed(() => dateBlock(props.event.startsAt))
const cancelled = computed(() => props.event.status === 'Cancelled')
</script>

<template>
  <button
    class="flex w-full items-center gap-4 px-6 py-4 text-left bg-transparent border-0 border-b border-(--line-1) last:border-b-0 cursor-pointer transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--bg-3) max-sm:px-4"
    @click="$emit('open')"
  >
    <div
      class="w-14 h-14 rounded-(--ra-md) flex flex-col items-center justify-center shrink-0"
      :class="cancelled ? 'bg-(--bg-4) text-(--fg-3)' : 'bg-(--brand-navy) text-(--brand-navy-fg)'"
    >
      <span class="text-[9px] font-semibold uppercase tracking-widest opacity-75">{{ block.month }}</span>
      <span class="text-lg font-bold leading-none mt-0.5">{{ block.date }}</span>
    </div>
    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[15px] font-medium text-(--heading)" :class="{ 'line-through opacity-70': cancelled }">{{ event.title }}</span>
        <span class="text-[11px] font-semibold text-(--fg-3) uppercase tracking-wide">{{ EVENT_TYPE_LABELS[event.type] }}</span>
      </div>
      <div class="text-[13px] text-(--fg-3)">{{ formatRange(event.startsAt, event.endsAt) }}</div>
      <div v-if="event.location || event.onlineUrl" class="flex items-center gap-1.5 text-[13px] text-(--fg-3) min-w-0">
        <MapPin v-if="event.location" :size="13" class="shrink-0" /><Video v-else :size="13" class="shrink-0" />
        <span class="truncate">{{ event.location ?? 'Online' }}</span>
      </div>
    </div>
    <span v-if="cancelled" class="shrink-0 text-[13px] font-medium text-(--danger)">Cancelled</span>
    <span v-else-if="event.myStatus === 'Going'" class="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-(--success)">
      <span class="w-1.5 h-1.5 rounded-full bg-current" />Going
    </span>
    <span v-else-if="event.myStatus === 'Waitlisted'" class="shrink-0 text-[13px] font-medium text-(--fg-3)">Waitlisted</span>
  </button>
</template>
