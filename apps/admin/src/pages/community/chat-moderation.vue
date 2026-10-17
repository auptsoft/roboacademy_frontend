<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Label from '@/components/ui/label.vue'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import {
  getChatQueue, getChatQueueCounts, getModeratedChannel, moderateMessage, reasonLabel,
  type ChatAction, type ChatMessage, type ChatQueueItem, type QueueView,
} from '@/api/community'

// Chat moderation (Community design, Phase C2): chat messages waiting for review or reported, and
// what staff hid or removed. Class and group chats are moderated by the class's staff; direct
// messages by school admins. Opening someone's direct conversation is logged. Learner text is
// shown as plain text, never as HTML.

const views: { id: QueueView; label: string }[] = [
  { id: 'review', label: 'Needs review' },
  { id: 'reported', label: 'Reported' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'removed', label: 'Removed' },
]
const view = ref<QueueView>('review')
const items = ref<ChatQueueItem[]>([])
const page = ref(1)
const totalPages = ref(1)
const counts = ref<{ review: number; reported: number } | null>(null)
const loading = ref(true)
const busy = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    const [result, latest] = await Promise.all([getChatQueue(view.value, page.value), getChatQueueCounts()])
    items.value = result.items
    totalPages.value = result.meta.totalPages
    counts.value = latest
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load the queue.')
  } finally {
    loading.value = false
  }
}

watch(view, () => { page.value = 1; load() })
watch(page, load)
onMounted(load)

const DONE: Record<ChatAction, string> = {
  approve: 'Approved: everyone in the chat can see it now.',
  hide: 'Hidden.',
  restore: 'Restored.',
  remove: 'Removed.',
  'dismiss-reports': 'Reports dismissed.',
}

async function act(item: ChatQueueItem, action: ChatAction, reason: string | null = null) {
  busy.value = `${item.messageId}:${action}`
  try {
    await moderateMessage(item.messageId, action, reason)
    toast.success(DONE[action])
    await load()
    if (context.value?.channel.id === item.channel.id) await openContext(item)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : "That didn't work.")
  } finally {
    busy.value = null
  }
}

// --- Hide / remove with a reason (the author is told it) ---
const reasonTarget = ref<{ item: ChatQueueItem; action: 'hide' | 'remove' } | null>(null)
const reasonText = ref('')
function askReason(item: ChatQueueItem, action: 'hide' | 'remove') {
  reasonTarget.value = { item, action }
  reasonText.value = ''
}
async function confirmReason() {
  if (!reasonTarget.value) return
  const { item, action } = reasonTarget.value
  reasonTarget.value = null
  await act(item, action, reasonText.value.trim() || null)
}

// --- The conversation around a message ---
const context = ref<{ channel: ChatQueueItem['channel']; messages: ChatMessage[]; focus: string } | null>(null)
const contextLoading = ref(false)

async function openContext(item: ChatQueueItem) {
  contextLoading.value = true
  try {
    const result = await getModeratedChannel(item.channel.id)
    context.value = { channel: result.channel, messages: result.messages, focus: item.messageId }
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : "Couldn't open the conversation.")
  } finally {
    contextLoading.value = false
  }
}

