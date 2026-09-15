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
import { listCourseCatalog, type CourseCatalogItem } from '@/api/learning'
import { listCertificates, issueCertificate, revokeCertificate, type CertificateListItem } from '@/api/certification'

const filters = reactive<{ courseId: string; userId: string | null }>({ courseId: '', userId: null })

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
    { courseId: filters.courseId || undefined, userId: filters.userId || undefined },
    page,
    pageSize,
  ),
  { initialPageSize: 20, errorMessage: 'Failed to load certificates.' },
)

const courses = ref<CourseCatalogItem[]>([])

async function loadCourses() {
  const result = await listCourseCatalog({ state: 'Published' }, 1, 100)
  courses.value = result.items
}

function courseTitle(courseId: string): string {
  return courses.value.find((c) => c.id === courseId)?.title ?? '—'
}

const rowClass =
  'grid grid-cols-[1.5fr_1.5fr_1.5fr_100px_140px_100px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(() => {
  load()
  loadCourses()
})

watch(filters, () => {
  page.value = 1
  load()
}, { deep: true })

// --- Issue ---
const issueOpen = ref(false)
const issueSubmitting = ref(false)
const issueForm = reactive<{ courseId: string; userId: string | null }>({ courseId: '', userId: null })

function openIssue() {
  issueForm.courseId = ''
  issueForm.userId = null
  issueOpen.value = true
}

async function submitIssue() {
  if (!issueForm.userId) return
  issueSubmitting.value = true
  try {
    await issueCertificate(issueForm.courseId, issueForm.userId)
    toast.success('Certificate issued.')
    issueOpen.value = false
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to issue certificate.')
  } finally {
    issueSubmitting.value = false
  }
}

// --- Revoke ---
const revokingItem = ref<CertificateListItem | null>(null)
const revokeReason = ref('')
const revoking = ref(false)

function openRevoke(item: CertificateListItem) {
  revokingItem.value = item
  revokeReason.value = ''
}

function closeRevoke() {
  revokingItem.value = null
}

async function submitRevoke() {
  if (!revokingItem.value || !revokeReason.value.trim()) return
  revoking.value = true
  try {
    await revokeCertificate(revokingItem.value.id, revokeReason.value.trim())
    toast.success('Certificate revoked.')
    closeRevoke()
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to revoke certificate.')
  } finally {
    revoking.value = false
  }
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Certificates</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Issue and revoke certificates. Eligibility is always re-checked server-side.</p>
      </div>
      <Button @click="openIssue">
        <Plus :size="14" /> Issue Certificate
      </Button>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6">
        <select
          v-model="filters.courseId"
          class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
        >
          <option value="">All courses</option>
          <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
        <UserComboBox v-model="filters.userId" />
        <Button v-if="filters.userId" variant="ghost" size="sm" @click="filters.userId = null">Clear learner filter</Button>
      </div>

      <div class="grid grid-cols-[1.5fr_1.5fr_1.5fr_100px_140px_100px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Course</span>
        <span>Learner Id</span>
        <span>Verification Id</span>
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
        <div class="text-sm font-semibold text-(--fg-1)">{{ courseTitle(cert.courseId) }}</div>
        <div class="font-mono text-xs text-(--fg-3)">{{ cert.userId }}</div>
        <div class="font-mono text-xs text-(--fg-3)">{{ cert.verificationId }}</div>
        <div><RaChip :tone="cert.status === 'Issued' ? 'info' : 'neutral'">{{ cert.status }}</RaChip></div>
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
          <DialogDescription>Eligibility (exam and practical thresholds) is re-checked server-side before issuing.</DialogDescription>
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
          <DialogDescription>{{ courseTitle(revokingItem.courseId) }} — {{ revokingItem.userId }}</DialogDescription>
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
          </div>
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
