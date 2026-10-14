<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, History, Loader2, Plus, Send, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/api/client'
import {
  askStaffAssistant,
  deleteStaffAssistantConversation,
  getStaffAssistantMessages,
  listStaffAssistantConversations,
  rateStaffAssistantMessage,
  startStaffAssistantConversation,
  type StaffAssistantConversation,
  type StaffAssistantMessage,
} from '@/api/ai'
import { useStaffAssistant } from '@/composables/useStaffAssistant'
import { renderChatMarkdown } from '@/lib/chat-markdown'
import { hasPermission } from '@/store/auth'

// The staff assistant: how-to answers from the admin guides, plus read-only lookups (grading queue,
// course gaps, class progress, school overview) limited to what this person's role can see.
// Replies are model output, rendered through the strict chat renderer; only admin links are kept.

const route = useRoute()
const router = useRouter()
const { open, takePendingQuestion } = useStaffAssistant()

const conversationId = ref<string | null>(null)
const messages = ref<StaffAssistantMessage[]>([])
const loading = ref(false)
const draft = ref('')
const streaming = ref(false)
const status = ref('')
const error = ref('')
const listEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
let controller: AbortController | null = null

const view = ref<'chat' | 'history'>('chat')
const conversations = ref<StaffAssistantConversation[]>([])
const historyLoading = ref(false)

const MAX_CHARS = 2000

const starters = computed(() => {
  const list: string[] = []
  if (hasPermission('assessment:assessments:author')) list.push('What needs grading?')
  if (hasPermission('learning:courses:author')) list.push('Which of my students are behind?', 'How do I add a quiz to a course?')
  if (hasPermission('tenancy:manage-own')) list.push('Give me an overview of the school', 'How do I add students in bulk?')
  if (hasPermission('learning:courses:manage-visibility')) list.push("Why can't a student see a course?")
  if (hasPermission('tenancy:manage')) list.push('How do I set up a new school?')
  return list.length ? list.slice(0, 4) : ['How do I change my password?']
})

async function loadLatest() {
  loading.value = true
  error.value = ''
  try {
    conversations.value = await listStaffAssistantConversations()
    conversationId.value = conversations.value[0]?.id ?? null
    messages.value = conversationId.value ? await getStaffAssistantMessages(conversationId.value) : []
    await scrollToEnd()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not load the assistant.'
  } finally {
    loading.value = false
  }
}

watch(open, async (isOpen) => {
  if (!isOpen) {
    controller?.abort()
    return
  }

  view.value = 'chat'
  const question = takePendingQuestion()
  if (question) {
    newConversation()
    void send(question)
  } else {
    await loadLatest()
  }
  await nextTick()
  inputEl.value?.focus()
}, { immediate: true })

async function openHistory() {
  view.value = 'history'
  historyLoading.value = true
  try {
    conversations.value = await listStaffAssistantConversations()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not load your conversations.'
  } finally {
    historyLoading.value = false
  }
}

async function openConversation(id: string) {
  controller?.abort()
  view.value = 'chat'
  if (id === conversationId.value) return
  loading.value = true
  error.value = ''
  try {
    messages.value = await getStaffAssistantMessages(id)
    conversationId.value = id
    await scrollToEnd()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not open that conversation.'
  } finally {
    loading.value = false
  }
}

