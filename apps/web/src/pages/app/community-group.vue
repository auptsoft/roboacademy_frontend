<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, Crown, Loader2, MessageCircle, Target, UserMinus, UserPlus } from 'lucide-vue-next'
import { RaButton, RaChip, RaProgress } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import { getCommunityHome, getGroupBoard, type CommunityHome, type Space } from '@/api/community'
import {
  addGroupMember, archiveGroup, getGroup, joinGroup, leaveGroup, listGroupCandidates, removeGroupMember,
  GROUP_STATUS_LABELS, type Contact, type GroupMember, type StudyGroupDetail,
} from '@/api/community-chat'
import { getCurrentUser } from '@/store/auth'
import SpaceFeed from '@/components/community/SpaceFeed.vue'

// One study group: its goal and members' progress on its course, its board, and a way into its chat.

const route = useRoute()
const router = useRouter()
const me = computed(() => getCurrentUser()?.userId ?? null)

const detail = ref<StudyGroupDetail | null>(null)
const board = ref<Space | null>(null)
const home = ref<CommunityHome | null>(null)
const status = ref<'loading' | 'idle' | 'error' | 'not-found'>('loading')
const error = ref('')
const busy = ref(false)

const group = computed(() => detail.value?.group ?? null)
const groupId = computed(() => String(route.params.id))

async function load() {
  status.value = 'loading'
  try {
    detail.value = await getGroup(groupId.value)
    home.value ??= await getCommunityHome()
    board.value = detail.value.spaceId ? await getGroupBoard(groupId.value) : null
    status.value = 'idle'
  } catch (e) {
    status.value = e instanceof ApiError && (e.status === 404 || e.status === 403) ? 'not-found' : 'error'
  }
}
watch(groupId, load, { immediate: true })

async function act(action: () => Promise<unknown>, after?: () => void) {
  busy.value = true
  error.value = ''
  try {
    await action()
    if (after) after()
    else await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong.'
  } finally {
    busy.value = false
  }
}

function progressOf(member: GroupMember): number | null {
  return member.totalLessons ? Math.round((100 * (member.completedLessons ?? 0)) / member.totalLessons) : null
}

function canRemove(member: GroupMember): boolean {
  if (!group.value?.canManage || member.userId === me.value) return false
  // Leaders can remove members; only staff can remove another leader.
  return home.value?.isStaff === true || member.role === 'Member'
}

function remove(member: GroupMember) {
  if (window.confirm(`Remove ${member.name} from the group?`)) {
    void act(() => removeGroupMember(groupId.value, member.userId))
  }
}

function leave() {
  if (window.confirm('Leave this group?')) {
    void act(() => leaveGroup(groupId.value), () => router.push('/app/community/groups'))
  }
}

// ── Add people ───────────────────────────────────────────────────────────────
const adding = ref(false)
const search = ref('')
const candidates = ref<Contact[]>([])
const candidatesLoading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

async function findCandidates() {
  candidatesLoading.value = true
  try {
    candidates.value = await listGroupCandidates(groupId.value, search.value.trim())
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't load classmates."
  } finally {
    candidatesLoading.value = false
  }
}

function toggleAdding() {
  adding.value = !adding.value
  if (adding.value) {
    search.value = ''
    void findCandidates()
  }
}

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void findCandidates(), 250)
})

