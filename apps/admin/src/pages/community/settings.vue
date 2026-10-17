<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard } from '@roboacademy/ui'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Label from '@/components/ui/label.vue'
import { ApiError } from '@/api/client'
import {
  getCommunitySettings, PRESET_LABELS, saveCommunitySettings,
  type CommunitySettings, type SafetyPreset,
} from '@/api/community'

// A school's community settings (Community design §4.3 and §6): which parts are on, within what
// the plan includes; the safety level classes start from; and the school's own blocked words.
// Each class can be made stricter from its Community tab.

const settings = ref<CommunitySettings | null>(null)
const form = reactive({
  boardEnabled: true, boardCommentsEnabled: true, qaEnabled: true, qaSimAttachmentsEnabled: true,
  defaultPreset: 'Standard' as SafetyPreset, blockedTerms: '',
  studyGroupsEnabled: true, chatEnabled: true, directMessagesEnabled: true, studentMessagesEnabled: false,
})
const loading = ref(true)
const saving = ref(false)

function fill(value: CommunitySettings) {
  settings.value = value
  Object.assign(form, {
    boardEnabled: value.boardEnabled, boardCommentsEnabled: value.boardCommentsEnabled, qaEnabled: value.qaEnabled,
    qaSimAttachmentsEnabled: value.qaSimAttachmentsEnabled, defaultPreset: value.defaultPreset,
    blockedTerms: value.blockedTerms.join('\n'),
    studyGroupsEnabled: value.studyGroupsEnabled, chatEnabled: value.chatEnabled,
    directMessagesEnabled: value.directMessagesEnabled, studentMessagesEnabled: value.studentMessagesEnabled,
  })
}

async function load() {
  loading.value = true
  try {
    fill(await getCommunitySettings())
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load community settings.')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    fill(await saveCommunitySettings({
      boardEnabled: form.boardEnabled,
      boardCommentsEnabled: form.boardCommentsEnabled,
      qaEnabled: form.qaEnabled,
      qaSimAttachmentsEnabled: form.qaSimAttachmentsEnabled,
      defaultPreset: form.defaultPreset,
      blockedTerms: form.blockedTerms.split('\n').map((t) => t.trim()).filter(Boolean),
      studyGroupsEnabled: form.studyGroupsEnabled,
      chatEnabled: form.chatEnabled,
      directMessagesEnabled: form.directMessagesEnabled,
      studentMessagesEnabled: form.studentMessagesEnabled,
    }))
    toast.success('Settings saved.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to save settings.')
  } finally {
    saving.value = false
  }
}

const groupsAndChatIncluded = computed(() =>
  !!settings.value && (settings.value.studyGroupsIncluded || settings.value.chatIncluded || settings.value.directMessagesIncluded))

const limitsText = computed(() => {
  const s = settings.value
  if (!s) return ''
  const parts = [
    s.maxStudyGroups != null ? `up to ${s.maxStudyGroups} study groups` : null,
    s.maxGroupMembers != null ? `${s.maxGroupMembers} members each` : null,
    s.chatHistoryDays != null ? `${s.chatHistoryDays} days of chat history` : null,
  ].filter(Boolean)
  return parts.length ? `Your plan allows ${parts.join(', ')}.` : ''
})

const storageText = computed(() => {
  const s = settings.value
  if (!s) return ''
  return s.storageLimitMb == null ? `${s.storageUsedMb} MB of images stored.` : `${s.storageUsedMb} of ${s.storageLimitMb} MB of images used.`
})

onMounted(load)

