<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, Flag, Loader2, Lock, Pencil, Quote, Trash2 } from 'lucide-vue-next'
import { RaButton, RaChip } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import {
  acceptAnswer, clearAnswer, createReply, deletePost, deleteReply, editPost, editReply, emptyAttachments,
  getCommunityHome, getPost, statusLabel, toAttachmentDraft,
  type CommunityHome, type PickedAttachments, type PostDetail, type Reply,
} from '@/api/community'
import { getCurrentUser } from '@/store/auth'
import { renderCommunityMarkdown } from '@/lib/community-markdown'
import { formatNotificationTime } from '@/composables/useNotifications'
import AttachmentList from '@/components/community/AttachmentList.vue'
import AttachmentPicker from '@/components/community/AttachmentPicker.vue'
import ReactionBar from '@/components/community/ReactionBar.vue'
import ReportDialog from '@/components/community/ReportDialog.vue'

const route = useRoute()
const router = useRouter()

const detail = ref<PostDetail | null>(null)
// The caller's safety rules decide which attachments a reply can carry.
const home = ref<CommunityHome | null>(null)
const me = computed(() => getCurrentUser()?.userId ?? null)
const status = ref<'loading' | 'idle' | 'error' | 'not-found'>('loading')
const notice = ref('')
const error = ref('')

async function load() {
  status.value = 'loading'
  try {
    const [post, rules] = await Promise.all([getPost(String(route.params.id)), home.value ?? getCommunityHome()])
    detail.value = post
    home.value = rules
    status.value = 'idle'
    await nextTick()
    if (route.hash) document.querySelector(route.hash)?.scrollIntoView({ block: 'center' })
  } catch (e) {
    status.value = e instanceof ApiError && e.status === 404 ? 'not-found' : 'error'
  }
}
watch(() => route.params.id, load, { immediate: true })

const post = computed(() => detail.value?.post ?? null)
const isQuestion = computed(() => post.value?.kind === 'Question')
const backTo = computed(() => {
  const space = detail.value?.space
  if (!space) return '/app/community'
  if (space.kind === 'CourseQA') return `/app/community/courses/${space.contextId}`
  if (space.kind === 'StudyGroup') return `/app/community/groups/${space.contextId}`
  return `/app/community?board=${space.id}`
})
const replyById = computed(() => new Map((detail.value?.replies ?? []).map((r) => [r.id, r])))

async function run(action: () => Promise<unknown>, done?: string) {
  error.value = ''
  notice.value = ''
  try {
    await action()
    if (done) notice.value = done
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong.'
  }
}

// ── Reply ────────────────────────────────────────────────────────────────────
const replyBody = ref('')
const replyAttachments = ref<PickedAttachments>(emptyAttachments())
const quoting = ref<Reply | null>(null)
const sending = ref(false)

async function sendReply() {
  if (!detail.value || !replyBody.value.trim()) return
  sending.value = true
  await run(async () => {
    const before = new Set(detail.value!.replies.map((r) => r.id))
    detail.value = await createReply(
      detail.value!.post.id, replyBody.value.trim(), toAttachmentDraft(replyAttachments.value), quoting.value?.id ?? null)
    const mine = detail.value.replies.find((r) => !before.has(r.id))
    replyBody.value = ''
    replyAttachments.value = emptyAttachments()
    quoting.value = null
    if (mine && mine.status !== 'Visible') notice.value = statusLabel(mine.status) ?? ''
  })
  sending.value = false
}

function quote(reply: Reply) {
  quoting.value = reply
  document.getElementById('reply-box')?.focus()
}

// ── Edit ─────────────────────────────────────────────────────────────────────
const editing = ref<'post' | string | null>(null)
const editTitle = ref('')
const editBody = ref('')

function startEdit(target: 'post' | Reply) {
  if (target === 'post' && detail.value) {
    editing.value = 'post'
    editTitle.value = detail.value.post.title
    editBody.value = detail.value.body
  } else if (target !== 'post') {
    editing.value = target.id
    editBody.value = target.body
  }
}

async function saveEdit() {
  if (!detail.value || !editing.value) return
  const target = editing.value
  await run(async () => {
    detail.value = target === 'post'
      ? await editPost(detail.value!.post.id, editTitle.value.trim(), editBody.value.trim())
      : await editReply(target, editBody.value.trim())
    editing.value = null
  }, 'Saved.')
}

