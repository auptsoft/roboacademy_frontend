<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, Hash, Loader2, MessageCirclePlus, UserRound, UsersRound, X } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import { listChannels, listContacts, startDirect, type Channel, type Contact } from '@/api/community-chat'
import { brandingKey, featureConfirmed } from '@/branding'
import { onChatSignal, refreshUnread } from '@/lib/community-realtime'
import ChatThread from '@/components/community/ChatThread.vue'

// Messages: class and study-group chats and direct conversations on the left, the open one on the
// right (one at a time on a phone). The hub tells us when to fetch again.

const route = useRoute()
const router = useRouter()
const branding = inject(brandingKey, null)
const available = computed(() =>
  featureConfirmed(branding?.value, 'community_group_chat') || featureConfirmed(branding?.value, 'community_direct_messages'))
const directAvailable = computed(() => featureConfirmed(branding?.value, 'community_direct_messages'))

const channels = ref<Channel[]>([])
const status = ref<'loading' | 'idle' | 'error' | 'off'>('loading')
const activeId = computed(() => (route.params.channelId ? String(route.params.channelId) : null))

const groupsOf = computed(() => [
  { label: 'Classes', items: channels.value.filter((c) => c.kind === 'Class') },
  { label: 'Study groups', items: channels.value.filter((c) => c.kind === 'StudyGroup') },
  { label: 'Direct messages', items: channels.value.filter((c) => c.kind === 'Direct') },
].filter((section) => section.items.length > 0 || (section.label === 'Direct messages' && directAvailable.value)))

async function load(quiet = false) {
  if (!available.value) return
  if (!quiet) status.value = 'loading'
  try {
    channels.value = await listChannels()
    status.value = 'idle'
  } catch (e) {
    if (!quiet) status.value = e instanceof ApiError && e.status === 403 ? 'off' : 'error'
  }
}
watch(available, () => load(), { immediate: true })

const stopSignals = onChatSignal(() => void load(true))
onBeforeUnmount(stopSignals)

function open(channel: Channel) {
  router.push(`/app/community/chat/${channel.id}`)
}

function onRead() {
  const channel = channels.value.find((c) => c.id === activeId.value)
  if (channel) channel.unread = 0
  void refreshUnread()
}

function onLoaded(loaded: Channel) {
  if (!channels.value.some((c) => c.id === loaded.id)) channels.value = [...channels.value, loaded]
}

// ── New direct message ─────────────────────────────────────────────────────
const picking = ref(false)
const search = ref('')
const contacts = ref<Contact[]>([])
const contactsLoading = ref(false)
const pickError = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

async function findContacts() {
  contactsLoading.value = true
  try {
    contacts.value = await listContacts(search.value.trim())
  } catch (e) {
    pickError.value = e instanceof Error ? e.message : "Couldn't load people."
  } finally {
    contactsLoading.value = false
  }
}

function openPicker() {
  picking.value = true
  search.value = ''
  pickError.value = ''
  void findContacts()
}

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void findContacts(), 250)
})

async function message(contact: Contact) {
  pickError.value = ''
  try {
    const channel = await startDirect(contact.id)
    picking.value = false
    onLoaded(channel)
    router.push(`/app/community/chat/${channel.id}`)
  } catch (e) {
    pickError.value = e instanceof Error ? e.message : "Couldn't start the conversation."
  }
}
</script>

