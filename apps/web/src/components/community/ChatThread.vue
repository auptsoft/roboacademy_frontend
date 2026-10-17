<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AlertTriangle, Flag, Loader2, Pencil, SendHorizontal, Trash2 } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { statusLabel } from '@/api/community'
import {
  deleteMessage, editMessage, listChannelMembers, listMessages, markRead, sendMessage,
  type Channel, type ChatMessage, type Contact,
} from '@/api/community-chat'
import { onChatSignal } from '@/lib/community-realtime'
import { formatNotificationTime } from '@/composables/useNotifications'
import ReportDialog from './ReportDialog.vue'

// One chat: messages oldest first, scrolling back for more, and a composer with @mentions. New
// messages arrive through the hub's "fetch again" signals, with a slow poll in case the socket is
// down. Learner text is shown as plain text - never as HTML.

const props = defineProps<{ channelId: string }>()
const emit = defineEmits<{ loaded: [channel: Channel]; read: [] }>()

const channel = ref<Channel | null>(null)
const messages = ref<ChatMessage[]>([])
const hasMore = ref(false)
const historyDays = ref<number | null>(null)
const status = ref<'loading' | 'idle' | 'error'>('loading')
const loadingOlder = ref(false)
const error = ref('')
const notice = ref('')
const scroller = ref<HTMLElement | null>(null)

function nearBottom() {
  const el = scroller.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120
}

async function scrollToBottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function load() {
  status.value = 'loading'
  try {
    const page = await listMessages(props.channelId)
    channel.value = page.channel
    messages.value = page.messages
    hasMore.value = page.hasMore
    historyDays.value = page.historyDays
    status.value = 'idle'
    emit('loaded', page.channel)
    await scrollToBottom()
    await read()
  } catch {
    status.value = 'error'
  }
}

/** Fetch the latest page again and merge it in: new messages, edits, deletions and holds. */
async function refresh() {
  if (status.value !== 'idle') return
  const stick = nearBottom()
  try {
    const page = await listMessages(props.channelId)
    channel.value = page.channel
    const oldest = page.messages[0]?.createdAt
    const older = oldest ? messages.value.filter((m) => m.createdAt < oldest) : []
    messages.value = [...older, ...page.messages]
    if (stick) {
      await scrollToBottom()
      await read()
    }
  } catch {
    // Try again on the next signal or poll.
  }
}

async function loadOlder() {
  const first = messages.value[0]
  if (!first || loadingOlder.value) return
  loadingOlder.value = true
  const el = scroller.value
  const before = el ? el.scrollHeight - el.scrollTop : 0
  try {
    const page = await listMessages(props.channelId, { before: first.createdAt })
    messages.value = [...page.messages, ...messages.value]
    hasMore.value = page.hasMore
    await nextTick()
    if (el) el.scrollTop = el.scrollHeight - before
  } finally {
    loadingOlder.value = false
  }
}

async function read() {
  try {
    await markRead(props.channelId)
    emit('read')
  } catch {
    // Not worth bothering anyone about.
  }
}

const stopSignals = onChatSignal((signal) => {
  if (signal.channelId === props.channelId && signal.kind === 'message') void refresh()
  if (signal.kind === 'channels') void refresh()
})
const poll = setInterval(() => void refresh(), 30_000)
onBeforeUnmount(() => {
  stopSignals()
  clearInterval(poll)
})

// ── Composer and @mentions ───────────────────────────────────────────────────
const draft = ref('')
const sending = ref(false)
const members = ref<Contact[]>([])
const mentioned = ref<Contact[]>([])
const mentionQuery = ref<string | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)

const suggestions = computed(() => {
  if (mentionQuery.value === null) return []
  const q = mentionQuery.value.toLowerCase()
  return members.value.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6)
})

function onInput() {
  const el = input.value
  if (!el) return
  const upToCaret = draft.value.slice(0, el.selectionStart)
  const match = /(?:^|\s)@([^\s@]{0,30})$/.exec(upToCaret)
  mentionQuery.value = match ? match[1] : null
  if (match && members.value.length === 0 && channel.value?.kind !== 'Direct') {
    listChannelMembers(props.channelId).then((list) => { members.value = list }).catch(() => {})
  }
}

