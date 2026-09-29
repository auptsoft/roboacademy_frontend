<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { MoreVertical, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Label from '@/components/ui/label.vue'
import Pagination from '@/components/Pagination.vue'
import UserComboBox from '@/components/UserComboBox.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import { listCourseCatalog, listPaths, type CourseCatalogItem, type PathListItem } from '@/api/learning'
import {
  listCertificates,
  issueCertificate,
  revokeCertificate,
  type CertificateKind,
  type CertificateListItem,
  type CertificateStatus,
} from '@/api/certification'

const filters = reactive<{
  kind: CertificateKind | ''
  courseId: string
  pathId: string
  status: CertificateStatus | ''
  userId: string | null
}>({ kind: '', courseId: '', pathId: '', status: '', userId: null })

const {
  items: certificates,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList(
  (page, pageSize) => listCertificates(
    {
      kind: filters.kind || undefined,
      courseId: filters.kind !== 'Path' ? filters.courseId || undefined : undefined,
      pathId: filters.kind !== 'Course' ? filters.pathId || undefined : undefined,
      status: filters.status || undefined,
      userId: filters.userId || undefined,
    },
    page,
    pageSize,
  ),
  { initialPageSize: 20, errorMessage: 'Failed to load certificates.' },
)

// Only feed the filter/issue dropdowns - row titles come from the list response itself.
const courses = ref<CourseCatalogItem[]>([])
const paths = ref<PathListItem[]>([])

async function loadPickers() {
  const [courseResult, pathResult] = await Promise.allSettled([
    listCourseCatalog({ state: 'Published' }, 1, 100),
    listPaths({ state: 'Published' }, 1, 100),
  ])
  if (courseResult.status === 'fulfilled') courses.value = courseResult.value.items
  if (pathResult.status === 'fulfilled') paths.value = pathResult.value.items
}

function certificateTitle(cert: CertificateListItem): string {
  return cert.title ?? (cert.kind === 'Path' ? 'Deleted learning path' : 'Deleted course')
}

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'

const rowClass =
  'grid grid-cols-[1.6fr_1.5fr_1.3fr_100px_150px_60px] items-center gap-3 py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(() => {
  load()
  loadPickers()
})

watch(filters, () => {
  page.value = 1
  load()
}, { deep: true })

function clearFilters() {
  Object.assign(filters, { kind: '', courseId: '', pathId: '', status: '', userId: null })
}

// --- Issue ---
const issueOpen = ref(false)
const issueSubmitting = ref(false)
// Shown inside the dialog: a toast is easy to miss (or hidden) while the modal is open.
const issueError = ref<string | null>(null)
const issueForm = reactive<{ courseId: string; userId: string | null }>({ courseId: '', userId: null })

function openIssue() {
  issueForm.courseId = ''
  issueForm.userId = null
  issueError.value = null
  issueOpen.value = true
}

watch(() => [issueForm.courseId, issueForm.userId], () => {
  issueError.value = null
})

async function submitIssue() {
  if (!issueForm.userId) return
  issueSubmitting.value = true
  issueError.value = null
  try {
    await issueCertificate(issueForm.courseId, issueForm.userId)
    toast.success('Certificate issued.')
    issueOpen.value = false
    await load()
  } catch (error) {
    issueError.value = error instanceof ApiError ? error.message : 'Failed to issue certificate.'
  } finally {
    issueSubmitting.value = false
  }
}

// --- Revoke ---
const revokingItem = ref<CertificateListItem | null>(null)
const revokeReason = ref('')
const revoking = ref(false)
const revokeError = ref<string | null>(null)

function openRevoke(item: CertificateListItem) {
  revokingItem.value = item
  revokeReason.value = ''
  revokeError.value = null
}

function closeRevoke() {
  revokingItem.value = null
}

async function submitRevoke() {
  if (!revokingItem.value || !revokeReason.value.trim()) return
  revoking.value = true
  revokeError.value = null
  try {
    await revokeCertificate(revokingItem.value.id, revokeReason.value.trim())
    toast.success('Certificate revoked.')
    closeRevoke()
    await load()
  } catch (error) {
    revokeError.value = error instanceof ApiError ? error.message : 'Failed to revoke certificate.'
  } finally {
    revoking.value = false
  }
}

