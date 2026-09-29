<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { AlertTriangle, Check, Copy, Loader2, RefreshCw } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import {
  getDigestEnabled,
  getNotificationPreferences,
  setDigestEnabled,
  updateNotificationPreferences,
  type NotificationPreference,
} from '@/api/notifications'
import { getCalendarFeedUrl, rotateCalendarFeedUrl } from '@/api/scheduling'

const preferences = ref<NotificationPreference[]>([])
const status = ref<'loading' | 'idle' | 'error'>('loading')
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
let savedTimer: ReturnType<typeof setTimeout> | undefined

const digest = ref(false)

async function load() {
  status.value = 'loading'
  try {
    ;[preferences.value, digest.value] = await Promise.all([getNotificationPreferences(), getDigestEnabled()])
    status.value = 'idle'
  } catch {
    status.value = 'error'
  }
}
onMounted(load)

// Saves the changed row immediately; reverts it if the request fails.
async function toggle(pref: NotificationPreference, channel: 'inApp' | 'email') {
  pref[channel] = !pref[channel]
  saveState.value = 'saving'
  clearTimeout(savedTimer)
  try {
    await updateNotificationPreferences([{ category: pref.category, inApp: pref.inApp, email: pref.email }])
    saveState.value = 'saved'
    savedTimer = setTimeout(() => (saveState.value = 'idle'), 2000)
  } catch {
    pref[channel] = !pref[channel]
    saveState.value = 'error'
  }
}

// Calendar subscription link (iCal feed for Google/Apple/Outlook).
const feedUrl = ref<string | null>(null)
const feedStatus = ref<'loading' | 'idle' | 'error'>('loading')
const feedBusy = ref(false)
const copied = ref(false)

async function loadFeed() {
  feedStatus.value = 'loading'
  try {
    feedUrl.value = await getCalendarFeedUrl()
    feedStatus.value = 'idle'
  } catch {
    feedStatus.value = 'error'
  }
}
onMounted(loadFeed)

async function rotateFeed() {
  if (feedUrl.value && !confirm('Create a new link? Calendars subscribed to the old one will stop updating.')) return
  feedBusy.value = true
  try {
    feedUrl.value = await rotateCalendarFeedUrl()
    feedStatus.value = 'idle'
  } catch {
    feedStatus.value = 'error'
  } finally {
    feedBusy.value = false
  }
}

