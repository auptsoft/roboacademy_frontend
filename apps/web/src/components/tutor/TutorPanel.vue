<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { RaButton, RaChip } from '@roboacademy/ui'
import { ArrowLeft, History, Loader2, Plus, Send, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import {
  askTutor,
  deleteTutorConversation,
  getTutorMessages,
  listTutorConversations,
  rateTutorMessage,
  startTutorConversation,
  type TutorConversation,
  type TutorMessage,
  type TutorSource,
} from '@/api/ai'
import { renderChatMarkdown } from '@/lib/chat-markdown'

// The lesson tutor: answers from this course's own notes, citing the lessons it used. Replies are
// model output, so they're rendered through the strict chat Markdown renderer (see chat-markdown). While the learner has an
// assessment open the tutor gives hints rather than answers - the panel says so.

const props = defineProps<{ courseId: string; lessonId: string | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ openLesson: [lessonId: string] }>()

const conversationId = ref<string | null>(null)
const messages = ref<TutorMessage[]>([])
const loading = ref(false)
const draft = ref('')
const streaming = ref(false)
const error = ref('')
const listEl = ref<HTMLElement | null>(null)
let controller: AbortController | null = null

// History: the learner's earlier conversations for this course (newest first, kept 90 days).
const view = ref<'chat' | 'history'>('chat')
const conversations = ref<TutorConversation[]>([])
const historyLoading = ref(false)

const MAX_CHARS = 2000

const hintMode = computed(() => [...messages.value].reverse().find((m) => m.role === 'Assistant')?.mode === 'hint')

async function loadLatest() {
  loading.value = true
  error.value = ''
  try {
    conversations.value = await listTutorConversations(props.courseId)
    conversationId.value = conversations.value[0]?.id ?? null
    messages.value = conversationId.value ? await getTutorMessages(conversationId.value) : []
    await scrollToEnd()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not load the tutor.'
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    view.value = 'chat'
    void loadLatest()
  } else {
    controller?.abort()
  }
}, { immediate: true })

watch(() => props.courseId, () => {
  if (open.value) {
    view.value = 'chat'
    void loadLatest()
  }
})

async function openHistory() {
  view.value = 'history'
  historyLoading.value = true
  try {
    conversations.value = await listTutorConversations(props.courseId)
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
    messages.value = await getTutorMessages(id)
    conversationId.value = id
    await scrollToEnd()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not open that conversation.'
  } finally {
    loading.value = false
  }
}

