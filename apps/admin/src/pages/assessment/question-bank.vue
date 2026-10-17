<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { MoreVertical, Plus, Sparkles, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Pagination from '@/components/Pagination.vue'
import BankItemFields from '@/components/questions/BankItemFields.vue'
import { bankItemRequest, emptyBankItemForm, type BankItemForm } from '@/components/questions/bank-item-form'
import { QUIZ_KIND_LABELS } from '@/components/questions/question-kinds'
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
import CopyToTenantsDialog from '@/components/CopyToTenantsDialog.vue'
import ImportQuestionBankFromTenantDialog from '@/components/ImportQuestionBankFromTenantDialog.vue'
import AIQuizGeneratorDialog from '@/components/AIQuizGeneratorDialog.vue'
import { useAIAvailability } from '@/composables/useAIAvailability'
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import { useCanCopyCrossTenant } from '@/composables/useCanCopyCrossTenant'
import {
  listQuestionBank,
  createQuestionBankItem,
  getQuestionBankItem,
  updateQuestionBankItem,
  deleteQuestionBankItem,
  copyQuestionBankItemsToTenants,
  type QuestionBankItemSummary,
} from '@/api/assessment'
import { provideAssessmentAssets } from '@/components/questions/assessment-assets'

const canCopyCrossTenant = useCanCopyCrossTenant()

// AI question drafts, shown only when the school's plan and settings allow authoring help.
const aiAvailability = useAIAvailability()
const aiGeneratorOpen = ref(false)

const {
  items: bankItems,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList((page, pageSize) => listQuestionBank(undefined, page, pageSize), {
  initialPageSize: 20,
  errorMessage: 'Failed to load the question bank.',
})

const rowClass =
  'grid grid-cols-[2fr_100px_1.5fr_100px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(() => {
  load()
})

type ItemForm = BankItemForm
const emptyForm = emptyBankItemForm

// Diagrams in label-the-diagram questions upload to (and preview from) the assessment store.
const { loadUrls: loadQuestionImages } = provideAssessmentAssets()

// --- Create ---
const createOpen = ref(false)
const createSubmitting = ref(false)
const createForm = reactive<ItemForm>(emptyForm())
const createErrors = ref<Record<string, string[]>>({})

function openCreate() {
  Object.assign(createForm, emptyForm())
  createErrors.value = {}
  createOpen.value = true
}

async function submitCreate() {
  createErrors.value = {}
  createSubmitting.value = true
  try {
    await createQuestionBankItem(bankItemRequest(createForm))
    toast.success('Question added to the bank.')
    createOpen.value = false
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      createErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create question.')
    }
  } finally {
    createSubmitting.value = false
  }
}

// --- Edit ---
const editingItem = ref<QuestionBankItemSummary | null>(null)
const editForm = reactive<ItemForm>(emptyForm())
const editErrors = ref<Record<string, string[]>>({})
const editSubmitting = ref(false)
const editLoading = ref(false)

async function openEdit(item: QuestionBankItemSummary) {
  editingItem.value = item
  Object.assign(editForm, emptyForm())
  editForm.text = item.text
  editForm.tags = item.tags.join(', ')
  editErrors.value = {}
  editLoading.value = true
  try {
    const detail = await getQuestionBankItem(item.id)
    editForm.kind = detail.kind ?? 'choice'
    editForm.text = detail.text
    editForm.options = detail.options
    editForm.correctOptionIndex = detail.correctOptionIndex
    editForm.definition = detail.definition
    void loadQuestionImages([detail.definition as { asset?: string } | null])
    editForm.tags = detail.tags.join(', ')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load question detail.')
    closeEdit()
  } finally {
    editLoading.value = false
  }
}

function closeEdit() {
  editingItem.value = null
}

async function submitEdit() {
  if (!editingItem.value) return
  editErrors.value = {}
  editSubmitting.value = true
  try {
    await updateQuestionBankItem(editingItem.value.id, bankItemRequest(editForm))
    toast.success('Question updated.')
    closeEdit()
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      editErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update question.')
    }
  } finally {
    editSubmitting.value = false
  }
}

// --- Delete ---
const deletingId = ref<string | null>(null)

async function removeItem(item: QuestionBankItemSummary) {
  if (!window.confirm('Delete this question from the bank? Quizzes that already copied it are unaffected.')) return
  deletingId.value = item.id
  try {
    await deleteQuestionBankItem(item.id)
    toast.success('Question deleted.')
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to delete question.')
  } finally {
    deletingId.value = null
  }
}

