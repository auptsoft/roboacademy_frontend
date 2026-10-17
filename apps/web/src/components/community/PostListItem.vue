<script setup lang="ts">
import { CheckCircle2, Lock, MessageSquare, Paperclip, Pin } from 'lucide-vue-next'
import { RaChip } from '@roboacademy/ui'
import { statusLabel, type PostSummary } from '@/api/community'
import { formatNotificationTime } from '@/composables/useNotifications'

defineProps<{ post: PostSummary }>()
</script>

<template>
  <RouterLink
    :to="`/app/community/posts/${post.id}`"
    class="flex flex-col gap-1.5 rounded-(--ra-lg) border border-(--line-1) bg-(--surface) px-4 py-3.5 no-underline transition-colors hover:border-(--brand-blue)"
  >
    <div class="flex flex-wrap items-center gap-2 text-xs text-(--fg-3)">
      <Pin v-if="post.isPinned" :size="13" class="text-(--brand-blue)" aria-label="Pinned" />
      <RaChip v-if="post.kind === 'Announcement'" tone="info">Announcement</RaChip>
      <RaChip v-else-if="post.kind === 'Question'" :tone="post.isAnswered ? 'student' : 'neutral'">
        {{ post.isAnswered ? 'Answered' : 'Question' }}
      </RaChip>
      <span class="font-semibold text-(--fg-2)">{{ post.author.name }}</span>
      <RaChip v-if="post.author.isStaff" tone="instructor">Staff</RaChip>
      <span>{{ formatNotificationTime(post.createdAt) }}</span>
      <span v-if="post.audienceClass" class="text-(--fg-3)">· {{ post.audienceClass.name }} only</span>
      <Lock v-if="post.isLocked" :size="12" aria-label="Locked" />
    </div>

    <p v-if="post.isDeleted" class="m-0 text-sm italic text-(--fg-3)">Deleted by its author</p>
    <template v-else>
      <h3 class="m-0 text-[15px] font-semibold text-(--fg-1)">{{ post.title }}</h3>
      <p class="m-0 text-[13px] leading-relaxed text-(--fg-2) line-clamp-2">{{ post.excerpt }}</p>
    </template>

    <p v-if="statusLabel(post.status)" class="m-0 text-xs font-semibold text-(--warning)">{{ statusLabel(post.status) }}</p>

    <div class="flex items-center gap-4 text-xs text-(--fg-3)">
      <span class="inline-flex items-center gap-1"><MessageSquare :size="13" /> {{ post.replyCount }}</span>
      <span v-if="post.hasStaffReply" class="inline-flex items-center gap-1 text-(--success)"><CheckCircle2 :size="13" /> Teacher replied</span>
      <span v-if="post.reactions.counts.SameQuestion" class="inline-flex items-center gap-1">{{ post.reactions.counts.SameQuestion }} have this question too</span>
      <span v-if="post.attachmentCount" class="inline-flex items-center gap-1"><Paperclip :size="13" /> {{ post.attachmentCount }}</span>
    </div>
  </RouterLink>
</template>
