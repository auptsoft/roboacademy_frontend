<script setup lang="ts">
import { Bell } from 'lucide-vue-next'
import { formatDate } from '@roboacademy/ui'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { useNotifications } from '@/composables/useNotifications'
import type { NotificationItem } from '@/api/notifications'

// Staff get notifications too (announcements aimed at their role, events for their classes...).
// Links in notifications point into the learner web app, so the admin bell only marks them read.
const { state, loadRecent, markRead, markAllRead } = useNotifications({ poll: true })

function onOpenChange(open: boolean) {
  if (open) void loadRecent()
}

function open(item: NotificationItem) {
  void markRead(item).catch(() => {})
}
</script>

<template>
  <DropdownMenu @update:open="onOpenChange">
    <DropdownMenuTrigger
      class="relative inline-flex size-9 items-center justify-center rounded-(--ra-md) text-(--fg-2) outline-none transition-colors hover:bg-(--bg-3) focus-visible:ring-2 focus-visible:ring-ring/30"
      :aria-label="state.unreadCount ? `Notifications, ${state.unreadCount} unread` : 'Notifications'"
    >
      <Bell :size="18" />
      <span
        v-if="state.unreadCount"
        class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-(--danger) text-[10px] font-semibold leading-4 text-white text-center"
      >{{ state.unreadCount > 99 ? '99+' : state.unreadCount }}</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-[360px] max-w-[calc(100vw-32px)] p-0">
      <div class="flex items-center justify-between border-b border-(--line-1) px-3 py-2.5">
        <span class="text-sm font-semibold text-(--fg-1)">Notifications</span>
        <button
          v-if="state.unreadCount"
          class="bg-transparent border-0 p-0 cursor-pointer text-xs font-medium text-(--brand-blue) hover:underline"
          @click.stop="markAllRead().catch(() => {})"
        >Mark all as read</button>
      </div>
      <div class="max-h-[400px] overflow-y-auto">
        <p v-if="state.recentStatus === 'loading' && !state.recent.length" class="m-0 px-3 py-6 text-center text-[13px] text-(--fg-3)">Loading…</p>
        <p v-else-if="state.recentStatus === 'error'" class="m-0 px-3 py-6 text-center text-[13px] text-(--fg-3)">Couldn't load notifications.</p>
        <p v-else-if="!state.recent.length" class="m-0 px-3 py-6 text-center text-[13px] text-(--fg-3)">You're all caught up.</p>
        <button
          v-for="item in state.recent"
          v-else
          :key="item.id"
          class="flex w-full gap-2.5 px-3 py-2.5 text-left bg-transparent border-0 border-b border-(--line-1) last:border-b-0 cursor-pointer hover:bg-(--bg-3)"
          @click="open(item)"
        >
          <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="item.readAt ? 'bg-transparent' : 'bg-(--brand-blue)'" />
          <span class="flex min-w-0 flex-col gap-0.5">
            <span class="text-[13px] text-(--fg-1) line-clamp-2" :class="item.readAt ? 'font-normal' : 'font-semibold'">{{ item.title }}</span>
            <span class="text-xs text-(--fg-3) line-clamp-3 whitespace-pre-line">{{ item.body }}</span>
            <span class="text-[11px] text-(--fg-4)">{{ formatDate(item.createdAt) }}</span>
          </span>
        </button>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