// --- Copy to tenants ---
const copyDialogOpen = ref(false)
const copyDialogItemId = ref('')

function openCopyDialog(item: QuestionBankItemSummary) {
  copyDialogItemId.value = item.id
  copyDialogOpen.value = true
}

async function copyToTenants(targetTenantIds: string[]) {
  const result = await copyQuestionBankItemsToTenants({ itemIds: [copyDialogItemId.value], targetTenantIds })
  return result.results.map((r) => ({ tenantId: r.tenantId, isSuccessful: r.isSuccessful, error: r.error }))
}

// --- Import from tenant ---
const importDialogOpen = ref(false)
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Question Bank</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Reusable questions quizzes can draw from.</p>
      </div>
      <div class="flex gap-2">
        <Button v-if="canCopyCrossTenant" variant="outline" @click="importDialogOpen = true">
          <Upload :size="14" /> Import from tenant…
        </Button>
        <Button v-if="aiAvailability.feature('Authoring')?.available" variant="outline" @click="aiGeneratorOpen = true">
          <Sparkles :size="14" /> Generate with AI
        </Button>
        <Button @click="openCreate">
          <Plus :size="14" /> Add Question
        </Button>
      </div>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="grid grid-cols-[2fr_100px_1.5fr_100px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Question</span>
        <span>Options</span>
        <span>Tags</span>
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading question bank…</p>
      <p v-else-if="bankItems.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
        No questions yet — add one to get started.
      </p>

      <div
        v-for="(item, i) in bankItems"
        :key="item.id"
        :class="[rowClass, i < bankItems.length - 1 && 'border-b border-(--line-1)']"
      >
        <div class="flex flex-col">
          <span class="text-sm font-semibold text-(--fg-1)">{{ item.text }}</span>
          <span v-if="item.kind && item.kind !== 'choice'" class="text-xs text-(--fg-3)">{{ QUIZ_KIND_LABELS[item.kind] }}</span>
        </div>
        <div class="text-sm text-(--fg-2)">{{ item.kind && item.kind !== 'choice' ? '—' : item.optionCount }}</div>
        <div class="flex flex-wrap gap-1">
          <RaChip v-for="tag in item.tags" :key="tag" tone="neutral">{{ tag }}</RaChip>
          <span v-if="item.tags.length === 0" class="text-xs text-(--fg-4)">—</span>
        </div>
        <div class="flex justify-end max-md:w-full max-md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-lg border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem @select="openEdit(item)">Edit</DropdownMenuItem>
              <DropdownMenuItem v-if="canCopyCrossTenant" @select="openCopyDialog(item)">
                Copy to tenants…
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" :disabled="deletingId === item.id" @select="removeItem(item)">
                Delete
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

    <!-- Create dialog -->
    <Dialog v-model:open="createOpen">
      <DialogContent class="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Question</DialogTitle>
          <DialogDescription>Adds a reusable question to the bank.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitCreate">
          <BankItemFields v-model="createForm" :errors="createErrors" id-prefix="qb" />
          <DialogFooter>
            <Button variant="outline" type="button" @click="createOpen = false">Cancel</Button>
            <Button type="submit" :disabled="createSubmitting">
              {{ createSubmitting ? 'Adding…' : 'Add Question' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Edit dialog -->
    <Dialog :open="editingItem !== null" @update:open="(open) => { if (!open) closeEdit() }">
      <DialogContent v-if="editingItem" class="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
          <DialogDescription>
            Quizzes that already copied this question keep their own snapshot and are unaffected by this edit.
          </DialogDescription>
        </DialogHeader>
        <p v-if="editLoading" class="m-0 py-4 text-center text-[13px] text-(--fg-3)">Loading question…</p>
        <form v-else class="flex flex-col gap-4" @submit.prevent="submitEdit">
          <BankItemFields v-model="editForm" :errors="editErrors" id-prefix="qb-edit" />
          <DialogFooter>
            <Button variant="outline" type="button" @click="closeEdit">Cancel</Button>
            <Button type="submit" :disabled="editSubmitting">
              {{ editSubmitting ? 'Saving…' : 'Save Changes' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <CopyToTenantsDialog
      v-model:open="copyDialogOpen"
      title="Copy question to tenants"
      description="Copies this question into the question bank of each selected tenant."
      :copy-fn="copyToTenants"
    />

    <ImportQuestionBankFromTenantDialog v-model:open="importDialogOpen" @imported="load" />
    <AIQuizGeneratorDialog v-model:open="aiGeneratorOpen" @saved="load" />
  </div>
</template>
