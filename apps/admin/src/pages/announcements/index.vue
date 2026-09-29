<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { Megaphone } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import Pagination from '@/components/Pagination.vue'
import SearchMultiSelect, { type SearchOption } from '@/components/SearchMultiSelect.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import { ROBOACADEMY_ROLES } from '@/api/identity'
import { searchClasses } from '@/lib/pickers'
import { usePagedList } from '@/composables/usePagedList'
import {
  cancelAnnouncement,
  createAnnouncement,
  listAnnouncements,
  type Announcement,
  type AnnouncementAudience,
} from '@/api/notifications'

const BODY_LIMIT = 1000

// Roles worth addressing from a school: guests and platform staff are left out.
const ROLE_OPTIONS = ROBOACADEMY_ROLES.filter((r) => !['Guest', 'PlatformSupport', 'PlatformAdmin'].includes(r))

function roleLabel(role: string): string {
  return role.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const { items: announcements, loading, page, pageSize, meta, totalPages, load, goToPage, setPageSize } = usePagedList(
  (page, pageSize) => listAnnouncements(page, pageSize),
  { initialPageSize: 20, errorMessage: 'Failed to load announcements.' },
)
onMounted(load)

function audienceSummary(a: Announcement): string {
  if (a.audience === 'Everyone') return 'Everyone'
  if (a.audience === 'Roles') return a.roles.map(roleLabel).join(', ')
  return `${a.classIds.length} class${a.classIds.length === 1 ? '' : 'es'}`
}

function statusTone(status: Announcement['status']) {
  return status === 'Sent' ? 'info' : status === 'Cancelled' ? 'admin' : 'neutral'
}

// --- Compose ---
const composeOpen = ref(false)
const submitting = ref(false)
const errors = ref<Record<string, string[]>>({})
const form = reactive({
  title: '',
  body: '',
  audience: 'Everyone' as AnnouncementAudience,
  roles: [] as string[],
  classes: [] as SearchOption[],
  sendEmail: true,
  schedule: false,
  scheduledFor: '',
})

function openCompose() {
  Object.assign(form, {
    title: '', body: '', audience: 'Everyone', roles: [], classes: [], sendEmail: true, schedule: false, scheduledFor: '',
  })
  errors.value = {}
  composeOpen.value = true
}

const canSubmit = computed(() =>
  form.title.trim() && form.body.trim() &&
  (form.audience !== 'Roles' || form.roles.length) &&
  (form.audience !== 'Classes' || form.classes.length) &&
  (!form.schedule || form.scheduledFor),
)

async function submit() {
  errors.value = {}
  submitting.value = true
  try {
    const created = await createAnnouncement({
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
      roles: form.audience === 'Roles' ? form.roles : [],
      classIds: form.audience === 'Classes' ? form.classes.map((c) => c.id) : [],
      sendEmail: form.sendEmail,
      scheduledFor: form.schedule ? new Date(form.scheduledFor).toISOString() : null,
    })
    toast.success(created.status === 'Scheduled' ? 'Announcement scheduled.' : 'Announcement sent.')
    composeOpen.value = false
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) errors.value = error.fieldErrors
    else toast.error(error instanceof ApiError ? error.message : 'Failed to send announcement.')
  } finally {
    submitting.value = false
  }
}

async function cancel(a: Announcement) {
  if (!window.confirm(`Cancel the scheduled announcement "${a.title}"?`)) return
  try {
    await cancelAnnouncement(a.id)
    toast.success('Announcement cancelled.')
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to cancel announcement.')
  }
}

const rowClass =
  'grid grid-cols-[2.2fr_1.2fr_110px_150px_90px_90px] items-center gap-3 py-3.5 px-6 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'
