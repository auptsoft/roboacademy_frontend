<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RaButton, RaChip } from '@roboacademy/ui'
import { ArrowLeft, History, Loader2, Plus, Send, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import {
  askAssistant,
  deleteAssistantConversation,
  getAssistantMessages,
  listAssistantConversations,
  rateAssistantMessage,
  startAssistantConversation,
  type AssistantConversation,
  type AssistantMessage,
} from '@/api/ai'
import { useAssistant } from '@/composables/useAssistant'
import { renderChatMarkdown } from '@/lib/chat-markdown'

// The app assistant: answers about the learner's own courses, progress, paths and certificates,
// the catalog, and how to use the app, looking things up as it goes. Replies are model output, so
// they go through the strict chat Markdown renderer: only links to app pages stay clickable.

const route = useRoute()
const router = useRouter()
const { open, takePendingQuestion } = useAssistant()

const conversationId = ref<string | null>(null)
const messages = ref<AssistantMessage[]>([])
const loading = ref(false)
const draft = ref('')
const streaming = ref(false)
const status = ref('')
const error = ref('')
const listEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
let controller: AbortController | null = null

const view = ref<'chat' | 'history'>('chat')
const conversations = ref<AssistantConversation[]>([])
const historyLoading = ref(false)

const MAX_CHARS = 2000

const STARTERS = [
  'What should I do next?',
  'How close am I to my certificate?',
  'Find a course about sensors',
  'How do I join a live session?',
]

const hintMode = computed(() => [...messages.value].reverse().find((m) => m.role === 'Assistant')?.mode === 'hint')

// A course page gives the conversation its course as context.
const courseId = computed(() => (route.path.startsWith('/app/courses/') ? String(route.params.id ?? '') || null : null))

async function loadLatest() {
  loading.value = true
  error.value = ''
  try {
    conversations.value = await listAssistantConversations()
    conversationId.value = conversations.value[0]?.id ?? null
    messages.value = conversationId.value ? await getAssistantMessages(conversationId.value) : []
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
    // Opened with a question (e.g. from a help article): ask it in a fresh conversation.
    newConversation()
    draft.value = question
    void send()
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
    conversations.value = await listAssistantConversations()
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
    messages.value = await getAssistantMessages(id)
    conversationId.value = id
    await scrollToEnd()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not open that conversation.'
  } finally {
    loading.value = false
  }
}

async function removeConversation(conversation: AssistantConversation) {
  if (!window.confirm('Delete this conversation? This can\'t be undone.')) return
  try {
    await deleteAssistantConversation(conversation.id)
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
  const learnerMessage: AssistantMessage = {
    id: `local-${Date.now()}`, role: 'User', content: question, mode: null, sources: null,
    incomplete: false, helpful: null, createdAt: now,
  }
  const reply: AssistantMessage = {
    id: `local-reply-${Date.now()}`, role: 'Assistant', content: '', mode: null, sources: null,
    incomplete: false, helpful: null, createdAt: now,
  }
  messages.value.push(learnerMessage, reply)
  const replyRef = messages.value[messages.value.length - 1]
  draft.value = ''
  await scrollToEnd()

  try {
    if (!conversationId.value) {
      conversationId.value = (await startAssistantConversation(courseId.value)).id
    }

    await askAssistant(conversationId.value, question, route.path, {
      onStatus: (label) => { status.value = `${label}…` },
      onDelta: (chunk) => {
        replyRef.content += chunk
        void scrollToEnd()
      },
      onDone: (done) => {
        replyRef.id = done.messageId
        replyRef.mode = done.mode
      },
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
      messages.value = messages.value.filter((m) => m !== learnerMessage && m !== replyRef)
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

async function rate(message: AssistantMessage, helpful: boolean) {
  if (message.id.startsWith('local-')) return
  message.helpful = helpful
  try {
    await rateAssistantMessage(message.id, helpful)
  } catch {
    // Feedback is best-effort.
  }
}

function go(to: string) {
  router.push(to)
  // On a phone the panel covers the page it just opened.
  if (window.matchMedia('(max-width: 767px)').matches) open.value = false
}

function onReplyClick(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-app-link]')
  if (link) {
    event.preventDefault()
    go(link.getAttribute('href')!)
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
  <div
    v-if="open"
    class="fixed inset-0 z-[59] bg-black/40 md:hidden"
    @click="open = false"
  />
  <aside
    v-if="open"
    class="fixed top-0 right-0 bottom-0 z-[60] flex w-[420px] max-w-full flex-col border-l border-(--line-1) bg-(--bg-0) shadow-xl max-md:w-full"
    aria-label="Assistant"
  >
    <header class="flex items-center justify-between gap-2 border-b border-(--line-1) px-4 py-3.5">
      <span class="flex items-center gap-2 text-[15px] font-bold text-(--fg-1)">
        <Sparkles :size="16" class="text-(--brand-blue)" /> Assistant
      </span>
      <div class="flex items-center gap-1">
        <button
          v-if="view === 'chat'"
          type="button"
          class="inline-flex items-center gap-1 rounded-(--ra-md) border-0 bg-transparent px-2 py-1.5 text-xs font-semibold text-(--fg-3) hover:bg-(--bg-3) hover:text-(--fg-1) cursor-pointer"
          :disabled="streaming"
          @click="openHistory"
        >
          <History :size="13" /> History
        </button>
        <button
          v-else
          type="button"
          class="inline-flex items-center gap-1 rounded-(--ra-md) border-0 bg-transparent px-2 py-1.5 text-xs font-semibold text-(--fg-3) hover:bg-(--bg-3) hover:text-(--fg-1) cursor-pointer"
          @click="view = 'chat'"
        >
          <ArrowLeft :size="13" /> Back
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-(--ra-md) border-0 bg-transparent px-2 py-1.5 text-xs font-semibold text-(--fg-3) hover:bg-(--bg-3) hover:text-(--fg-1) cursor-pointer"
          :disabled="streaming"
          @click="newConversation"
        >
          <Plus :size="13" /> New
        </button>
        <button
          type="button"
          class="inline-flex size-8 items-center justify-center rounded-(--ra-md) border-0 bg-transparent text-(--fg-3) hover:bg-(--bg-3) hover:text-(--fg-1) cursor-pointer"
          aria-label="Close assistant"
          @click="open = false"
        >
          <X :size="16" />
        </button>
      </div>
    </header>

    <!-- History -->
    <div v-if="view === 'history'" class="flex flex-1 flex-col overflow-y-auto">
      <p class="m-0 px-4 pt-3 pb-2 text-xs text-(--fg-3)">Your conversations with the assistant. They're deleted after 90 days.</p>
      <div v-if="historyLoading" class="flex justify-center py-10"><Loader2 :size="18" class="animate-spin text-(--fg-4)" /></div>
      <p v-else-if="conversations.length === 0" class="m-0 px-4 py-10 text-center text-[13px] text-(--fg-3)">No conversations yet.</p>
      <ul v-else class="m-0 list-none p-0">
        <li
          v-for="conversation in conversations"
          :key="conversation.id"
          class="flex items-center gap-2 border-b border-(--line-1) px-4 py-3 last:border-b-0"
          :class="conversation.id === conversationId && 'bg-[rgba(59,130,246,0.08)]'"
        >
          <button
            type="button"
            class="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
            @click="openConversation(conversation.id)"
          >
            <span class="block truncate text-sm font-semibold text-(--fg-1)">{{ conversation.title ?? 'New conversation' }}</span>
            <span class="block text-xs text-(--fg-4)">{{ whenText(conversation.lastMessageAt) }}</span>
          </button>
          <button
            type="button"
            class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-(--ra-md) border-0 bg-transparent text-(--fg-4) hover:bg-(--bg-3) hover:text-(--danger)"
            :aria-label="`Delete conversation: ${conversation.title ?? 'New conversation'}`"
            @click="removeConversation(conversation)"
          >
            <Trash2 :size="14" />
          </button>
        </li>
      </ul>
      <p v-if="error" class="m-0 px-4 py-2 text-xs text-(--danger)">{{ error }}</p>
    </div>

    <p v-if="view === 'chat' && hintMode" class="m-0 border-b border-(--line-1) bg-(--warning-soft) px-4 py-2.5 text-xs text-(--fg-1)">
      You have an assessment in progress, so I'll give hints rather than answers about it.
    </p>

    <div v-show="view === 'chat'" ref="listEl" class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      <div v-if="loading" class="flex justify-center py-10"><Loader2 :size="18" class="animate-spin text-(--fg-4)" /></div>

      <div v-else-if="messages.length === 0" class="flex flex-col items-center gap-3 py-8 text-center">
        <Sparkles :size="20" class="text-(--fg-4)" />
        <p class="m-0 text-sm font-semibold text-(--fg-1)">How can I help?</p>
        <p class="m-0 max-w-72 text-[13px] text-(--fg-3)">Ask about your courses, progress and certificates, find something new to learn, or ask how to do something in the app.</p>
        <div class="mt-1 flex w-full flex-col gap-2">
          <button
            v-for="starter in STARTERS"
            :key="starter"
            type="button"
            class="w-full cursor-pointer rounded-(--ra-md) border border-(--line-2) bg-transparent px-3.5 py-2.5 text-left text-[13px] text-(--fg-2) hover:border-(--brand-blue-ring) hover:text-(--fg-1)"
            @click="send(starter)"
          >
            {{ starter }}
          </button>
        </div>
      </div>

      <template v-for="message in messages" :key="message.id">
        <div v-if="message.role === 'User'" class="self-end max-w-[85%] rounded-(--ra-md) bg-(--brand-blue) px-3.5 py-2.5 text-sm text-white whitespace-pre-wrap">
          {{ message.content }}
        </div>

        <div v-else class="flex max-w-[92%] flex-col gap-2 self-start">
          <div class="rounded-(--ra-md) border border-(--line-1) bg-(--bg-2) px-3.5 py-2.5 text-sm leading-relaxed text-(--fg-1)">
            <span v-if="!message.content && streaming" class="inline-flex items-center gap-2 text-[13px] text-(--fg-3)">
              <Loader2 :size="14" class="animate-spin text-(--fg-4)" /> {{ status || 'Thinking…' }}
            </span>
            <div
              v-if="message.content"
              class="chat-text rich-text"
              @click="onReplyClick"
              v-html="renderChatMarkdown(message.content)"
            />
            <p v-if="message.content && streaming && status && message === messages[messages.length - 1]" class="m-0 mt-1 text-xs text-(--fg-4)">{{ status }}</p>
            <p v-if="message.incomplete" class="m-0 mt-1 text-xs text-(--fg-4)">(stopped)</p>
          </div>

          <div v-if="message.content && !message.id.startsWith('local-')" class="flex items-center gap-1">
            <button
              type="button"
              class="inline-flex size-7 cursor-pointer items-center justify-center rounded-(--ra-md) border-0 bg-transparent hover:bg-(--bg-3)"
              :class="message.helpful === true ? 'text-(--success)' : 'text-(--fg-4)'"
              aria-label="Helpful"
              @click="rate(message, true)"
            >
              <ThumbsUp :size="13" />
            </button>
            <button
              type="button"
              class="inline-flex size-7 cursor-pointer items-center justify-center rounded-(--ra-md) border-0 bg-transparent hover:bg-(--bg-3)"
              :class="message.helpful === false ? 'text-(--danger)' : 'text-(--fg-4)'"
              aria-label="Not helpful"
              @click="rate(message, false)"
            >
              <ThumbsDown :size="13" />
            </button>
            <RaChip v-if="message.mode === 'hint'" tone="neutral">Hint</RaChip>
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
          placeholder="Ask anything about your learning…"
          aria-label="Your question"
          class="max-h-36 min-h-11 flex-1 resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3 py-2 font-sans text-sm text-(--fg-1) outline-none placeholder:text-(--fg-4) focus:border-(--brand-blue)"
          @keydown="onKeydown"
        />
        <RaButton v-if="streaming" type="button" variant="secondary" aria-label="Stop" @click="stop">
          <Square :size="14" />
        </RaButton>
        <RaButton v-else type="submit" :disabled="!draft.trim()" aria-label="Send">
          <Send :size="14" />
        </RaButton>
      </div>
      <p class="m-0 text-[11px] text-(--fg-4)">AI assistant. Answers can be wrong — check with your teacher.</p>
    </form>
  </aside>
</template>
