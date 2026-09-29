<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, Loader2 } from 'lucide-vue-next'
import { formatNotificationTime, useNotifications } from '@/composables/useNotifications'
import type { NotificationItem } from '@/api/notifications'

const router = useRouter()
const { state, loadRecent, markRead, markAllRead } = useNotifications({ poll: true })

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function onDocumentPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

watch(open, (isOpen) => {
  if (isOpen) {
    void loadRecent()
    document.addEventListener('pointerdown', onDocumentPointerDown)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(close)

async function openItem(item: NotificationItem) {
  close()
  void markRead(item).catch(() => {})
  if (item.linkPath) await router.push(item.linkPath)
}

function viewAll() {
  close()
  router.push('/app/notifications')
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      class="relative flex bg-transparent border-0 p-0 cursor-pointer text-(--fg-2) hover:text-(--heading)"
      :aria-label="state.unreadCount ? `Notifications, ${state.unreadCount} unread` : 'Notifications'"
      :aria-expanded="open"
      aria-haspopup="true"
      @click="toggle"
    >
      <Bell :size="22" :stroke-width="1.75" />
      <span
        v-if="state.unreadCount"
        class="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-(--ra-pill) bg-(--danger) text-white text-[10px] font-semibold leading-[18px] text-center"
      >{{ state.unreadCount > 99 ? '99+' : state.unreadCount }}</span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-[calc(100%+12px)] w-[380px] max-w-[calc(100vw-32px)] bg-(--bg-1) border border-(--line-1) rounded-(--ra-lg) shadow-(--elev-2) z-50 overflow-hidden max-md:fixed max-md:right-4 max-md:top-[calc(var(--topbar-h)+8px)]"
      role="dialog"
      aria-label="Notifications"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-(--line-1)">
        <span class="text-sm font-semibold text-(--heading)">Notifications</span>
        <button
          v-if="state.unreadCount"
          class="bg-transparent border-0 p-0 cursor-pointer text-[13px] font-medium text-(--link) hover:underline"
          @click="markAllRead().catch(() => {})"
        >Mark all as read</button>
      </div>

      <div class="max-h-[420px] overflow-y-auto">
        <div v-if="state.recentStatus === 'loading' && !state.recent.length" class="flex items-center gap-2 px-4 py-6 text-[13px] text-(--fg-3)">
          <Loader2 :size="16" class="animate-spin" /> Loading…
        </div>
        <p v-else-if="state.recentStatus === 'error'" class="m-0 px-4 py-6 text-[13px] text-(--fg-3)">Couldn't load notifications.</p>
        <p v-else-if="!state.recent.length" class="m-0 px-4 py-8 text-center text-[13px] text-(--fg-3)">You're all caught up.</p>
        <button
          v-for="item in state.recent"
          v-else
          :key="item.id"
          class="flex w-full gap-3 px-4 py-3 text-left bg-transparent border-0 border-b border-(--line-1) last:border-b-0 cursor-pointer transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--bg-3)"
          @click="openItem(item)"
        >
          <span class="mt-1.5 w-2 h-2 shrink-0 rounded-full" :class="item.readAt ? 'bg-transparent' : 'bg-(--brand-blue)'" />
          <span class="flex flex-col gap-0.5 min-w-0">
            <span class="text-sm text-(--heading) line-clamp-2" :class="item.readAt ? 'font-normal' : 'font-semibold'">{{ item.title }}</span>
            <span class="text-[13px] text-(--fg-3) line-clamp-2">{{ item.body }}</span>
            <span class="text-xs text-(--fg-4)">{{ formatNotificationTime(item.createdAt) }}</span>
          </span>
        </button>
      </div>

      <button
        class="w-full px-4 py-3 bg-transparent border-0 border-t border-(--line-1) cursor-pointer text-[13px] font-medium text-(--link) hover:bg-(--bg-3)"
        @click="viewAll"
      >View all notifications</button>
    </div>
  </div>
</template>
