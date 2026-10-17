<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import {
  getQueue, getQueueCounts, listMutes, moderate, muteUser, reasonLabel, unmuteUser,
  type ModerationAction, type Mute, type QueueItem, type QueueView,
} from '@/api/community'
import { hasPermission } from '@/store/auth'

// Community moderation (Community design §8): what's waiting for review or was reported, what
// staff hid or removed, and who's muted. Teachers see their own classes and course-wide Q&A;
// school admins see everything. Learner text is shown as plain text, never as HTML.

const schoolWide = hasPermission('community:settings:manage')

const views: { id: QueueView; label: string }[] = [
  { id: 'review', label: 'Needs review' },
  { id: 'reported', label: 'Reported' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'removed', label: 'Removed' },
]
const view = ref<QueueView>('review')
const items = ref<QueueItem[]>([])
const page = ref(1)
const totalPages = ref(1)
const counts = ref<{ review: number; reported: number } | null>(null)
const loading = ref(true)
const busy = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    const [result, latest] = await Promise.all([getQueue(view.value, page.value), getQueueCounts()])
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

async function act(item: QueueItem, action: ModerationAction, reason: string | null = null) {
  busy.value = `${item.contentId}:${action}`
  try {
    await moderate(item.contentType, item.contentId, action, reason)
    toast.success(DONE[action])
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'That didn\'t work.')
  } finally {
    busy.value = null
  }
}

const DONE: Record<ModerationAction, string> = {
  approve: 'Approved: everyone can see it now.',
  hide: 'Hidden.',
  restore: 'Restored.',
  remove: 'Removed.',
  pin: 'Pinned.',
  unpin: 'Unpinned.',
  lock: 'Locked.',
  unlock: 'Unlocked.',
  'dismiss-reports': 'Reports dismissed.',
}

// --- Hide / remove with a reason (the author is told it) ---
const reasonTarget = ref<{ item: QueueItem; action: 'hide' | 'remove' } | null>(null)
const reasonText = ref('')
function askReason(item: QueueItem, action: 'hide' | 'remove') {
  reasonTarget.value = { item, action }
  reasonText.value = ''
}
async function confirmReason() {
  if (!reasonTarget.value) return
  const { item, action } = reasonTarget.value
  reasonTarget.value = null
  await act(item, action, reasonText.value.trim() || null)
}

// --- Muting ---
const mutes = ref<Mute[]>([])
const muteTarget = ref<{ userId: string; name: string } | null>(null)
const muteDays = ref<number | null>(3)
const muteReason = ref('')
const muting = ref(false)

async function loadMutes() {
  try {
    mutes.value = await listMutes()
  } catch {
    mutes.value = []
  }
}

function askMute(item: QueueItem) {
  muteTarget.value = { userId: item.author.id, name: item.author.name }
  muteDays.value = 3
  muteReason.value = ''
}

async function confirmMute() {
  if (!muteTarget.value || !muteReason.value.trim()) return
  muting.value = true
  try {
    await muteUser(muteTarget.value.userId, muteDays.value, muteReason.value.trim())
    toast.success(`${muteTarget.value.name} is muted.`)
    muteTarget.value = null
    await loadMutes()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to mute.')
  } finally {
    muting.value = false
  }
}

async function unmute(mute: Mute) {
  try {
    await unmuteUser(mute.userId)
    toast.success(`${mute.name} can post again.`)
    await loadMutes()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to unmute.')
  }
}

function until(value: string | null) {
  if (!value) return ''
  return new Date(value).getFullYear() >= 9999 ? 'until unmuted' : `until ${new Date(value).toLocaleString()}`
}

const countFor = computed(() => (id: QueueView) =>
  id === 'review' ? counts.value?.review : id === 'reported' ? counts.value?.reported : undefined)

onMounted(() => {
  load()
  loadMutes()
})