<template>
  <div class="mx-auto flex h-[calc(100dvh-64px)] w-full max-w-[1200px] flex-col gap-4 px-8 pt-8 pb-6 max-lg:px-6 max-sm:h-[calc(100dvh-120px)] max-sm:px-0 max-sm:pt-0 max-sm:pb-0">
    <header class="flex items-center justify-between gap-3 max-sm:px-4 max-sm:pt-4" :class="activeId ? 'max-sm:hidden' : ''">
      <div>
        <h1 class="m-0 text-[28px] font-semibold tracking-[-0.01em] text-(--heading) max-sm:text-2xl">Messages</h1>
        <p class="m-0 text-sm text-(--fg-3)">Chat with your classes, your study groups and your teachers.</p>
      </div>
      <RaButton v-if="directAvailable && status === 'idle'" variant="secondary" @click="openPicker">
        <template #icon><MessageCirclePlus :size="16" /></template>
        New message
      </RaButton>
    </header>

    <p v-if="!available" class="m-0 py-16 text-center text-[13px] text-(--fg-3)">Messages aren't available at your school.</p>
    <div v-else-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3) max-sm:px-4">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <div v-else-if="status !== 'idle'" class="flex flex-col items-center gap-3 py-16 text-center">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-(--danger-soft) text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">{{ status === 'off' ? 'Messages are switched off at your school.' : "Couldn't load your messages." }}</p>
      <RaButton v-if="status === 'error'" variant="secondary" @click="load()">Try again</RaButton>
    </div>

    <div v-else class="flex min-h-0 flex-1 overflow-hidden rounded-(--ra-xl) border border-(--line-2) bg-(--bg-0) max-sm:rounded-none max-sm:border-0">
      <nav
        class="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-(--line-2) p-3 max-sm:w-full max-sm:border-0"
        :class="activeId ? 'max-sm:hidden' : ''"
        aria-label="Chats"
      >
        <p v-if="channels.length === 0 && !directAvailable" class="m-0 p-3 text-[13px] text-(--fg-3)">You're not in any chats yet.</p>
        <section v-for="section in groupsOf" :key="section.label" class="flex flex-col gap-0.5">
          <h2 class="m-0 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-(--fg-3)">{{ section.label }}</h2>
          <p v-if="section.items.length === 0" class="m-0 px-2 text-[13px] text-(--fg-3)">No conversations yet.</p>
          <button
            v-for="channel in section.items"
            :key="channel.id"
            type="button"
            :aria-current="channel.id === activeId ? 'page' : undefined"
            :class="[
              'flex items-center gap-2.5 rounded-(--ra-md) border-0 px-2 py-2 text-left cursor-pointer',
              channel.id === activeId ? 'bg-(--brand-blue-soft)' : 'bg-transparent hover:bg-(--bg-1)',
            ]"
            @click="open(channel)"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--bg-2) text-(--fg-2)">
              <Hash v-if="channel.kind === 'Class'" :size="15" />
              <UsersRound v-else-if="channel.kind === 'StudyGroup'" :size="15" />
              <UserRound v-else :size="15" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm" :class="channel.unread > 0 ? 'font-semibold text-(--fg-1)' : 'text-(--fg-1)'">{{ channel.name }}</span>
              <span v-if="channel.lastMessage" class="truncate text-[12px] text-(--fg-3)">{{ channel.lastMessage }}</span>
            </span>
            <span
              v-if="channel.unread > 0"
              class="min-w-5 rounded-full bg-(--brand-blue) px-1.5 py-0.5 text-center text-[11px] font-semibold text-white"
              :aria-label="`${channel.unread} unread`"
            >{{ channel.unread > 99 ? '99+' : channel.unread }}</span>
          </button>
        </section>
      </nav>

      <section class="flex min-w-0 flex-1 flex-col" :class="activeId ? '' : 'max-sm:hidden'">
        <template v-if="activeId">
          <div class="flex items-center gap-2 border-b border-(--line-2) px-5 py-3 max-sm:px-3">
            <button
              type="button"
              class="hidden border-0 bg-transparent p-1 text-(--fg-3) hover:text-(--fg-1) cursor-pointer max-sm:inline-flex"
              aria-label="Back to chats"
              @click="router.push('/app/community/chat')"
            >
              <ArrowLeft :size="18" />
            </button>
            <h2 class="m-0 truncate text-base font-semibold text-(--heading)">
              {{ channels.find((c) => c.id === activeId)?.name ?? 'Chat' }}
            </h2>
          </div>
          <ChatThread :key="activeId" :channel-id="activeId" class="min-h-0 flex-1" @read="onRead" @loaded="onLoaded" />
        </template>
        <p v-else class="m-auto text-[13px] text-(--fg-3)">Choose a chat to start.</p>
      </section>
    </div>

    <div v-if="picking" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="picking = false">
      <div role="dialog" aria-modal="true" aria-labelledby="new-message-title" class="flex max-h-[80vh] w-full max-w-[420px] flex-col gap-3 rounded-(--ra-xl) bg-(--bg-0) p-6 shadow-xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 id="new-message-title" class="m-0 text-lg font-semibold text-(--heading)">New message</h2>
            <p class="m-0 mt-1 text-[13px] text-(--fg-3)">Your school's staff can review messages that are reported.</p>
          </div>
          <button type="button" class="border-0 bg-transparent p-1 text-(--fg-3) hover:text-(--fg-1) cursor-pointer" aria-label="Close" @click="picking = false">
            <X :size="18" />
          </button>
        </div>
        <input
          v-model="search"
          type="search"
          placeholder="Search by name"
          aria-label="Search people"
          class="rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm text-(--fg-1) outline-none focus:border-(--brand-blue)"
        />
        <p v-if="pickError" class="m-0 text-[13px] text-(--danger)">{{ pickError }}</p>
        <div class="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
          <div v-if="contactsLoading" class="flex items-center gap-2 py-4 text-[13px] text-(--fg-3)">
            <Loader2 :size="16" class="animate-spin" /> Loading…
          </div>
          <p v-else-if="contacts.length === 0" class="m-0 py-4 text-center text-[13px] text-(--fg-3)">No one to message here.</p>
          <button
            v-for="contact in contactsLoading ? [] : contacts"
            :key="contact.id"
            type="button"
            class="flex items-center gap-2 rounded-(--ra-md) border-0 bg-transparent px-2 py-2 text-left text-sm text-(--fg-1) hover:bg-(--bg-1) cursor-pointer"
            @click="message(contact)"
          >
            <UserRound :size="16" class="text-(--fg-3)" />
            <span class="flex-1 truncate">{{ contact.name }}</span>
            <span v-if="contact.isStaff" class="text-[11px] font-semibold text-(--brand-blue)">Staff</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
