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
import { decideStudyGroup, listStudyGroups, type GroupStatus, type StudyGroup } from '@/api/community'

// Study groups in the classes the caller teaches (school admins: every class). Learners in Standard
// classes ask to start a group and it waits here; staff can also close any open group.

const tabs: { id: GroupStatus; label: string }[] = [
  { id: 'PendingApproval', label: 'Waiting for approval' },
  { id: 'Active', label: 'Open' },
  { id: 'Archived', label: 'Closed' },
  { id: 'Rejected', label: 'Turned down' },
]
const status = ref<GroupStatus>('PendingApproval')
const groups = ref<StudyGroup[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    groups.value = await listStudyGroups(status.value)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load study groups.')
  } finally {
    loading.value = false
  }
}
watch(status, load)
onMounted(load)

async function decide(group: StudyGroup, decision: 'approve' | 'reject' | 'archive', reason: string | null = null) {
  busy.value = group.id
  try {
    await decideStudyGroup(group.id, decision, reason)
    toast.success(decision === 'approve' ? 'Approved: the group is open.' : decision === 'reject' ? 'Turned down.' : 'Group closed.')
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : "That didn't work.")
  } finally {
    busy.value = null
  }
}

// Turning a group down: the learner sees the reason.
const rejecting = ref<StudyGroup | null>(null)
const reason = ref('')
function askReject(group: StudyGroup) {
  rejecting.value = group
  reason.value = ''
}
async function confirmReject() {
  if (!rejecting.value) return
  const group = rejecting.value
  rejecting.value = null
  await decide(group, 'reject', reason.value.trim() || null)
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Study groups</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">Approve learners' groups, and close groups that have run their course.</p>
    </div>

    <div class="flex flex-wrap gap-2" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="status === tab.id"
        class="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold cursor-pointer"
        :class="status === tab.id ? 'border-(--brand-blue) bg-(--brand-blue-soft) text-(--brand-blue)' : 'border-(--line-2) bg-transparent text-(--fg-2)'"
        @click="status = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <p v-if="loading" class="flex items-center gap-2 text-[13px] text-(--fg-3)"><Loader2 :size="16" class="animate-spin" /> Loading…</p>
    <p v-else-if="groups.length === 0" class="py-12 text-center text-sm text-(--fg-3)">No study groups here.</p>

    <div v-else class="flex flex-col gap-3">
      <RaCard v-for="group in groups" :key="group.id" :padding="20" class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="m-0 text-base font-semibold text-(--fg-1)">{{ group.name }}</h2>
          <RaChip tone="neutral">{{ group.class.name }}</RaChip>
          <span class="text-xs text-(--fg-3)">
            Started by {{ group.createdBy.name }} · {{ new Date(group.createdAt).toLocaleDateString() }} ·
            {{ group.memberCount }} {{ group.memberCount === 1 ? 'member' : 'members' }}
          </span>
        </div>
        <p v-if="group.description" class="m-0 whitespace-pre-wrap text-sm text-(--fg-2)">{{ group.description }}</p>
        <p v-if="group.goal || group.courseTitle" class="m-0 text-xs text-(--fg-3)">
          <template v-if="group.goal">Goal: {{ group.goal }}</template>
          <template v-if="group.goal && group.courseTitle"> · </template>
          <template v-if="group.courseTitle">Course: {{ group.courseTitle }}</template>
        </p>
        <p v-if="group.decisionReason" class="m-0 text-xs text-(--fg-3)">Reason given: {{ group.decisionReason }}</p>
        <div class="flex gap-2">
          <template v-if="group.status === 'PendingApproval'">
            <Button size="sm" :disabled="busy === group.id" @click="decide(group, 'approve')">Approve</Button>
            <Button size="sm" variant="outline" :disabled="busy === group.id" @click="askReject(group)">Turn down</Button>
          </template>
          <Button v-if="group.status === 'Active'" size="sm" variant="outline" :disabled="busy === group.id" @click="decide(group, 'archive')">
            Close group
          </Button>
        </div>
      </RaCard>
    </div>

    <Dialog :open="!!rejecting" @update:open="(open: boolean) => { if (!open) rejecting = null }">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turn down "{{ rejecting?.name }}"</DialogTitle>
          <DialogDescription>The learner who asked is told, with your reason if you give one.</DialogDescription>
        </DialogHeader>
        <Label for="reject-reason">Reason (optional)</Label>
        <textarea id="reject-reason" v-model="reason" rows="3" maxlength="500" class="resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-3 py-2 text-sm text-(--fg-1) outline-none" />
        <DialogFooter>
          <Button variant="outline" @click="rejecting = null">Cancel</Button>
          <Button @click="confirmReject">Turn down</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
