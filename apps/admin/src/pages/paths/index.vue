<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import Pagination from '@/components/Pagination.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import { listPaths, createPath, type PathState } from '@/api/learning'

const router = useRouter()

const filters = reactive<{ state: PathState | ''; search: string }>({ state: '', search: '' })

const {
  items: paths,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList(
  (page, pageSize) => listPaths(
    { state: filters.state || undefined, search: filters.search || undefined },
    page,
    pageSize,
  ),
  { initialPageSize: 20, errorMessage: 'Failed to load learning paths.' },
)

const rowClass =
  'grid grid-cols-[2fr_2fr_100px_100px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(() => {
  load()
})

let searchDebounce: ReturnType<typeof setTimeout> | undefined
watch(() => filters.search, () => {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => { page.value = 1; load() }, 300)
})
watch(() => filters.state, () => { page.value = 1; load() })

const createOpen = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({ title: '', description: '' })
const createErrors = ref<Record<string, string[]>>({})

function openCreate() {
  createForm.title = ''
  createForm.description = ''
  createErrors.value = {}
  createOpen.value = true
}

async function submitCreate() {
  createErrors.value = {}
  createSubmitting.value = true
  try {
    const created = await createPath({
      title: createForm.title,
      description: createForm.description || undefined,
    })
    toast.success('Learning path created.')
    createOpen.value = false
    router.push(`/paths/${created.id}`)
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      createErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create learning path.')
    }
  } finally {
    createSubmitting.value = false
  }
}

function openPath(pathId: string) {
  router.push(`/paths/${pathId}`)
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Learning Paths</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Sequence courses into a guided path.</p>
      </div>
      <Button @click="openCreate">
        <Plus :size="14" /> Add Path
      </Button>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6">
        <select
          v-model="filters.state"
          class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
        >
          <option value="">All states</option>
          <option value="Draft">Draft</option>
          <option value="Published">Published</option>
        </select>
        <Input v-model="filters.search" placeholder="Search by title or description…" class="h-9 flex-1 min-w-48" />
      </div>

      <div class="grid grid-cols-[2fr_2fr_100px_100px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Title</span>
        <span>Description</span>
        <span>State</span>
        <span>Courses</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading learning paths…</p>
      <p v-else-if="paths.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
        No learning paths match these filters.
      </p>

      <button
        v-for="(path, i) in paths"
        :key="path.id"
        type="button"
        :class="[rowClass, 'text-left', i < paths.length - 1 && 'border-b border-(--line-1)']"
        @click="openPath(path.id)"
        class="w-full "
      >
        <div class="text-sm font-semibold text-(--fg-1)">{{ path.title }}</div>
        <div class="text-sm text-(--fg-3)">{{ path.description || '—' }}</div>
        <div><RaChip :tone="path.state === 'Published' ? 'info' : 'neutral'">{{ path.state }}</RaChip></div>
        <div class="text-sm text-(--fg-2)">{{ path.courseCount }}</div>
      </button>

      <Pagination
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-count="meta?.totalCount ?? 0"
        @update:page="goToPage"
        @update:page-size="setPageSize"
      />
    </RaCard>

    <!-- Create path dialog -->
    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Learning Path</DialogTitle>
          <DialogDescription>Create a draft path. Courses are added as steps on its detail page.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitCreate">
          <div class="flex flex-col gap-1.5">
            <Label for="path-title">Title</Label>
            <Input id="path-title" v-model="createForm.title" required />
            <p v-for="msg in createErrors.Title" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="path-description">Description (optional)</Label>
            <Input id="path-description" v-model="createForm.description" />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="createOpen = false">Cancel</Button>
            <Button type="submit" :disabled="createSubmitting">
              {{ createSubmitting ? 'Creating…' : 'Add Path' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
