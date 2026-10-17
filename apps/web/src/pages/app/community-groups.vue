<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, Loader2, Plus, UsersRound, X } from 'lucide-vue-next'
import { RaButton, RaChip } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import {
  createGroup, getGroupsHome, joinGroup, GROUP_STATUS_LABELS, type GroupsHome, type StudyGroup,
} from '@/api/community-chat'
import { brandingKey, featureConfirmed } from '@/branding'
import { getMyEnrolledCourses, type EnrolledCourseSummary } from '@/api/learning'

// Study groups: the learner's groups, open groups in their classes they can join, and starting a
// new one - straight away in Open classes, after a teacher approves it in Standard ones.

const router = useRouter()
const branding = inject(brandingKey, null)
const available = computed(() => featureConfirmed(branding?.value, 'community_study_groups'))

const home = ref<GroupsHome | null>(null)
const status = ref<'loading' | 'idle' | 'error' | 'off'>('loading')
const notice = ref('')
const error = ref('')

async function load() {
  if (!available.value) return
  status.value = 'loading'
  try {
    home.value = await getGroupsHome()
    status.value = 'idle'
  } catch (e) {
    status.value = e instanceof ApiError && e.status === 403 ? 'off' : 'error'
  }
}
watch(available, load, { immediate: true })

async function join(group: StudyGroup) {
  error.value = ''
  try {
    await joinGroup(group.id)
    router.push(`/app/community/groups/${group.id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't join the group."
  }
}

// ── Start a group ─────────────────────────────────────────────────────────────
const creating = ref(false)
const saving = ref(false)
const form = ref({ classId: '', name: '', description: '', courseId: '', goal: '', targetDate: '' })
// A group can work through one of the learner's courses; its members' progress is then shown.
const courses = ref<EnrolledCourseSummary[]>([])

function openCreate() {
  form.value = { classId: home.value?.classes[0]?.id ?? '', name: '', description: '', courseId: '', goal: '', targetDate: '' }
  error.value = ''
  creating.value = true
  if (courses.value.length === 0) {
    getMyEnrolledCourses().then((list) => { courses.value = list }).catch(() => {})
  }
}

async function create() {
  if (!form.value.classId || !form.value.name.trim()) return
  saving.value = true
  error.value = ''
  try {
    const group = await createGroup(form.value.classId, {
      name: form.value.name.trim(),
      description: form.value.description.trim() || null,
      courseId: form.value.courseId || null,
      goal: form.value.goal.trim() || null,
      targetDate: form.value.targetDate || null,
    })
    creating.value = false
    if (group.status === 'Active') {
      router.push(`/app/community/groups/${group.id}`)
    } else {
      notice.value = 'Sent to your teacher. You can find it under "Waiting" until they approve it.'
      await load()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't start the group."
  } finally {
    saving.value = false
  }
}

const creationHint = computed(() => {
  switch (home.value?.creation) {
    case 'Approval': return 'Your teacher approves new groups before they open.'
    case 'StaffOnly': return 'In your class, teachers set up study groups.'
    default: return null
  }
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-12 pt-12 pb-12 max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <button
      class="self-start inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-[13px] font-medium text-(--fg-3) hover:text-(--fg-1)"
      @click="router.push('/app/community')"
    >
      <ArrowLeft :size="16" /> Community
    </button>

    <header class="flex flex-wrap items-end justify-between gap-3">
      <div class="flex flex-col gap-1">
        <h1 class="m-0 text-[28px] font-semibold tracking-[-0.01em] text-(--heading) max-sm:text-2xl">Study groups</h1>
        <p class="m-0 text-sm text-(--fg-3)">Work through a course together, with a board and a chat of your own.</p>
      </div>
      <RaButton v-if="home?.canCreate" @click="openCreate">
        <template #icon><Plus :size="16" /></template>
        Start a group
      </RaButton>
    </header>

    <p v-if="!available" class="m-0 py-16 text-center text-[13px] text-(--fg-3)">Study groups aren't available at your school.</p>
    <div v-else-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <div v-else-if="status !== 'idle' || !home" class="flex flex-col items-center gap-3 py-16 text-center">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-(--danger-soft) text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">
        {{ status === 'off' ? "Study groups are switched off at your school." : "Couldn't load study groups." }}
      </p>
      <RaButton v-if="status === 'error'" variant="secondary" @click="load">Try again</RaButton>
    </div>

    <template v-else>
      <p v-if="notice" class="m-0 rounded-(--ra-md) bg-(--brand-blue-soft) px-4 py-3 text-[13px] text-(--fg-1)">{{ notice }}</p>
      <p v-if="error && !creating" class="m-0 text-[13px] text-(--danger)">{{ error }}</p>
      <p v-if="creationHint" class="m-0 text-[13px] text-(--fg-3)">{{ creationHint }}</p>

      <section class="flex flex-col gap-3">
        <h2 class="m-0 text-base font-semibold text-(--heading)">Your groups</h2>
        <p v-if="home.mine.length === 0" class="m-0 text-[13px] text-(--fg-3)">You're not in a group yet.</p>
        <button
          v-for="group in home.mine"
          :key="group.id"
          type="button"
          class="flex items-center gap-3 rounded-(--ra-lg) border border-(--line-2) bg-(--bg-1) px-4 py-3 text-left cursor-pointer hover:border-(--brand-blue)"
          @click="router.push(`/app/community/groups/${group.id}`)"
        >
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--brand-blue-soft) text-(--brand-blue)"><UsersRound :size="18" /></span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-semibold text-(--fg-1)">{{ group.name }}</span>
            <span class="truncate text-[13px] text-(--fg-3)">
              {{ group.class.name }} · {{ group.memberCount }} {{ group.memberCount === 1 ? 'member' : 'members' }}
              <template v-if="group.courseTitle"> · {{ group.courseTitle }}</template>
            </span>
          </span>
          <RaChip v-if="group.status !== 'Active'" tone="neutral">{{ GROUP_STATUS_LABELS[group.status] }}</RaChip>
        </button>
      </section>

      <section v-if="home.joinable.length > 0" class="flex flex-col gap-3">
        <h2 class="m-0 text-base font-semibold text-(--heading)">Groups in your classes</h2>
        <div
          v-for="group in home.joinable"
          :key="group.id"
          class="flex items-center gap-3 rounded-(--ra-lg) border border-(--line-2) bg-(--bg-1) px-4 py-3"
        >
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-semibold text-(--fg-1)">{{ group.name }}</span>
            <span class="truncate text-[13px] text-(--fg-3)">
              {{ group.class.name }} · {{ group.memberCount }} {{ group.memberCount === 1 ? 'member' : 'members' }}
              <template v-if="group.goal"> · {{ group.goal }}</template>
            </span>
          </span>
          <RaButton variant="secondary" @click="router.push(`/app/community/groups/${group.id}`)">View</RaButton>
          <RaButton v-if="group.canJoin" @click="join(group)">Join</RaButton>
        </div>
      </section>

      <section v-if="home.pending.length > 0" class="flex flex-col gap-3">
        <h2 class="m-0 text-base font-semibold text-(--heading)">Waiting</h2>
        <div
          v-for="group in home.pending"
          :key="group.id"
          class="flex flex-col gap-1 rounded-(--ra-lg) border border-(--line-2) bg-(--bg-1) px-4 py-3"
        >
          <div class="flex items-center gap-2">
            <span class="flex-1 truncate text-sm font-semibold text-(--fg-1)">{{ group.name }}</span>
            <RaChip tone="neutral">{{ GROUP_STATUS_LABELS[group.status] }}</RaChip>
          </div>
          <span class="text-[13px] text-(--fg-3)">{{ group.class.name }}</span>
          <span v-if="group.decisionReason" class="text-[13px] text-(--fg-2)">Your teacher said: {{ group.decisionReason }}</span>
        </div>
      </section>
    </template>

    <div v-if="creating" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="creating = false">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-group-title"
        class="flex w-full max-w-[460px] flex-col gap-4 rounded-(--ra-xl) bg-(--bg-0) p-6 shadow-xl"
        @submit.prevent="create"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 id="new-group-title" class="m-0 text-lg font-semibold text-(--heading)">Start a study group</h2>
            <p v-if="creationHint" class="m-0 mt-1 text-[13px] text-(--fg-3)">{{ creationHint }}</p>
          </div>
          <button type="button" class="border-0 bg-transparent p-1 text-(--fg-3) hover:text-(--fg-1) cursor-pointer" aria-label="Close" @click="creating = false">
            <X :size="18" />
          </button>
        </div>

        <label class="flex flex-col gap-1.5 text-[13px] font-semibold text-(--fg-2)">
          Class
          <select v-model="form.classId" required class="rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm font-normal text-(--fg-1)">
            <option v-for="c in home?.classes ?? []" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-[13px] font-semibold text-(--fg-2)">
          Name
          <input v-model="form.name" required maxlength="60" class="rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm font-normal text-(--fg-1) outline-none focus:border-(--brand-blue)" />
        </label>
        <label class="flex flex-col gap-1.5 text-[13px] font-semibold text-(--fg-2)">
          What's the group for? <span class="font-normal text-(--fg-3)">(optional)</span>
          <textarea v-model="form.description" rows="2" maxlength="500" class="resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm font-normal text-(--fg-1) outline-none focus:border-(--brand-blue)" />
        </label>
        <label v-if="courses.length > 0" class="flex flex-col gap-1.5 text-[13px] font-semibold text-(--fg-2)">
          Course to work through <span class="font-normal text-(--fg-3)">(optional)</span>
          <select v-model="form.courseId" class="rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm font-normal text-(--fg-1)">
            <option value="">None</option>
            <option v-for="c in courses" :key="c.courseId" :value="c.courseId">{{ c.title }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-[13px] font-semibold text-(--fg-2)">
          Goal <span class="font-normal text-(--fg-3)">(optional)</span>
          <input v-model="form.goal" maxlength="200" placeholder="e.g. Finish the maze module" class="rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm font-normal text-(--fg-1) outline-none focus:border-(--brand-blue)" />
        </label>
        <label class="flex flex-col gap-1.5 text-[13px] font-semibold text-(--fg-2)">
          Target date <span class="font-normal text-(--fg-3)">(optional)</span>
          <input v-model="form.targetDate" type="date" class="rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm font-normal text-(--fg-1)" />
        </label>

        <p v-if="error" class="m-0 text-[13px] text-(--danger)">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <RaButton type="button" variant="ghost" @click="creating = false">Cancel</RaButton>
          <RaButton :disabled="saving || !form.name.trim() || !form.classId">
            <template v-if="saving" #icon><Loader2 :size="16" class="animate-spin" /></template>
            {{ home?.creation === 'Approval' ? 'Ask to start' : 'Start group' }}
          </RaButton>
        </div>
      </form>
    </div>
  </div>
</template>