// ── Delete, accept, report ───────────────────────────────────────────────────
async function removePost() {
  if (!detail.value || !confirm('Delete your post?')) return
  await run(async () => {
    await deletePost(detail.value!.post.id)
    router.push(backTo.value)
  })
}

async function removeReply(reply: Reply) {
  if (!confirm('Delete your reply?')) return
  await run(async () => {
    await deleteReply(reply.id)
    await load()
  }, 'Reply deleted.')
}

async function toggleAccepted(reply: Reply) {
  if (!detail.value) return
  await run(async () => {
    if (reply.isAccepted) await clearAnswer(detail.value!.post.id)
    else await acceptAnswer(detail.value!.post.id, reply.id)
    await load()
  })
}

const reportTarget = ref<{ type: 'Post' | 'Reply'; id: string } | null>(null)
const reportOpen = ref(false)
function report(type: 'Post' | 'Reply', id: string) {
  reportTarget.value = { type, id }
  reportOpen.value = true
}

const fieldClass =
  'w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm text-(--fg-1) outline-none focus:border-(--brand-blue)'
const actionClass =
  'inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs font-semibold text-(--fg-3) cursor-pointer hover:text-(--fg-1)'
</script>

<template>
  <div class="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-12 pt-12 pb-12 max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <button class="self-start inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-[13px] font-medium text-(--fg-3) hover:text-(--fg-1)" @click="router.push(backTo)">
      <ArrowLeft :size="16" /> {{ detail?.space.name ?? 'Community' }}
    </button>

    <div v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <div v-else-if="status !== 'idle' || !detail || !post" class="flex flex-col items-center gap-3 py-16 text-center">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-(--danger-soft) text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">{{ status === 'not-found' ? "This post doesn't exist or isn't open to you." : "Couldn't load this post." }}</p>
      <RaButton v-if="status === 'error'" variant="secondary" @click="load">Try again</RaButton>
    </div>

    <template v-else>
      <article class="flex flex-col gap-4 rounded-(--ra-xl) bg-(--surface) p-6 shadow-(--surface-shadow) max-sm:p-4">
        <div class="flex flex-wrap items-center gap-2 text-xs text-(--fg-3)">
          <RaChip v-if="post.kind === 'Announcement'" tone="info">Announcement</RaChip>
          <RaChip v-else-if="isQuestion" :tone="post.isAnswered ? 'student' : 'neutral'">{{ post.isAnswered ? 'Answered' : 'Question' }}</RaChip>
          <span class="font-semibold text-(--fg-2)">{{ post.author.name }}</span>
          <RaChip v-if="post.author.isStaff" tone="instructor">Staff</RaChip>
          <span>{{ formatNotificationTime(post.createdAt) }}<template v-if="post.editedAt"> · edited</template></span>
          <span v-if="post.audienceClass">· {{ post.audienceClass.name }} only</span>
          <span v-if="post.isLocked" class="inline-flex items-center gap-1"><Lock :size="12" /> Locked</span>
        </div>

        <p v-if="statusLabel(post.status)" class="m-0 rounded-(--ra-md) bg-(--warning-soft) px-3 py-2 text-[13px] text-(--fg-1)">
          {{ statusLabel(post.status) }}<template v-if="post.statusReason && post.status === 'Hidden'">: {{ post.statusReason }}</template>
        </p>

        <template v-if="editing === 'post'">
          <input v-model="editTitle" type="text" maxlength="150" :class="fieldClass" aria-label="Title" />
          <textarea v-model="editBody" rows="6" maxlength="10000" :class="[fieldClass, 'resize-y']" aria-label="Post" />
          <div class="flex justify-end gap-2">
            <RaButton variant="ghost" @click="editing = null">Cancel</RaButton>
            <RaButton :disabled="!editTitle.trim() || !editBody.trim()" @click="saveEdit">Save</RaButton>
          </div>
        </template>
        <template v-else>
          <p v-if="post.isDeleted" class="m-0 italic text-(--fg-3)">This post was deleted by its author.</p>
          <template v-else>
            <h1 class="m-0 text-2xl font-semibold tracking-[-0.01em] text-(--heading)">{{ post.title }}</h1>
            <div class="community-body text-[15px] leading-[1.7] text-(--fg-1)" v-html="renderCommunityMarkdown(detail.body)" />
            <AttachmentList :attachments="detail.attachments" />
          </template>
        </template>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <ReactionBar
            v-if="!post.isDeleted && post.status === 'Visible'"
            :key="post.id"
            content-type="Post"
            :content-id="post.id"
            :reactions="post.reactions"
            :question="isQuestion"
            :disabled="!detail.space.canComment"
            @error="error = $event"
          />
          <div class="ml-auto flex items-center gap-4">
            <span v-if="detail.seenCount !== null" class="inline-flex items-center gap-1 text-xs text-(--fg-3)"><Eye :size="13" /> Seen by {{ detail.seenCount }}</span>
            <button v-if="detail.canEdit && editing !== 'post'" type="button" :class="actionClass" @click="startEdit('post')"><Pencil :size="13" /> Edit</button>
            <button v-if="detail.canDelete && post.author.id === me" type="button" :class="actionClass" @click="removePost"><Trash2 :size="13" /> Delete</button>
            <button v-if="!post.isDeleted && post.author.id !== me" type="button" :class="actionClass" @click="report('Post', post.id)"><Flag :size="13" /> Report</button>
          </div>
        </div>
      </article>

      <p v-if="notice" class="m-0 rounded-(--ra-md) bg-(--success-soft) px-3 py-2 text-[13px] text-(--fg-1)">{{ notice }}</p>
      <p v-if="error" class="m-0 rounded-(--ra-md) bg-(--danger-soft) px-3 py-2 text-[13px] text-(--danger)">{{ error }}</p>

      <section class="flex flex-col gap-3" aria-label="Replies">
        <h2 class="m-0 text-base font-semibold text-(--heading)">
          {{ detail.replies.length ? `${detail.replies.length} ${detail.replies.length === 1 ? 'reply' : 'replies'}` : 'No replies yet' }}
        </h2>

        <div
          v-for="reply in detail.replies"
          :id="`reply-${reply.id}`"
          :key="reply.id"
          :class="[
            'flex flex-col gap-2.5 rounded-(--ra-lg) border px-4 py-3.5',
            reply.isAccepted ? 'border-(--success) bg-(--success-soft)' : 'border-(--line-1) bg-(--surface)',
          ]"
        >
          <div class="flex flex-wrap items-center gap-2 text-xs text-(--fg-3)">
            <span class="font-semibold text-(--fg-2)">{{ reply.author.name }}</span>
            <RaChip v-if="reply.author.isStaff" tone="instructor">Staff</RaChip>
            <span>{{ formatNotificationTime(reply.createdAt) }}<template v-if="reply.editedAt"> · edited</template></span>
            <span v-if="reply.isAccepted" class="inline-flex items-center gap-1 font-semibold text-(--success)"><CheckCircle2 :size="13" /> Answer</span>
          </div>

          <p v-if="statusLabel(reply.status)" class="m-0 text-xs font-semibold text-(--warning)">{{ statusLabel(reply.status) }}</p>

          <blockquote v-if="reply.quotedReplyId && replyById.get(reply.quotedReplyId)" class="m-0 border-l-2 border-(--line-2) pl-3 text-[13px] text-(--fg-3) line-clamp-3">
            {{ replyById.get(reply.quotedReplyId)!.author.name }}: {{ replyById.get(reply.quotedReplyId)!.body }}
          </blockquote>

          <template v-if="editing === reply.id">
            <textarea v-model="editBody" rows="4" maxlength="5000" :class="[fieldClass, 'resize-y']" aria-label="Reply" />
            <div class="flex justify-end gap-2">
              <RaButton variant="ghost" @click="editing = null">Cancel</RaButton>
              <RaButton :disabled="!editBody.trim()" @click="saveEdit">Save</RaButton>
            </div>
          </template>
          <template v-else>
            <p v-if="reply.isDeleted" class="m-0 text-sm italic text-(--fg-3)">Deleted by its author</p>
            <template v-else>
              <div class="community-body text-sm leading-[1.7] text-(--fg-1)" v-html="renderCommunityMarkdown(reply.body)" />
              <AttachmentList :attachments="reply.attachments" />
            </template>
          </template>

          <div v-if="!reply.isDeleted" class="flex flex-wrap items-center justify-between gap-3">
            <ReactionBar
              v-if="reply.status === 'Visible'"
              content-type="Reply"
              :content-id="reply.id"
              :reactions="reply.reactions"
              :disabled="!detail.space.canComment"
              @error="error = $event"
            />
            <div class="ml-auto flex items-center gap-4">
              <button v-if="detail.canAccept && reply.status === 'Visible'" type="button" :class="actionClass" @click="toggleAccepted(reply)">
                <CheckCircle2 :size="13" /> {{ reply.isAccepted ? 'Not the answer' : 'Mark as answer' }}
              </button>
              <button v-if="detail.canReply" type="button" :class="actionClass" @click="quote(reply)"><Quote :size="13" /> Quote</button>
              <button v-if="reply.canEdit && editing !== reply.id" type="button" :class="actionClass" @click="startEdit(reply)"><Pencil :size="13" /> Edit</button>
              <button v-if="reply.canDelete && reply.author.id === me" type="button" :class="actionClass" @click="removeReply(reply)"><Trash2 :size="13" /> Delete</button>
              <button v-if="reply.author.id !== me" type="button" :class="actionClass" @click="report('Reply', reply.id)"><Flag :size="13" /> Report</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="detail.canReply" class="flex flex-col gap-3 rounded-(--ra-xl) bg-(--surface) p-5 shadow-(--surface-shadow) max-sm:p-4" aria-label="Write a reply">
        <div v-if="quoting" class="flex items-start justify-between gap-2 border-l-2 border-(--brand-blue) pl-3 text-[13px] text-(--fg-3)">
          <span class="line-clamp-2">Replying to {{ quoting.author.name }}: {{ quoting.body }}</span>
          <button type="button" :class="actionClass" @click="quoting = null">Cancel</button>
        </div>
        <textarea
          id="reply-box"
          v-model="replyBody"
          rows="4"
          maxlength="5000"
          :placeholder="isQuestion ? 'Share what you know' : 'Write a reply'"
          :class="[fieldClass, 'resize-y leading-relaxed']"
          aria-label="Your reply"
        />
        <AttachmentPicker
          v-model="replyAttachments"
          :images-allowed="home?.rules.imagesAllowed ?? false"
          :runs-allowed="detail.space.kind === 'CourseQA' && !!home?.simRunsOn"
          :lesson-id="post.anchorLessonId"
        />
        <div class="flex justify-end">
          <RaButton :disabled="sending || !replyBody.trim()" @click="sendReply">
            <template v-if="sending" #icon><Loader2 :size="16" class="animate-spin" /></template>
            Reply
          </RaButton>
        </div>
      </section>
      <p v-else-if="post.isLocked" class="m-0 inline-flex items-center gap-1.5 text-[13px] text-(--fg-3)"><Lock :size="14" /> This post is locked, so no new replies.</p>
      <p v-else-if="!detail.space.canComment" class="m-0 text-[13px] text-(--fg-3)">Comments are off on this board.</p>

      <ReportDialog
        v-if="reportTarget"
        v-model:open="reportOpen"
        :content-type="reportTarget.type"
        :content-id="reportTarget.id"
        @reported="notice = $event"
      />
    </template>
  </div>
</template>

<style scoped>
.community-body :deep(p) { margin: 0 0 0.75em; }
.community-body :deep(p:last-child) { margin-bottom: 0; }
.community-body :deep(pre) {
  margin: 0 0 0.75em;
  overflow-x: auto;
  border-radius: var(--ra-md);
  background: var(--bg-2);
  padding: 10px 12px;
  font-size: 12.5px;
}
.community-body :deep(code) { font-size: 0.92em; }
.community-body :deep(ul), .community-body :deep(ol) { margin: 0 0 0.75em; padding-left: 1.4em; }
.community-body :deep(blockquote) { margin: 0 0 0.75em; border-left: 2px solid var(--line-2); padding-left: 12px; color: var(--fg-3); }
.community-body :deep(a) { color: var(--link); text-decoration: underline; }
.community-body :deep(h3), .community-body :deep(h4) { margin: 0.5em 0; font-size: 1.05em; }
</style>