async function addPerson(contact: Contact) {
  busy.value = true
  error.value = ''
  try {
    await addGroupMember(groupId.value, contact.id)
    candidates.value = candidates.value.filter((c) => c.id !== contact.id)
    detail.value = await getGroup(groupId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't add them."
  } finally {
    busy.value = false
  }
}

function archive() {
  if (window.confirm('Close this group? It becomes read-only for everyone.')) {
    void act(() => archiveGroup(groupId.value))
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-12 pt-12 pb-12 max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <button
      class="self-start inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-[13px] font-medium text-(--fg-3) hover:text-(--fg-1)"
      @click="router.push('/app/community/groups')"
    >
      <ArrowLeft :size="16" /> Study groups
    </button>

    <div v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <div v-else-if="status !== 'idle' || !detail || !group" class="flex flex-col items-center gap-3 py-16 text-center">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-(--danger-soft) text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">{{ status === 'not-found' ? "This group isn't open to you." : "Couldn't load the group." }}</p>
      <RaButton v-if="status === 'error'" variant="secondary" @click="load">Try again</RaButton>
    </div>

    <template v-else>
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="m-0 text-[28px] font-semibold tracking-[-0.01em] text-(--heading) max-sm:text-2xl">{{ group.name }}</h1>
            <RaChip v-if="group.status !== 'Active'" tone="neutral">{{ GROUP_STATUS_LABELS[group.status] }}</RaChip>
          </div>
          <p class="m-0 text-sm text-(--fg-3)">
            {{ group.class.name }} · {{ group.memberCount }} {{ group.memberCount === 1 ? 'member' : 'members' }}
            <template v-if="detail.maxMembers"> of {{ detail.maxMembers }}</template>
          </p>
          <p v-if="group.description" class="m-0 mt-2 text-sm text-(--fg-2) whitespace-pre-wrap">{{ group.description }}</p>
          <p v-if="group.decisionReason" class="m-0 mt-2 text-[13px] text-(--fg-2)">Your teacher said: {{ group.decisionReason }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <RaButton v-if="detail.channelId" variant="secondary" @click="router.push(`/app/community/chat/${detail.channelId}`)">
            <template #icon><MessageCircle :size="16" /></template>
            Group chat
          </RaButton>
          <RaButton v-if="group.canManage" variant="secondary" @click="toggleAdding">
            <template #icon><UserPlus :size="16" /></template>
            Add people
          </RaButton>
          <RaButton v-if="group.canJoin" :disabled="busy" @click="act(() => joinGroup(group!.id))">Join</RaButton>
          <RaButton v-if="detail.canLeave && group.status === 'Active'" variant="ghost" :disabled="busy" @click="leave">Leave</RaButton>
          <RaButton v-if="group.canManage" variant="ghost" :disabled="busy" @click="archive">Close group</RaButton>
        </div>
      </header>

      <p v-if="error" class="m-0 text-[13px] text-(--danger)">{{ error }}</p>

      <section v-if="group.goal || group.courseTitle || group.targetDate" class="flex flex-col gap-3 rounded-(--ra-lg) border border-(--line-2) bg-(--bg-1) p-4">
        <div class="flex items-center gap-2 text-sm font-semibold text-(--fg-1)">
          <Target :size="16" class="text-(--brand-blue)" /> {{ group.goal ?? 'Goal' }}
        </div>
        <p class="m-0 text-[13px] text-(--fg-3)">
          <template v-if="group.courseTitle">Working through {{ group.courseTitle }}</template>
          <template v-if="group.courseTitle && group.targetDate"> · </template>
          <template v-if="group.targetDate">by {{ new Date(group.targetDate).toLocaleDateString() }}</template>
        </p>
        <div v-if="detail.averageProgress !== null" class="flex items-center gap-3">
          <div class="flex-1"><RaProgress :value="detail.averageProgress" tone="green" /></div>
          <span class="text-[13px] font-semibold text-(--fg-2)">{{ detail.averageProgress }}% as a group</span>
        </div>
      </section>

      <section v-if="adding && group.canManage" class="flex flex-col gap-2 rounded-(--ra-lg) border border-(--line-2) bg-(--bg-1) p-4">
        <h2 class="m-0 text-base font-semibold text-(--heading)">Add people from {{ group.class.name }}</h2>
        <input
          v-model="search"
          type="search"
          placeholder="Search by name"
          aria-label="Search classmates"
          class="rounded-(--ra-md) border border-(--line-2) bg-(--bg-0) px-3 py-2 text-sm text-(--fg-1) outline-none focus:border-(--brand-blue)"
        />
        <div v-if="candidatesLoading" class="flex items-center gap-2 py-2 text-[13px] text-(--fg-3)">
          <Loader2 :size="14" class="animate-spin" /> Loading…
        </div>
        <p v-else-if="candidates.length === 0" class="m-0 py-2 text-[13px] text-(--fg-3)">No one left to add.</p>
        <div v-for="candidate in candidatesLoading ? [] : candidates" :key="candidate.id" class="flex items-center gap-3 px-1 py-1">
          <span class="flex-1 truncate text-sm text-(--fg-1)">{{ candidate.name }}</span>
          <RaButton variant="secondary" :disabled="busy" @click="addPerson(candidate)">Add</RaButton>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="m-0 text-base font-semibold text-(--heading)">Members</h2>
        <p v-if="detail.members.length === 0" class="m-0 text-[13px] text-(--fg-3)">No one has joined yet.</p>
        <div
          v-for="member in detail.members"
          :key="member.userId"
          class="flex items-center gap-3 rounded-(--ra-md) px-3 py-2 hover:bg-(--bg-1)"
        >
          <span class="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-(--fg-1)">
            <span class="truncate">{{ member.name }}</span>
            <Crown v-if="member.role === 'Leader'" :size="14" class="text-(--brand-sand-fg)" aria-label="Leader" />
          </span>
          <div v-if="progressOf(member) !== null" class="flex w-48 items-center gap-2 max-sm:w-28">
            <div class="flex-1"><RaProgress :value="progressOf(member)!" /></div>
            <span class="w-9 text-right text-[12px] text-(--fg-3)">{{ progressOf(member) }}%</span>
          </div>
          <button
            v-if="canRemove(member)"
            type="button"
            class="border-0 bg-transparent p-1 text-(--fg-3) hover:text-(--danger) cursor-pointer"
            :aria-label="`Remove ${member.name}`"
            @click="remove(member)"
          >
            <UserMinus :size="16" />
          </button>
        </div>
      </section>

      <section v-if="board && home" class="flex flex-col gap-3">
        <h2 class="m-0 text-base font-semibold text-(--heading)">Board</h2>
        <SpaceFeed :key="board.id" :space="board" :home="home" open-after-post />
      </section>
      <p v-else-if="group.status === 'Active' && !group.isMember" class="m-0 text-[13px] text-(--fg-3)">
        Join the group to see its board and chat.
      </p>
    </template>
  </div>
</template>