function kindLabel(kind: ChatQueueItem['channel']['kind']) {
  return kind === 'Direct' ? 'Direct message' : kind === 'StudyGroup' ? 'Study group chat' : 'Class chat'
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Chat moderation</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Chat messages held by the word filter, AI screening or reports, and messages from Restricted classes waiting for approval.
      </p>
    </div>

    <div class="flex flex-wrap gap-2" role="tablist">
      <button
        v-for="option in views"
        :key="option.id"
        type="button"
        role="tab"
        :aria-selected="view === option.id"
        class="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold cursor-pointer"
        :class="view === option.id ? 'border-(--brand-blue) bg-(--brand-blue-soft) text-(--brand-blue)' : 'border-(--line-2) bg-transparent text-(--fg-2)'"
        @click="view = option.id"
      >
        {{ option.label }}
        <template v-if="option.id === 'review' && counts">({{ counts.review }})</template>
        <template v-if="option.id === 'reported' && counts">({{ counts.reported }})</template>
      </button>
    </div>

    <p v-if="loading" class="flex items-center gap-2 text-[13px] text-(--fg-3)"><Loader2 :size="16" class="animate-spin" /> Loading…</p>
    <p v-else-if="items.length === 0" class="py-12 text-center text-sm text-(--fg-3)">Nothing here.</p>

    <div v-else class="flex flex-col gap-3">
      <RaCard v-for="item in items" :key="item.messageId" :padding="20" class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2 text-xs text-(--fg-3)">
          <RaChip tone="neutral">{{ kindLabel(item.channel.kind) }}</RaChip>
          <span class="font-semibold text-(--fg-2)">{{ item.channel.name }}</span>
          <span>· {{ item.author.name }}</span>
          <span>· {{ new Date(item.createdAt).toLocaleString() }}</span>
          <RaChip v-if="item.statusReason" tone="info">{{ reasonLabel(item.statusReason) }}</RaChip>
        </div>
        <p class="m-0 whitespace-pre-wrap break-words text-sm text-(--fg-1)">{{ item.body || '(no text)' }}</p>
        <ul v-if="item.reports.length" class="m-0 flex list-none flex-col gap-1 p-0 text-xs text-(--fg-2)">
          <li v-for="report in item.reports" :key="report.reason">
            Reported as {{ report.reason }} ({{ report.count }})<template v-if="report.notes.length">: “{{ report.notes.join('”, “') }}”</template>
          </li>
        </ul>
        <div class="flex flex-wrap gap-2">
          <Button v-if="item.status === 'Held' || item.status === 'PendingApproval'" size="sm" :disabled="!!busy" @click="act(item, 'approve')">Approve</Button>
          <Button v-if="item.status === 'Hidden' || item.status === 'Held'" size="sm" variant="outline" :disabled="!!busy" @click="act(item, 'restore')">Restore</Button>
          <Button v-if="item.status !== 'Hidden' && item.status !== 'Removed'" size="sm" variant="outline" :disabled="!!busy" @click="askReason(item, 'hide')">Hide</Button>
          <Button v-if="item.status !== 'Removed'" size="sm" variant="destructive" :disabled="!!busy" @click="askReason(item, 'remove')">Remove</Button>
          <Button v-if="item.reports.length" size="sm" variant="ghost" :disabled="!!busy" @click="act(item, 'dismiss-reports')">Dismiss reports</Button>
          <Button size="sm" variant="ghost" :disabled="contextLoading" @click="openContext(item)">
            {{ item.channel.kind === 'Direct' ? 'Open conversation (logged)' : 'See the conversation' }}
          </Button>
        </div>
      </RaCard>

      <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 text-sm text-(--fg-2)">
        <Button size="sm" variant="outline" :disabled="page <= 1" @click="page--">Previous</Button>
        Page {{ page }} of {{ totalPages }}
        <Button size="sm" variant="outline" :disabled="page >= totalPages" @click="page++">Next</Button>
      </div>
    </div>

    <Dialog :open="!!reasonTarget" @update:open="(open: boolean) => { if (!open) reasonTarget = null }">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ reasonTarget?.action === 'remove' ? 'Remove this message' : 'Hide this message' }}</DialogTitle>
          <DialogDescription>The author is told, with your reason if you give one.</DialogDescription>
        </DialogHeader>
        <Label for="chat-reason">Reason (optional)</Label>
        <textarea id="chat-reason" v-model="reasonText" rows="3" maxlength="500" class="resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-3 py-2 text-sm text-(--fg-1) outline-none" />
        <DialogFooter>
          <Button variant="outline" @click="reasonTarget = null">Cancel</Button>
          <Button :variant="reasonTarget?.action === 'remove' ? 'destructive' : 'default'" @click="confirmReason">
            {{ reasonTarget?.action === 'remove' ? 'Remove' : 'Hide' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!context" @update:open="(open: boolean) => { if (!open) context = null }">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ context?.channel.name }}</DialogTitle>
          <DialogDescription>The latest messages, whatever their status. The flagged one is highlighted.</DialogDescription>
        </DialogHeader>
        <div class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          <div
            v-for="message in context?.messages ?? []"
            :key="message.id"
            class="rounded-(--ra-md) px-3 py-2"
            :class="message.id === context?.focus ? 'bg-(--brand-blue-soft)' : ''"
          >
            <div class="flex flex-wrap items-baseline gap-2 text-xs text-(--fg-3)">
              <span class="font-semibold text-(--fg-1)">{{ message.author.name }}</span>
              <span>{{ new Date(message.createdAt).toLocaleString() }}</span>
              <span v-if="message.status !== 'Visible'">· {{ message.status }}</span>
              <span v-if="message.isDeleted">· deleted by author</span>
            </div>
            <p class="m-0 whitespace-pre-wrap break-words text-sm text-(--fg-1)">{{ message.body }}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