function pickMention(contact: Contact) {
  const el = input.value
  if (!el) return
  const caret = el.selectionStart
  const before = draft.value.slice(0, caret).replace(/@([^\s@]{0,30})$/, `@${contact.name} `)
  draft.value = before + draft.value.slice(caret)
  if (!mentioned.value.some((m) => m.id === contact.id)) mentioned.value.push(contact)
  mentionQuery.value = null
  void nextTick(() => {
    el.focus()
    el.setSelectionRange(before.length, before.length)
  })
}

async function send() {
  const body = draft.value.trim()
  if (!body || sending.value) return
  sending.value = true
  error.value = ''
  notice.value = ''
  try {
    // Only people still named in the text are mentioned.
    const ids = mentioned.value.filter((m) => body.includes(`@${m.name}`)).map((m) => m.id)
    const message = await sendMessage(props.channelId, body, ids)
    messages.value = [...messages.value.filter((m) => m.id !== message.id), message]
    if (message.status !== 'Visible') {
      notice.value = message.status === 'PendingApproval'
        ? 'Sent to your teacher to approve.'
        : 'Your message is being checked before others can see it.'
    }
    draft.value = ''
    mentioned.value = []
    await scrollToBottom()
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't send your message."
  } finally {
    sending.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (suggestions.value.length > 0) pickMention(suggestions.value[0])
    else void send()
  } else if (event.key === 'Escape') {
    mentionQuery.value = null
  }
}

// ── Editing, deleting and reporting ─────────────────────────────────────────
const editingId = ref<string | null>(null)
const editText = ref('')
const reportingId = ref<string | null>(null)

function startEdit(message: ChatMessage) {
  editingId.value = message.id
  editText.value = message.body
}

async function saveEdit(message: ChatMessage) {
  const body = editText.value.trim()
  if (!body) return
  try {
    const updated = await editMessage(message.id, body)
    messages.value = messages.value.map((m) => (m.id === updated.id ? updated : m))
    editingId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't save your changes."
  }
}

async function remove(message: ChatMessage) {
  if (!window.confirm('Delete this message?')) return
  try {
    await deleteMessage(message.id)
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't delete the message."
  }
}

function onReported(message: string) {
  notice.value = message
  reportingId.value = null
  void refresh()
}

function startsDay(index: number) {
  const current = new Date(messages.value[index].createdAt).toDateString()
  return index === 0 || new Date(messages.value[index - 1].createdAt).toDateString() !== current
}