async function removeConversation(conversation: StaffAssistantConversation) {
  if (!window.confirm('Delete this conversation? This can\'t be undone.')) return
  try {
    await deleteStaffAssistantConversation(conversation.id)
    conversations.value = conversations.value.filter((c) => c.id !== conversation.id)
    if (conversation.id === conversationId.value) {
      conversationId.value = null
      messages.value = []
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not delete that conversation.'
  }
}

function whenText(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

onBeforeUnmount(() => controller?.abort())

function newConversation() {
  controller?.abort()
  view.value = 'chat'
  conversationId.value = null
  messages.value = []
  error.value = ''
}

async function send(text?: string) {
  const question = (text ?? draft.value).trim()
  if (!question || streaming.value) return
  error.value = ''
  status.value = ''
  streaming.value = true
  controller = new AbortController()

  const now = new Date().toISOString()
  const asked: StaffAssistantMessage = {
    id: `local-${Date.now()}`, role: 'User', content: question, sources: null, incomplete: false, helpful: null, createdAt: now,
  }
  const reply: StaffAssistantMessage = {
    id: `local-reply-${Date.now()}`, role: 'Assistant', content: '', sources: null, incomplete: false, helpful: null, createdAt: now,
  }
  messages.value.push(asked, reply)
  const replyRef = messages.value[messages.value.length - 1]
  draft.value = ''
  await scrollToEnd()

  try {
    if (!conversationId.value) {
      conversationId.value = (await startStaffAssistantConversation()).id
    }

    await askStaffAssistant(conversationId.value, question, route.path, {
      onStatus: (label) => { status.value = `${label}…` },
      onDelta: (chunk) => {
        replyRef.content += chunk
        void scrollToEnd()
      },
      onDone: (done) => { replyRef.id = done.messageId },
      onError: (message) => {
        replyRef.incomplete = true
        error.value = message
      },
    }, controller.signal)
  } catch (e) {
    if (controller?.signal.aborted) {
      replyRef.incomplete = true
    } else {
      // Refused before any answer: take the question back so it can be re-sent.
      messages.value = messages.value.filter((m) => m !== asked && m !== replyRef)
      draft.value = question
      error.value = e instanceof ApiError ? e.message : 'The assistant is unavailable right now.'
    }
  } finally {
    streaming.value = false
    status.value = ''
    controller = null
  }
}

function stop() {
  controller?.abort()
}

async function rate(message: StaffAssistantMessage, helpful: boolean) {
  if (message.id.startsWith('local-')) return
  message.helpful = helpful
  try {
    await rateStaffAssistantMessage(message.id, helpful)
  } catch {
    // Feedback is best-effort.
  }
}

function onReplyClick(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-app-link]')
  if (link) {
    event.preventDefault()
    void router.push(link.getAttribute('href')!)
    if (window.matchMedia('(max-width: 767px)').matches) open.value = false
  }
}

async function scrollToEnd() {
  await nextTick()
  listEl.value?.scrollTo({ top: listEl.value.scrollHeight })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void send()
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[59] bg-black/40 md:hidden" @click="open = false" />
  <aside
    v-if="open"
    class="fixed top-0 right-0 bottom-0 z-[60] flex w-[440px] max-w-full flex-col border-l border-(--line-1) bg-(--bg-1) shadow-xl max-md:w-full"
    aria-label="Assistant"
  >
    <header class="flex items-center justify-between gap-2 border-b border-(--line-1) px-4 py-3">
      <span class="flex items-center gap-2 text-[15px] font-bold text-(--fg-1)">
        <Sparkles :size="16" class="text-(--brand-blue)" /> Assistant
      </span>
      <div class="flex items-center gap-1">
        <Button v-if="view === 'chat'" variant="ghost" size="sm" :disabled="streaming" @click="openHistory">
          <History :size="13" /> History
        </Button>
        <Button v-else variant="ghost" size="sm" @click="view = 'chat'">
          <ArrowLeft :size="13" /> Back
        </Button>
        <Button variant="ghost" size="sm" :disabled="streaming" @click="newConversation">
          <Plus :size="13" /> New
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Close assistant" @click="open = false">
          <X :size="16" />
        </Button>
      </div>
    </header>

    <div v-if="view === 'history'" class="flex flex-1 flex-col overflow-y-auto">
      <p class="m-0 px-4 pt-3 pb-2 text-xs text-(--fg-3)">Your conversations with the assistant. They're deleted after 90 days.</p>
      <div v-if="historyLoading" class="flex justify-center py-10"><Loader2 :size="18" class="animate-spin text-(--fg-4)" /></div>
      <p v-else-if="conversations.length === 0" class="m-0 px-4 py-10 text-center text-[13px] text-(--fg-3)">No conversations yet.</p>
      <ul v-else class="m-0 list-none p-0">
        <li
          v-for="conversation in conversations"
          :key="conversation.id"
          class="flex items-center gap-2 border-b border-(--line-1) px-4 py-3 last:border-b-0"
          :class="conversation.id === conversationId && 'bg-(--bg-3)'"
        >
          <button type="button" class="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left" @click="openConversation(conversation.id)">
            <span class="block truncate text-sm font-semibold text-(--fg-1)">{{ conversation.title ?? 'New conversation' }}</span>
            <span class="block text-xs text-(--fg-4)">{{ whenText(conversation.lastMessageAt) }}</span>
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="`Delete conversation: ${conversation.title ?? 'New conversation'}`"
            @click="removeConversation(conversation)"
          >
            <Trash2 :size="14" />
          </Button>
        </li>
      </ul>
      <p v-if="error" class="m-0 px-4 py-2 text-xs text-(--danger)">{{ error }}</p>
    </div>

    <div v-show="view === 'chat'" ref="listEl" class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      <div v-if="loading" class="flex justify-center py-10"><Loader2 :size="18" class="animate-spin text-(--fg-4)" /></div>

      <div v-else-if="messages.length === 0" class="flex flex-col items-center gap-3 py-8 text-center">
        <Sparkles :size="20" class="text-(--fg-4)" />
        <p class="m-0 text-sm font-semibold text-(--fg-1)">How can I help?</p>
        <p class="m-0 max-w-80 text-[13px] text-(--fg-3)">Ask how to do something in the admin app, or about your grading, courses, classes and school.</p>
        <div class="mt-1 flex w-full flex-col gap-2">
          <button
            v-for="starter in starters"
            :key="starter"
            type="button"
            class="w-full cursor-pointer rounded-(--ra-md) border border-(--line-2) bg-transparent px-3.5 py-2.5 text-left text-[13px] text-(--fg-2) hover:border-(--brand-blue) hover:text-(--fg-1)"
            @click="send(starter)"
          >
            {{ starter }}
          </button>
        </div>
      </div>

      <template v-for="message in messages" :key="message.id">
        <div v-if="message.role === 'User'" class="max-w-[85%] self-end whitespace-pre-wrap rounded-(--ra-md) bg-(--brand-blue) px-3.5 py-2.5 text-sm text-white">
          {{ message.content }}
        </div>

        <div v-else class="flex max-w-[94%] flex-col gap-2 self-start">
          <div class="rounded-(--ra-md) border border-(--line-1) bg-(--bg-2) px-3.5 py-2.5 text-sm leading-relaxed text-(--fg-1)">
            <span v-if="!message.content && streaming" class="inline-flex items-center gap-2 text-[13px] text-(--fg-3)">
              <Loader2 :size="14" class="animate-spin text-(--fg-4)" /> {{ status || 'Thinking…' }}
            </span>
            <div v-if="message.content" class="chat-text rich-text" @click="onReplyClick" v-html="renderChatMarkdown(message.content)" />
            <p v-if="message.content && streaming && status && message === messages[messages.length - 1]" class="m-0 mt-1 text-xs text-(--fg-4)">{{ status }}</p>
            <p v-if="message.incomplete" class="m-0 mt-1 text-xs text-(--fg-4)">(stopped)</p>
          </div>

          <div v-if="message.content && !message.id.startsWith('local-')" class="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Helpful" :class="message.helpful === true ? 'text-(--success)' : 'text-(--fg-4)'" @click="rate(message, true)">
              <ThumbsUp :size="13" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Not helpful" :class="message.helpful === false ? 'text-(--danger)' : 'text-(--fg-4)'" @click="rate(message, false)">
              <ThumbsDown :size="13" />
            </Button>
          </div>
        </div>
      </template>
    </div>

    <form v-if="view === 'chat'" class="flex flex-col gap-2 border-t border-(--line-1) px-4 py-3" @submit.prevent="send()">
      <p v-if="error" class="m-0 text-xs text-(--danger)">{{ error }}</p>
      <div class="flex items-end gap-2">
        <textarea
          ref="inputEl"
          v-model="draft"
          rows="2"
          :maxlength="MAX_CHARS"
          placeholder="Ask about your work or how to do something…"
          aria-label="Your question"
          class="max-h-36 min-h-11 flex-1 resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3 py-2 font-sans text-sm text-(--fg-1) outline-none placeholder:text-(--fg-4) focus:border-(--brand-blue)"
          @keydown="onKeydown"
        />
        <Button v-if="streaming" type="button" variant="outline" aria-label="Stop" @click="stop">
          <Square :size="14" />
        </Button>
        <Button v-else type="submit" :disabled="!draft.trim()" aria-label="Send">
          <Send :size="14" />
        </Button>
      </div>
      <p class="m-0 text-[11px] text-(--fg-4)">AI assistant. Answers can be wrong — check before acting on them.</p>
    </form>
  </aside>
</template>