async function removeConversation(conversation: TutorConversation) {
  if (!window.confirm('Delete this conversation? This can\'t be undone.')) return
  try {
    await deleteTutorConversation(conversation.id)
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

async function send() {
  const question = draft.value.trim()
  if (!question || streaming.value) return
  error.value = ''
  streaming.value = true
  controller = new AbortController()

  const learnerMessage: TutorMessage = {
    id: `local-${Date.now()}`, role: 'User', content: question, mode: null, sources: null,
    incomplete: false, helpful: null, createdAt: new Date().toISOString(),
  }
  const reply: TutorMessage = {
    id: `local-reply-${Date.now()}`, role: 'Assistant', content: '', mode: null, sources: [],
    incomplete: false, helpful: null, createdAt: new Date().toISOString(),
  }
  messages.value.push(learnerMessage, reply)
  const replyRef = messages.value[messages.value.length - 1]
  draft.value = ''
  await scrollToEnd()

  try {
    if (!conversationId.value) {
      conversationId.value = (await startTutorConversation(props.courseId, props.lessonId)).id
    }

    await askTutor(conversationId.value, question, props.lessonId, {
      onSources: (sources) => { replyRef.sources = sources },
      onDelta: (text) => {
        replyRef.content += text
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
      error.value = e instanceof ApiError ? e.message : 'The tutor is unavailable right now.'
    }
  } finally {
    streaming.value = false
    controller = null
  }
}

function stop() {
  controller?.abort()
}

async function rate(message: TutorMessage, helpful: boolean) {
  if (message.id.startsWith('local-')) return
  message.helpful = helpful
  try {
    await rateTutorMessage(message.id, helpful)
  } catch {
    // Feedback is best-effort.
  }
}

function sourceFor(message: TutorMessage, n: number): TutorSource | undefined {
  return message.sources?.find((s) => s.n === n)
}

const router = useRouter()

// Citation chips open the cited lesson; app links navigate inside the app.
function onReplyClick(message: TutorMessage, event: MouseEvent) {
  const target = event.target as HTMLElement
  const cite = target.closest<HTMLElement>('[data-cite]')
  const source = cite ? sourceFor(message, Number(cite.dataset.cite)) : undefined
  if (source) {
    emit('openLesson', source.lessonId)
    return
  }
  const link = target.closest<HTMLAnchorElement>('a[data-app-link]')
  if (link) {
    event.preventDefault()
    void router.push(link.getAttribute('href')!)
  }
}

function citedSources(message: TutorMessage): TutorSource[] {
  const cited = new Set([...message.content.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])))
  return (message.sources ?? []).filter((s) => cited.has(s.n))
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
    class="fixed inset-0 z-[39] bg-black/40 md:hidden"
    @click="open = false"
  />
  <aside
    v-if="open"
    class="fixed top-0 right-0 bottom-0 z-40 flex w-[420px] max-w-full flex-col border-l border-(--line-1) bg-(--bg-0) shadow-xl max-md:w-full"
    aria-label="Lesson tutor"
  >
    <header class="flex items-center justify-between gap-2 border-b border-(--line-1) px-4 py-3.5">
      <span class="flex items-center gap-2 text-[15px] font-bold text-(--fg-1)">
        <Sparkles :size="16" class="text-(--brand-blue)" /> Ask the tutor
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
          aria-label="Close tutor"
          @click="open = false"
        >
          <X :size="16" />
        </button>
      </div>
    </header>

    <!-- History -->
    <div v-if="view === 'history'" class="flex flex-1 flex-col overflow-y-auto">
      <p class="m-0 px-4 pt-3 pb-2 text-xs text-(--fg-3)">Your conversations about this course. They're deleted after 90 days.</p>
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
      You have an assessment in progress, so I'll give hints rather than answers.
    </p>

    <div v-show="view === 'chat'" ref="listEl" class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      <div v-if="loading" class="flex justify-center py-10"><Loader2 :size="18" class="animate-spin text-(--fg-4)" /></div>

      <div v-else-if="messages.length === 0" class="flex flex-col items-center gap-2 py-10 text-center">
        <Sparkles :size="20" class="text-(--fg-4)" />
        <p class="m-0 text-sm font-semibold text-(--fg-1)">Stuck on something?</p>
        <p class="m-0 max-w-64 text-[13px] text-(--fg-3)">Ask about this course and I'll answer from its lessons.</p>
      </div>

      <template v-for="message in messages" :key="message.id">
        <div v-if="message.role === 'User'" class="self-end max-w-[85%] rounded-(--ra-md) bg-(--brand-blue) px-3.5 py-2.5 text-sm text-white whitespace-pre-wrap">
          {{ message.content }}
        </div>

        <div v-else class="flex max-w-[92%] flex-col gap-2 self-start">
          <div class="rounded-(--ra-md) border border-(--line-1) bg-(--bg-2) px-3.5 py-2.5 text-sm leading-relaxed text-(--fg-1)">
            <Loader2 v-if="!message.content && streaming" :size="14" class="animate-spin text-(--fg-4)" />
            <div
              v-if="message.content"
              class="chat-text rich-text"
              @click="onReplyClick(message, $event)"
              v-html="renderChatMarkdown(message.content)"
            />
            <p v-if="message.incomplete" class="m-0 mt-1 text-xs text-(--fg-4)">(stopped)</p>
          </div>

          <div v-if="citedSources(message).length" class="flex flex-wrap gap-1.5">
            <button
              v-for="source in citedSources(message)"
              :key="source.n"
              type="button"
              class="cursor-pointer rounded-(--ra-pill) border border-(--line-2) bg-transparent px-2.5 py-1 text-[11px] font-semibold text-(--fg-2) hover:text-(--fg-1)"
              @click="emit('openLesson', source.lessonId)"
            >
              {{ source.n }} · {{ source.lessonTitle }}
            </button>
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

    <form v-if="view === 'chat'" class="flex flex-col gap-2 border-t border-(--line-1) px-4 py-3" @submit.prevent="send">
      <p v-if="error" class="m-0 text-xs text-(--danger)">{{ error }}</p>
      <div class="flex items-end gap-2">
        <textarea
          v-model="draft"
          rows="2"
          :maxlength="MAX_CHARS"
          placeholder="Ask a question about this course…"
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
      <p class="m-0 text-[11px] text-(--fg-4)">AI tutor. Answers can be wrong — check with your teacher.</p>
    </form>
  </aside>
</template>