watch(() => props.channelId, () => {
  members.value = []
  mentioned.value = []
  draft.value = ''
  editingId.value = null
  void load()
}, { immediate: true })
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div v-if="status === 'loading'" class="flex flex-1 items-center justify-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <div v-else-if="status === 'error'" class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-(--danger-soft) text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load this chat.</p>
      <RaButton variant="secondary" @click="load">Try again</RaButton>
    </div>

    <template v-else>
      <div ref="scroller" class="flex-1 overflow-y-auto px-5 py-4 max-sm:px-3" aria-live="polite">
        <div v-if="hasMore" class="mb-3 flex justify-center">
          <RaButton variant="ghost" :disabled="loadingOlder" @click="loadOlder">
            <template v-if="loadingOlder" #icon><Loader2 :size="14" class="animate-spin" /></template>
            Load earlier messages
          </RaButton>
        </div>
        <p v-else-if="historyDays" class="m-0 mb-3 text-center text-[12px] text-(--fg-3)">
          Your school keeps {{ historyDays }} days of chat history.
        </p>
        <p v-if="messages.length === 0" class="m-0 py-16 text-center text-[13px] text-(--fg-3)">No messages yet. Say hello!</p>

        <template v-for="(message, index) in messages" :key="message.id">
          <div v-if="startsDay(index)" class="my-3 text-center text-[12px] font-semibold text-(--fg-3)">
            {{ new Date(message.createdAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) }}
          </div>
          <article :id="`message-${message.id}`" class="group flex flex-col gap-0.5 rounded-(--ra-md) px-2 py-1.5 hover:bg-(--bg-1)">
            <div class="flex items-baseline gap-2">
              <span class="text-[13px] font-semibold" :class="message.author.isStaff ? 'text-(--brand-blue)' : 'text-(--fg-1)'">
                {{ message.author.name }}
              </span>
              <span class="text-[11px] text-(--fg-3)">{{ formatNotificationTime(message.createdAt) }}</span>
              <span v-if="message.editedAt && !message.isDeleted" class="text-[11px] text-(--fg-3)">(edited)</span>
              <span v-if="statusLabel(message.status)" class="rounded-full bg-(--warning-soft,var(--bg-2)) px-2 text-[11px] font-semibold text-(--fg-2)">
                {{ statusLabel(message.status) }}
              </span>
              <span class="ml-auto hidden gap-1 group-hover:flex group-focus-within:flex">
                <button v-if="message.canEdit" type="button" class="border-0 bg-transparent p-1 text-(--fg-3) hover:text-(--fg-1) cursor-pointer" aria-label="Edit" @click="startEdit(message)"><Pencil :size="14" /></button>
                <button v-if="message.canDelete" type="button" class="border-0 bg-transparent p-1 text-(--fg-3) hover:text-(--danger) cursor-pointer" aria-label="Delete" @click="remove(message)"><Trash2 :size="14" /></button>
                <button
                  v-if="!message.canDelete && !message.isDeleted && message.status === 'Visible'"
                  type="button"
                  class="border-0 bg-transparent p-1 text-(--fg-3) hover:text-(--danger) cursor-pointer"
                  aria-label="Report"
                  @click="reportingId = message.id"
                ><Flag :size="14" /></button>
              </span>
            </div>
            <p v-if="message.isDeleted" class="m-0 text-sm italic text-(--fg-3)">Message deleted</p>
            <form v-else-if="editingId === message.id" class="flex flex-col gap-2" @submit.prevent="saveEdit(message)">
              <textarea v-model="editText" rows="2" maxlength="2000" class="resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-0) px-3 py-2 text-sm text-(--fg-1) outline-none focus:border-(--brand-blue)" />
              <div class="flex gap-2">
                <RaButton>Save</RaButton>
                <RaButton type="button" variant="ghost" @click="editingId = null">Cancel</RaButton>
              </div>
            </form>
            <p v-else class="m-0 text-sm text-(--fg-1) whitespace-pre-wrap break-words">{{ message.body }}</p>
          </article>
        </template>
      </div>

      <div class="border-t border-(--line-2) px-5 py-3 max-sm:px-3">
        <p v-if="notice" class="m-0 mb-2 text-[13px] text-(--fg-2)">{{ notice }}</p>
        <p v-if="error" class="m-0 mb-2 text-[13px] text-(--danger)">{{ error }}</p>
        <p v-if="channel?.cannotWrite" class="m-0 text-[13px] text-(--fg-3)">{{ channel.cannotWrite }}</p>
        <form v-else class="relative flex items-end gap-2" @submit.prevent="send">
          <ul
            v-if="suggestions.length > 0"
            class="absolute bottom-full left-0 mb-1 w-64 list-none overflow-hidden rounded-(--ra-md) border border-(--line-2) bg-(--bg-0) p-1 shadow-lg"
            role="listbox"
          >
            <li v-for="contact in suggestions" :key="contact.id">
              <button type="button" class="w-full border-0 bg-transparent px-3 py-1.5 text-left text-sm text-(--fg-1) hover:bg-(--bg-1) cursor-pointer" @click="pickMention(contact)">
                {{ contact.name }}<span v-if="contact.isStaff" class="ml-1 text-[11px] text-(--brand-blue)">Staff</span>
              </button>
            </li>
          </ul>
          <textarea
            ref="input"
            v-model="draft"
            rows="1"
            maxlength="2000"
            :placeholder="channel?.kind === 'Direct' ? `Message ${channel.name}` : 'Write a message - type @ to mention someone'"
            class="max-h-40 min-h-10 flex-1 resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm text-(--fg-1) outline-none focus:border-(--brand-blue)"
            aria-label="Message"
            @input="onInput"
            @keydown="onKeydown"
          />
          <RaButton :disabled="sending || !draft.trim()" aria-label="Send">
            <template #icon>
              <Loader2 v-if="sending" :size="16" class="animate-spin" />
              <SendHorizontal v-else :size="16" />
            </template>
          </RaButton>
        </form>
      </div>
    </template>

    <ReportDialog
      v-if="reportingId"
      :open="true"
      content-type="Message"
      :content-id="reportingId"
      @update:open="(value: boolean) => { if (!value) reportingId = null }"
      @reported="onReported"
    />
  </div>
</template>