async function copyVerificationId(cert: CertificateListItem) {
  try {
    await navigator.clipboard.writeText(cert.verificationId)
    toast.success('Verification ID copied.')
  } catch {
    toast.error("Couldn't copy to the clipboard.")
  }
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Certificates</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">
          Course certificates are issued automatically once a learner meets every requirement; path certificates once they hold a certificate for every course in the path.
        </p>
      </div>
      <Button @click="openIssue">
        <Plus :size="14" /> Issue Certificate
      </Button>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6 max-sm:px-4">
        <select v-model="filters.kind" :class="selectClass" aria-label="Certificate type">
          <option value="">Courses and paths</option>
          <option value="Course">Courses only</option>
          <option value="Path">Paths only</option>
        </select>
        <select v-if="filters.kind !== 'Path'" v-model="filters.courseId" :class="selectClass" aria-label="Course">
          <option value="">All courses</option>
          <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
        <select v-if="filters.kind !== 'Course'" v-model="filters.pathId" :class="selectClass" aria-label="Learning path">
          <option value="">All paths</option>
          <option v-for="p in paths" :key="p.id" :value="p.id">{{ p.title }}</option>
        </select>
        <select v-model="filters.status" :class="selectClass" aria-label="Status">
          <option value="">Any status</option>
          <option value="Issued">Issued</option>
          <option value="Revoked">Revoked</option>
        </select>
        <UserComboBox v-model="filters.userId" />
        <Button
          v-if="filters.kind || filters.courseId || filters.pathId || filters.status || filters.userId"
          variant="ghost"
          size="sm"
          @click="clearFilters"
        >Clear filters</Button>
      </div>

      <div class="grid grid-cols-[1.6fr_1.5fr_1.3fr_100px_150px_60px] gap-3 border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Certificate</span>
        <span>Learner</span>
        <span>Verification ID</span>
        <span>Status</span>
        <span>Issued</span>
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading certificates…</p>
      <p v-else-if="certificates.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No certificates found.</p>

      <div
        v-for="(cert, i) in certificates"
        :key="cert.id"
        :class="[rowClass, i < certificates.length - 1 && 'border-b border-(--line-1)']"
      >
        <div class="flex min-w-0 flex-col gap-0.5 max-md:w-full">
          <span class="truncate text-sm font-semibold text-(--fg-1)" :class="!cert.title && 'italic text-(--fg-3)'">{{ certificateTitle(cert) }}</span>
          <span class="text-[11px] font-semibold uppercase tracking-[0.04em] text-(--fg-4)">{{ cert.kind === 'Path' ? 'Learning path' : 'Course' }}</span>
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="truncate text-sm text-(--fg-1)">{{ cert.learnerName ?? 'Unknown learner' }}</span>
          <span class="truncate text-xs text-(--fg-3)">{{ cert.learnerEmail ?? cert.userId }}</span>
        </div>
        <div class="truncate font-mono text-xs text-(--fg-3)" :title="cert.verificationId">{{ cert.verificationId }}</div>
        <div class="flex flex-col items-start gap-1">
          <RaChip :tone="cert.status === 'Issued' ? 'info' : 'neutral'">{{ cert.status }}</RaChip>
          <span
            v-if="cert.status === 'Revoked' && cert.revokedReason"
            class="max-w-full truncate text-[11px] text-(--fg-3)"
            :title="cert.revokedReason"
          >{{ cert.revokedReason }}</span>
        </div>
        <div class="text-sm text-(--fg-2)">{{ formatDate(cert.issuedAt) }}</div>
        <div class="flex justify-end max-md:w-full max-md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem @select="copyVerificationId(cert)">Copy verification ID</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" :disabled="cert.status === 'Revoked'" @select="openRevoke(cert)">
                Revoke
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

    <!-- Issue dialog -->
    <Dialog v-model:open="issueOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Certificate</DialogTitle>
          <DialogDescription>
            Only issues if the learner has completed the required lessons, passed every required assessment, and passed the practical - checked again on the server. Path certificates are issued automatically.
          </DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitIssue">
          <div class="flex flex-col gap-1.5">
            <Label for="issue-course">Course</Label>
            <select
              id="issue-course"
              v-model="issueForm.courseId"
              required
              class="h-10 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
            >
              <option value="" disabled>Select a course</option>
              <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Learner</Label>
            <UserComboBox v-model="issueForm.userId" />
          </div>
          <p
            v-if="issueError"
            role="alert"
            class="m-0 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >{{ issueError }}</p>
          <DialogFooter>
            <Button variant="outline" type="button" @click="issueOpen = false">Cancel</Button>
            <Button type="submit" :disabled="issueSubmitting || !issueForm.userId">
              {{ issueSubmitting ? 'Issuing…' : 'Issue' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Revoke dialog -->
    <Dialog :open="revokingItem !== null" @update:open="(open) => { if (!open) closeRevoke() }">
      <DialogContent v-if="revokingItem">
        <DialogHeader>
          <DialogTitle>Revoke Certificate</DialogTitle>
          <DialogDescription>
            {{ certificateTitle(revokingItem) }} - {{ revokingItem.learnerName ?? revokingItem.userId }}.
            The learner is notified and the public verification page will show it as revoked.
          </DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitRevoke">
          <div class="flex flex-col gap-1.5">
            <Label for="revoke-reason">Reason</Label>
            <textarea
              id="revoke-reason"
              v-model="revokeReason"
              rows="3"
              required
              maxlength="500"
              class="w-full resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-sans text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)"
            />
            <p class="m-0 text-xs text-(--fg-3)">The learner sees this reason in their notification.</p>
          </div>
          <p
            v-if="revokeError"
            role="alert"
            class="m-0 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >{{ revokeError }}</p>
          <DialogFooter>
            <Button variant="outline" type="button" @click="closeRevoke">Cancel</Button>
            <Button type="submit" variant="destructive" :disabled="revoking || !revokeReason.trim()">
              {{ revoking ? 'Revoking…' : 'Revoke' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
