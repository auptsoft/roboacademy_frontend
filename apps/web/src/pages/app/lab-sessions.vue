<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, Bot, Loader2 } from 'lucide-vue-next'
import { RaButton, RaChip, formatDate } from '@roboacademy/ui'
import { listLabSessions, listMyLabSessions, type LabSession } from '@/api/robotics-lab'
import FolderTabs from '@/components/layout/FolderTabs.vue'

/** Robot lab sessions: ones the learner can ask for, and ones they've been given. */
type Tab = 'available' | 'mine'

const router = useRouter()
const tab = ref<Tab>('available')
const tabs: { id: Tab; label: string }[] = [
  { id: 'available', label: 'Available' },
  { id: 'mine', label: 'My sessions' },
]

const sessions = ref<LabSession[]>([])
const status = ref<'loading' | 'idle' | 'error'>('loading')

async function load() {
  status.value = 'loading'
  try {
    sessions.value = tab.value === 'available' ? await listLabSessions() : await listMyLabSessions()
    status.value = 'idle'
  } catch {
    status.value = 'error'
  }
}

watch(tab, load, { immediate: true })

function when(s: LabSession): string {
  const start = new Date(s.startsAt)
  const end = new Date(s.endsAt)
  const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${formatDate(s.startsAt)} · ${time(start)}–${time(end)}`
}

function badge(s: LabSession): { text: string; tone: 'info' | 'neutral' | 'student' } | null {
  if (s.assignedToMe) {
    if (s.status === 'Ended') return { text: s.attended ? 'Attended' : 'Missed', tone: 'neutral' }
    return { text: "You're booked", tone: 'student' }
  }
  switch (s.myRequestStatus) {
    case 'Pending':
      return { text: 'Requested', tone: 'info' }
    case 'Waitlisted':
      return { text: 'Waitlisted', tone: 'neutral' }
    case 'Declined':
      return { text: 'Not approved', tone: 'neutral' }
    default:
      return null
  }
}

const emptyText = computed(() =>
  tab.value === 'available'
    ? 'No robot lab sessions are open right now. Check back soon.'
    : "You haven't been given any robot lab sessions yet.")
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-12 pb-12 max-w-[960px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">Robot lab</h1>
      <p class="mt-1.5 mb-0 text-sm text-(--fg-3)">Time on real robots. Ask for a session; staff choose who gets each one.</p>
    </div>

    <div>
      <FolderTabs v-model="tab" :tabs="tabs" />
      <section class="bg-(--surface) rounded-(--ra-xl) rounded-tl-none shadow-(--surface-shadow) overflow-hidden">
        <div v-if="status === 'loading'" class="flex items-center gap-2 p-6 text-[13px] text-(--fg-3)">
          <Loader2 :size="16" class="animate-spin" /> Loading…
        </div>
        <div v-else-if="status === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
          <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
          <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load robot lab sessions.</p>
          <RaButton variant="secondary" @click="load()">Try again</RaButton>
        </div>
        <div v-else-if="!sessions.length" class="flex flex-col items-center gap-3 py-16 text-center">
          <div class="w-10 h-10 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-3)"><Bot :size="18" /></div>
          <p class="m-0 text-[13px] text-(--fg-3)">{{ emptyText }}</p>
        </div>
        <button
          v-for="(s, i) in sessions"
          v-else
          :key="s.id"
          class="flex w-full items-center gap-4 border-0 bg-transparent px-6 py-4 text-left cursor-pointer hover:bg-(--bg-3)"
          :class="i < sessions.length - 1 && 'border-b border-(--line-1)'"
          @click="router.push(`/app/lab-sessions/${s.id}`)"
        >
          <div class="w-10 h-10 shrink-0 rounded-(--ra-md) bg-(--bg-3) flex items-center justify-center text-(--fg-2)"><Bot :size="18" /></div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-(--fg-1)">{{ s.title }}</div>
            <div class="truncate text-xs text-(--fg-3)">{{ when(s) }} · {{ s.templateName }}</div>
          </div>
          <RaChip v-if="badge(s)" :tone="badge(s)!.tone">{{ badge(s)!.text }}</RaChip>
        </button>
      </section>
    </div>
  </div>
</template>
