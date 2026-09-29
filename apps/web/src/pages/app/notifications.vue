<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, BellOff, Loader2, Settings } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { getMyNotifications, type NotificationItem } from '@/api/notifications'
import { formatNotificationTime, useNotifications } from '@/composables/useNotifications'
import FolderTabs from '@/components/layout/FolderTabs.vue'

const router = useRouter()
const { state: shared, markRead, markAllRead } = useNotifications()

const PAGE_SIZE = 20

type Tab = 'all' | 'unread'

const tab = ref<Tab>('all')
const items = ref<NotificationItem[]>([])
const page = ref(1)
const totalPages = ref(0)
const status = ref<'loading' | 'idle' | 'error'>('loading')
const loadingMore = ref(false)

const tabs = computed<{ id: Tab; label: string }[]>(() => [
  { id: 'all', label: 'All' },
  { id: 'unread', label: shared.unreadCount ? `Unread (${shared.unreadCount})` : 'Unread' },
])

async function load(reset = true) {
  if (reset) {
    status.value = 'loading'
    page.value = 1
  } else {
    loadingMore.value = true
  }
  try {
    const { data, meta } = await getMyNotifications({
      unread: tab.value === 'unread',
      page: page.value,
      pageSize: PAGE_SIZE,
    })
    items.value = reset ? data : [...items.value, ...data]
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

async function openItem(item: NotificationItem) {
  const readAt = await markRead(item).catch(() => null)
  if (readAt) item.readAt = readAt
  if (item.linkPath) router.push(item.linkPath)
}

async function handleMarkAll() {
  try {
    await markAllRead()
    const now = new Date().toISOString()
    if (tab.value === 'unread') items.value = []
    else for (const item of items.value) item.readAt ??= now
  } catch {
    // Leave the list as-is; the user can retry.
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-12 pb-12 max-w-[960px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <div class="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
      <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">Notifications</h1>
      <div class="flex items-center gap-3">
        <RaButton variant="ghost" @click="router.push('/app/settings')">
          <template #icon><Settings :size="16" /></template>
          Preferences
        </RaButton>
        <RaButton variant="secondary" :disabled="!shared.unreadCount" @click="handleMarkAll">Mark all as read</RaButton>
      </div>
    </div>

    <div>
      <FolderTabs v-model="tab" :tabs="tabs" />

      <section class="bg-(--surface) rounded-(--ra-xl) rounded-tl-none shadow-(--surface-shadow) overflow-hidden">
        <div v-if="status === 'loading'" class="flex items-center gap-2 p-6 text-[13px] text-(--fg-3)">
          <Loader2 :size="16" class="animate-spin" /> Loading…
        </div>
        <div v-else-if="status === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
          <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
          <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your notifications.</p>
          <RaButton variant="secondary" @click="load()">Try again</RaButton>
        </div>
        <div v-else-if="!items.length" class="flex flex-col items-center gap-3 py-16 text-center">
          <div class="w-10 h-10 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-3)"><BellOff :size="18" /></div>
          <p class="m-0 text-[13px] text-(--fg-3)">{{ tab === 'unread' ? "You're all caught up." : 'No notifications yet.' }}</p>
        </div>
        <template v-else>
          <button
            v-for="item in items"
            :key="item.id"
            class="flex w-full gap-4 px-6 py-4 text-left bg-transparent border-0 border-b border-(--line-1) last:border-b-0 cursor-pointer transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--bg-3) max-sm:px-4"
            @click="openItem(item)"
          >
            <span class="mt-2 w-2 h-2 shrink-0 rounded-full" :class="item.readAt ? 'bg-transparent' : 'bg-(--brand-blue)'" />
            <span class="flex flex-col gap-1 min-w-0 flex-1">
              <span class="text-[15px] text-(--heading)" :class="item.readAt ? 'font-normal' : 'font-semibold'">{{ item.title }}</span>
              <span class="text-[13px] text-(--fg-3)">{{ item.body }}</span>
            </span>
            <span class="shrink-0 text-xs text-(--fg-4) whitespace-nowrap">{{ formatNotificationTime(item.createdAt) }}</span>
          </button>
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