async function copyFeed() {
  if (!feedUrl.value) return
  try {
    await navigator.clipboard.writeText(feedUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard blocked (e.g. insecure context) - the field is still selectable.
  }
}

async function toggleDigest() {
  digest.value = !digest.value
  saveState.value = 'saving'
  clearTimeout(savedTimer)
  try {
    await setDigestEnabled(digest.value)
    saveState.value = 'saved'
    savedTimer = setTimeout(() => (saveState.value = 'idle'), 2000)
  } catch {
    digest.value = !digest.value
    saveState.value = 'error'
  }
}

const channels = [
  { key: 'inApp', label: 'In-app' },
  { key: 'email', label: 'Email' },
] as const
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-12 pb-12 max-w-[960px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">Settings</h1>

    <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
      <div class="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 class="m-0 text-[22px] font-medium text-(--heading)">Notifications</h2>
          <p class="m-0 mt-1 text-[13px] text-(--fg-3)">Choose how we tell you about each kind of update. Important account notices are always sent.</p>
        </div>
        <span class="shrink-0 flex items-center gap-1.5 text-[13px] min-h-5" aria-live="polite">
          <template v-if="saveState === 'saving'"><Loader2 :size="14" class="animate-spin text-(--fg-3)" /><span class="text-(--fg-3)">Saving…</span></template>
          <template v-else-if="saveState === 'saved'"><Check :size="14" class="text-(--success)" /><span class="text-(--success)">Saved</span></template>
          <span v-else-if="saveState === 'error'" class="text-(--danger)">Couldn't save — try again</span>
        </span>
      </div>

      <div v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Loading…
      </div>
      <div v-else-if="status === 'error'" class="flex flex-col items-center gap-3 py-12 text-center">
        <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
        <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your notification preferences.</p>
        <RaButton variant="secondary" @click="load">Try again</RaButton>
      </div>
      <div v-else class="flex flex-col">
        <div class="grid grid-cols-[1fr_repeat(2,72px)] gap-4 pb-3 border-b border-(--line-1) text-xs font-semibold text-(--fg-3) max-sm:grid-cols-[1fr_repeat(2,56px)]">
          <span>Category</span>
          <span v-for="c in channels" :key="c.key" class="text-center">{{ c.label }}</span>
        </div>
        <div
          v-for="pref in preferences"
          :key="pref.category"
          class="grid grid-cols-[1fr_repeat(2,72px)] gap-4 items-center py-4 border-b border-(--line-1) last:border-b-0 max-sm:grid-cols-[1fr_repeat(2,56px)]"
        >
          <div class="min-w-0">
            <div class="text-sm font-medium text-(--heading)">{{ pref.label }}</div>
            <div class="text-[13px] text-(--fg-3)">{{ pref.description }}</div>
          </div>
          <div v-for="c in channels" :key="c.key" class="flex justify-center">
            <button
              role="switch"
              :aria-checked="pref[c.key]"
              :aria-label="`${pref.label}: ${c.label}`"
              class="relative w-10 h-6 rounded-(--ra-pill) border-0 p-0 cursor-pointer transition-colors duration-(--dur-1) ease-(--ease-out)"
              :class="pref[c.key] ? 'bg-(--brand-blue)' : 'bg-(--bg-4)'"
              @click="toggle(pref, c.key)"
            >
              <span
                class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-(--dur-1) ease-(--ease-out)"
                :class="pref[c.key] ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>
        </div>
        <div class="grid grid-cols-[1fr_auto] gap-4 items-center pt-5 mt-1 border-t border-(--line-1)">
          <div class="min-w-0">
            <div class="text-sm font-medium text-(--heading)">Daily email digest</div>
            <div class="text-[13px] text-(--fg-3)">One email each morning listing anything you haven't read yet. Skipped on days with nothing new.</div>
          </div>
          <button
            role="switch"
            :aria-checked="digest"
            aria-label="Daily email digest"
            class="relative w-10 h-6 rounded-(--ra-pill) border-0 p-0 cursor-pointer transition-colors duration-(--dur-1) ease-(--ease-out)"
            :class="digest ? 'bg-(--brand-blue)' : 'bg-(--bg-4)'"
            @click="toggleDigest"
          >
            <span
              class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-(--dur-1) ease-(--ease-out)"
              :class="digest ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
        </div>
      </div>
    </section>

    <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
      <h2 class="m-0 text-[22px] font-medium text-(--heading)">Calendar subscription</h2>
      <p class="m-0 mt-1 mb-5 text-[13px] text-(--fg-3)">
        Add your live classes, lab sessions and events to Google Calendar, Apple Calendar or Outlook. Paste this link where they ask to subscribe "from URL". Keep it private — anyone with it can see your schedule.
      </p>

      <div v-if="feedStatus === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
        <Loader2 :size="16" class="animate-spin" /> Loading…
      </div>
      <div v-else-if="feedStatus === 'error'" class="flex items-center gap-3 text-[13px] text-(--danger)">
        Couldn't load your calendar link.
        <RaButton variant="secondary" @click="loadFeed">Try again</RaButton>
      </div>
      <RaButton v-else-if="!feedUrl" :disabled="feedBusy" @click="rotateFeed">Create calendar link</RaButton>
      <div v-else class="flex flex-col gap-3">
        <div class="flex gap-2 max-sm:flex-col">
          <input
            :value="feedUrl"
            readonly
            aria-label="Calendar subscription link"
            class="flex-1 min-w-0 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-4 py-3 text-sm text-(--fg-1) outline-none transition-colors focus:border-(--brand-blue-ring)"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <RaButton variant="secondary" @click="copyFeed">
            <template #icon><Check v-if="copied" :size="16" /><Copy v-else :size="16" /></template>
            {{ copied ? 'Copied' : 'Copy' }}
          </RaButton>
        </div>
        <RaButton variant="ghost" class="self-start" :disabled="feedBusy" @click="rotateFeed">
          <template #icon><RefreshCw :size="16" /></template>
          Create a new link
        </RaButton>
      </div>
    </section>
  </div>
</template>