const selectClass = 'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2 text-sm text-(--fg-1) outline-none'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Moderation</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Posts and replies waiting for you, and what learners have reported.
        {{ schoolWide ? 'You see the whole school.' : 'You see your classes and course-wide questions.' }}
      </p>
    </div>

    <nav class="flex flex-wrap gap-1.5" aria-label="Queue">
      <button
        v-for="option in views"
        :key="option.id"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold cursor-pointer"
        :class="view === option.id ? 'border-(--brand-blue) bg-(--brand-blue-soft) text-(--brand-blue)' : 'border-(--line-2) bg-transparent text-(--fg-2)'"
        @click="view = option.id"
      >
        {{ option.label }}
        <span v-if="countFor(option.id)" class="rounded-full bg-(--danger) px-1.5 text-[11px] text-white">{{ countFor(option.id) }}</span>
      </button>
    </nav>

    <p v-if="loading" class="flex items-center gap-2 text-[13px] text-(--fg-3)"><Loader2 :size="16" class="animate-spin" /> Loading…</p>
    <p v-else-if="!items.length" class="m-0 py-10 text-center text-sm text-(--fg-3)">Nothing here. 🎉</p>

    <div v-else class="flex flex-col gap-3">
      <RaCard v-for="item in items" :key="item.contentType + item.contentId" :padding="20" class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2 text-xs text-(--fg-3)">
          <RaChip tone="neutral">{{ item.space.name }}</RaChip>
          <span>{{ item.contentType === 'Reply' ? 'Reply on' : item.postKind }}: <strong class="text-(--fg-2)">{{ item.postTitle }}</strong></span>
          <span>· {{ item.author.name }}</span>
          <span>· {{ new Date(item.createdAt).toLocaleString() }}</span>
        </div>

        <p v-if="item.statusReason" class="m-0 text-xs font-semibold" :class="item.statusReason.startsWith('ai:self_harm') ? 'text-(--danger)' : 'text-(--warning)'">
          {{ reasonLabel(item.statusReason) }}
        </p>
        <div v-if="item.reports.length" class="flex flex-col gap-1 text-xs text-(--fg-2)">
          <span v-for="r in item.reports" :key="r.reason">
            Reported {{ r.count }}× as <strong>{{ r.reason }}</strong>
            <template v-if="r.notes.length">: “{{ r.notes.join('”, “') }}”</template>
          </span>
        </div>

        <p class="m-0 whitespace-pre-line rounded-(--ra-md) bg-(--bg-2) px-3 py-2.5 text-sm leading-relaxed text-(--fg-1)">{{ item.body }}</p>

        <div class="flex flex-wrap gap-2">
          <Button v-if="item.status === 'Held' || item.status === 'PendingApproval'" size="sm" :disabled="!!busy" @click="act(item, 'approve')">Approve</Button>
          <Button v-if="item.status === 'Hidden'" variant="outline" size="sm" :disabled="!!busy" @click="act(item, 'restore')">Restore</Button>
          <Button v-if="item.status !== 'Hidden' && item.status !== 'Removed'" variant="outline" size="sm" :disabled="!!busy" @click="askReason(item, 'hide')">Hide</Button>
          <Button v-if="item.status !== 'Removed'" variant="destructive" size="sm" :disabled="!!busy" @click="askReason(item, 'remove')">Remove</Button>
          <Button v-if="view === 'reported'" variant="ghost" size="sm" :disabled="!!busy" @click="act(item, 'dismiss-reports')">Dismiss reports</Button>
          <Button v-if="!item.author.isStaff && item.author.id !== '00000000-0000-0000-0000-000000000000'" variant="ghost" size="sm" @click="askMute(item)">Mute {{ item.author.name }}</Button>
        </div>
      </RaCard>

      <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 text-sm text-(--fg-3)">
        <Button variant="outline" size="sm" :disabled="page <= 1" @click="page--">Previous</Button>
        Page {{ page }} of {{ totalPages }}
        <Button variant="outline" size="sm" :disabled="page >= totalPages" @click="page++">Next</Button>
      </div>
    </div>

    <RaCard :padding="24" class="flex flex-col gap-3">
      <h2 class="m-0 text-lg font-bold text-(--fg-1)">Muted</h2>
      <p class="m-0 text-xs text-(--fg-3)">Muted learners can read but can't post, reply or react.</p>
      <p v-if="!mutes.length" class="m-0 text-sm text-(--fg-3)">Nobody is muted.</p>
      <div v-for="mute in mutes" :key="mute.userId" class="flex items-center gap-3 border-b border-(--line-1) py-2.5 last:border-b-0 max-sm:flex-col max-sm:items-start">
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-(--fg-1)">{{ mute.name }}</span>
          <span class="text-xs text-(--fg-3)"> {{ until(mute.mutedUntil) }}<template v-if="mute.mutedBy"> · by {{ mute.mutedBy }}</template></span>
          <p v-if="mute.reason" class="m-0 text-xs text-(--fg-3)">{{ mute.reason }}</p>
        </div>
        <Button variant="ghost" size="sm" @click="unmute(mute)">Unmute</Button>
      </div>
    </RaCard>

    <Dialog :open="!!reasonTarget" @update:open="(open) => { if (!open) reasonTarget = null }">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ reasonTarget?.action === 'remove' ? 'Remove' : 'Hide' }} this {{ reasonTarget?.item.contentType === 'Reply' ? 'reply' : 'post' }}</DialogTitle>
          <DialogDescription>
            The author is told it was {{ reasonTarget?.action === 'remove' ? 'removed' : 'hidden' }}, with your reason if you give one.
            <template v-if="reasonTarget?.action === 'remove'"> Removed content is kept for 90 days for your records, then deleted.</template>
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-1.5">
          <Label for="moderation-reason">Reason (optional)</Label>
          <Input id="moderation-reason" v-model="reasonText" maxlength="500" placeholder="e.g. Please keep comments kind" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="reasonTarget = null">Cancel</Button>
          <Button :variant="reasonTarget?.action === 'remove' ? 'destructive' : 'default'" @click="confirmReason">
            {{ reasonTarget?.action === 'remove' ? 'Remove' : 'Hide' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!muteTarget" @update:open="(open) => { if (!open && !muting) muteTarget = null }">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mute {{ muteTarget?.name }}</DialogTitle>
          <DialogDescription>They can still read, but can't post, reply or react until the mute ends.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="confirmMute">
          <div class="grid gap-1.5">
            <Label for="mute-days">For how long</Label>
            <select id="mute-days" v-model="muteDays" :class="selectClass">
              <option :value="1">1 day</option>
              <option :value="3">3 days</option>
              <option :value="7">1 week</option>
              <option :value="30">30 days</option>
              <option v-if="schoolWide" :value="null">Until I unmute them</option>
            </select>
          </div>
          <div class="grid gap-1.5">
            <Label for="mute-reason">Reason</Label>
            <Input id="mute-reason" v-model="muteReason" maxlength="500" required />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" :disabled="muting" @click="muteTarget = null">Cancel</Button>
            <Button type="submit" :disabled="muting || !muteReason.trim()">{{ muting ? 'Muting…' : 'Mute' }}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