const presets: SafetyPreset[] = ['Open', 'Standard', 'Restricted']
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Community settings</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">Boards, course questions, study groups and chat, and how safe each class's space is.</p>
    </div>

    <p v-if="loading" class="flex items-center gap-2 text-[13px] text-(--fg-3)"><Loader2 :size="16" class="animate-spin" /> Loading…</p>

    <form v-else-if="settings" class="flex flex-col gap-5" @submit.prevent="save">
      <RaCard :padding="24" class="flex flex-col gap-4">
        <h2 class="m-0 text-lg font-bold text-(--fg-1)">What's on</h2>
        <label class="flex items-start gap-3 text-sm text-(--fg-1)">
          <input v-model="form.boardEnabled" type="checkbox" class="mt-1" :disabled="!settings.boardIncluded" />
          <span>School and class boards
            <span class="block text-xs text-(--fg-3)">
              {{ settings.boardIncluded ? 'Staff post news; learners read it. Announcements also appear here, pinned.' : "Not included in your school's plan." }}
            </span>
          </span>
        </label>
        <label class="ml-7 flex items-start gap-3 text-sm text-(--fg-1)">
          <input v-model="form.boardCommentsEnabled" type="checkbox" class="mt-1" :disabled="!settings.commentsIncluded || !form.boardEnabled" />
          <span>Learners can comment on board posts
            <span v-if="!settings.commentsIncluded" class="block text-xs text-(--fg-3)">Not included in your school's plan.</span>
          </span>
        </label>
        <label class="flex items-start gap-3 text-sm text-(--fg-1)">
          <input v-model="form.qaEnabled" type="checkbox" class="mt-1" :disabled="!settings.qaIncluded" />
          <span>Course questions
            <span class="block text-xs text-(--fg-3)">
              {{ settings.qaIncluded ? 'Learners ask about lessons and lab challenges, and help each other.' : "Not included in your school's plan." }}
            </span>
          </span>
        </label>
        <label class="ml-7 flex items-start gap-3 text-sm text-(--fg-1)">
          <input v-model="form.qaSimAttachmentsEnabled" type="checkbox" class="mt-1" :disabled="!settings.simRunsIncluded || !form.qaEnabled" />
          <span>Learners can share their simulation runs
            <span v-if="!settings.simRunsIncluded" class="block text-xs text-(--fg-3)">Not included in your school's plan.</span>
          </span>
        </label>
        <p class="m-0 text-xs text-(--fg-3)">
          AI screening of posts {{ settings.aiModerationIncluded ? 'is in your plan: switch it on in AI settings.' : "isn't included in your school's plan." }}
          {{ storageText }}
        </p>
      </RaCard>

      <RaCard v-if="groupsAndChatIncluded" :padding="24" class="flex flex-col gap-4">
        <h2 class="m-0 text-lg font-bold text-(--fg-1)">Study groups and chat</h2>
        <label class="flex items-start gap-3 text-sm text-(--fg-1)">
          <input v-model="form.studyGroupsEnabled" type="checkbox" class="mt-1" :disabled="!settings.studyGroupsIncluded" />
          <span>Study groups
            <span class="block text-xs text-(--fg-3)">
              {{ settings.studyGroupsIncluded ? 'Groups inside a class, with a goal, progress and their own board. How learners start them depends on the class\'s safety level.' : "Not included in your school's plan." }}
            </span>
          </span>
        </label>
        <label class="flex items-start gap-3 text-sm text-(--fg-1)">
          <input v-model="form.chatEnabled" type="checkbox" class="mt-1" :disabled="!settings.chatIncluded" />
          <span>Class and group chat
            <span class="block text-xs text-(--fg-3)">
              {{ settings.chatIncluded ? 'A chat for each class and study group. The word filter, reports and AI screening apply as on boards.' : "Not included in your school's plan." }}
            </span>
          </span>
        </label>
        <label class="flex items-start gap-3 text-sm text-(--fg-1)">
          <input v-model="form.directMessagesEnabled" type="checkbox" class="mt-1" :disabled="!settings.directMessagesIncluded" />
          <span>Direct messages
            <span class="block text-xs text-(--fg-3)">
              {{ settings.directMessagesIncluded ? 'Learners can message the staff of their classes, and staff can message the learners they teach. School admins can open a conversation once something in it is reported or held; each time is logged.' : "Not included in your school's plan." }}
            </span>
          </span>
        </label>
        <label class="ml-7 flex items-start gap-3 text-sm text-(--fg-1)">
          <input v-model="form.studentMessagesEnabled" type="checkbox" class="mt-1" :disabled="!settings.directMessagesIncluded || !form.directMessagesEnabled" />
          <span>Learners can message classmates
            <span class="block text-xs text-(--fg-3)">Only learners in Open classes, and only people in their own classes.</span>
          </span>
        </label>
        <p v-if="limitsText" class="m-0 text-xs text-(--fg-3)">{{ limitsText }}</p>
      </RaCard>

      <RaCard :padding="24" class="flex flex-col gap-4">
        <div>
          <h2 class="m-0 text-lg font-bold text-(--fg-1)">Safety level</h2>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">Every class starts here. A class's teacher can make their class stricter, never looser.</p>
        </div>
        <div class="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Default safety level">
          <label
            v-for="preset in presets"
            :key="preset"
            class="flex cursor-pointer flex-col gap-1.5 rounded-(--ra-lg) border p-4"
            :class="form.defaultPreset === preset ? 'border-(--brand-blue) bg-(--brand-blue-soft)' : 'border-(--line-2)'"
          >
            <span class="flex items-center gap-2 text-sm font-semibold text-(--fg-1)">
              <input v-model="form.defaultPreset" type="radio" name="default-preset" :value="preset" />
              {{ PRESET_LABELS[preset].label }}
            </span>
            <span class="text-xs leading-relaxed text-(--fg-3)">{{ PRESET_LABELS[preset].description }}</span>
          </label>
        </div>
      </RaCard>

      <RaCard :padding="24" class="flex flex-col gap-3">
        <div>
          <h2 class="m-0 text-lg font-bold text-(--fg-1)">Blocked words</h2>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">
            One per line, added to RoboAcademy's own list. A learner's post with one of these is held for staff to check.
            Add words in local languages your learners use.
          </p>
        </div>
        <Label for="blocked-terms" class="sr-only">Blocked words</Label>
        <textarea
          id="blocked-terms"
          v-model="form.blockedTerms"
          rows="6"
          class="resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-3 py-2 text-sm text-(--fg-1) outline-none"
        />
      </RaCard>

      <div>
        <Button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save settings' }}</Button>
      </div>
    </form>
  </div>
</template>