const selectClass = 'h-10 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Announcements</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Send a message to the whole school, specific roles or classes. It always appears in-app; email is optional.</p>
      </div>
      <Button @click="openCompose">
        <Megaphone :size="14" /> New Announcement
      </Button>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div :class="[rowClass, 'border-b border-(--line-1) text-xs text-(--fg-3) max-md:hidden']">
        <span>Announcement</span><span>Audience</span><span>Status</span><span>When</span><span>Reached</span><span />
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading announcements…</p>
      <p v-else-if="announcements.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No announcements yet.</p>

      <div
        v-for="(a, i) in announcements"
        :key="a.id"
        :class="[rowClass, i < announcements.length - 1 && 'border-b border-(--line-1)']"
      >
        <div class="min-w-0 max-md:w-full">
          <div class="text-sm font-semibold text-(--fg-1)">{{ a.title }}</div>
          <div class="text-xs text-(--fg-3) line-clamp-2 whitespace-pre-line">{{ a.body }}</div>
        </div>
        <div class="text-sm text-(--fg-2)">{{ audienceSummary(a) }}<span v-if="a.sendEmail" class="text-(--fg-4)"> · email</span></div>
        <div><RaChip :tone="statusTone(a.status)">{{ a.status }}</RaChip></div>
        <div class="text-sm text-(--fg-2)">{{ formatDate(a.sentAt ?? a.scheduledFor ?? a.createdAt) }}</div>
        <div class="text-sm text-(--fg-2)">{{ a.recipientCount ?? (a.status === 'Sent' ? '…' : '—') }}</div>
        <div class="flex justify-end">
          <Button v-if="a.status === 'Scheduled'" variant="outline" size="sm" @click="cancel(a)">Cancel</Button>
        </div>
      </div>

      <Pagination
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-count="meta?.totalCount ?? 0"
        @update:page="goToPage"
        @update:page-size="setPageSize"
      />
    </RaCard>

    <Dialog v-model:open="composeOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>New announcement</DialogTitle>
          <DialogDescription>Recipients can't turn announcements off in-app, so keep them for things that matter.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <div class="flex flex-col gap-1.5">
            <Label for="an-title">Title</Label>
            <Input id="an-title" v-model="form.title" required maxlength="200" />
            <p v-for="msg in errors.Title" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="an-body">Message</Label>
            <textarea
              id="an-body"
              v-model="form.body"
              rows="5"
              required
              :maxlength="BODY_LIMIT"
              class="w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-2 text-sm text-(--fg-2) outline-none"
            />
            <span class="self-end text-xs text-(--fg-4)">{{ form.body.length }} / {{ BODY_LIMIT }}</span>
            <p v-for="msg in errors.Body" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="an-audience">Send to</Label>
            <select id="an-audience" v-model="form.audience" :class="selectClass">
              <option value="Everyone">Everyone in the school</option>
              <option value="Roles">People with specific roles</option>
              <option value="Classes">Students in specific classes</option>
            </select>
            <div v-if="form.audience === 'Roles'" class="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              <label v-for="role in ROLE_OPTIONS" :key="role" class="inline-flex items-center gap-2 text-sm text-(--fg-2)">
                <input v-model="form.roles" type="checkbox" :value="role" class="size-4" />
                {{ roleLabel(role) }}
              </label>
            </div>
            <SearchMultiSelect
              v-if="form.audience === 'Classes'"
              v-model="form.classes"
              :search="searchClasses"
              placeholder="Search classes…"
            />
            <p v-for="msg in [...(errors.Roles ?? []), ...(errors.ClassIds ?? [])]" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-(--fg-2)">
            <input v-model="form.sendEmail" type="checkbox" class="size-4" />
            Also send by email
          </label>
          <div class="flex flex-col gap-1.5">
            <label class="inline-flex items-center gap-2 text-sm text-(--fg-2)">
              <input v-model="form.schedule" type="checkbox" class="size-4" />
              Schedule for later
            </label>
            <Input v-if="form.schedule" v-model="form.scheduledFor" type="datetime-local" required />
            <p v-for="msg in errors.ScheduledFor" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="composeOpen = false">Cancel</Button>
            <Button type="submit" :disabled="submitting || !canSubmit">
              {{ submitting ? 'Sending…' : form.schedule ? 'Schedule' : 'Send now' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
