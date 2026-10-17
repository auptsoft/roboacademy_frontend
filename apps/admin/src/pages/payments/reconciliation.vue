<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { Button } from '@/components/ui/button'
import Pagination from '@/components/Pagination.vue'
import ReasonDialog from '@/components/ReasonDialog.vue'
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import {
  listReconciliationIssues,
  resolveReconciliationIssue,
  type ReconciliationIssue,
  type ReconciliationIssueKind,
} from '@/api/payments'

// Differences the daily reconciliation found between orders and the payment providers' records
// (Payments Phase P3 §4.3). Payments whose webhook was lost are fixed automatically and never
// show here; what's left needs a person - usually a look in the provider's dashboard.

const includeResolved = ref(false)
const { items: issues, loading, page, pageSize, meta, totalPages, load, goToPage, setPageSize } = usePagedList(
  (page, pageSize) => listReconciliationIssues(includeResolved.value, page, pageSize),
  { initialPageSize: 20, errorMessage: 'Failed to load reconciliation issues.' },
)

onMounted(load)
watch(includeResolved, () => {
  page.value = 1
  load()
})

const KIND_LABEL: Record<ReconciliationIssueKind, string> = {
  MissingOrder: 'Payment with no order',
  MissingPayment: 'Order with no payment',
  AmountMismatch: 'Different amount',
  StatusMismatch: 'Paid, but not recorded',
}

const target = ref<ReconciliationIssue | null>(null)
const pending = ref(false)
const error = ref<string | null>(null)

async function resolve(note: string) {
  if (!target.value) return
  pending.value = true
  error.value = null
  try {
    await resolveReconciliationIssue(target.value.id, note)
    toast.success('Marked as dealt with.')
    target.value = null
    await load()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Reconciliation</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Every night, the previous day's orders are checked against the payment provider's records. Anything that doesn't
        match is listed here, once.
      </p>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6 max-sm:px-4">
        <label class="flex items-center gap-2 text-sm text-(--fg-2)">
          <input v-model="includeResolved" type="checkbox" class="size-4 accent-(--brand-blue)">
          Show resolved
        </label>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading…</p>
      <p v-else-if="issues.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">Everything matches.</p>

      <div
        v-for="issue in issues"
        :key="issue.id"
        class="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-(--line-1) py-4 px-6 last:border-b-0"
        :class="issue.resolvedAt && 'opacity-60'"
      >
        <div class="min-w-0 flex-1">
          <p class="m-0 text-sm font-semibold text-(--fg-1)">{{ KIND_LABEL[issue.kind] }}</p>
          <p class="m-0 mt-0.5 text-sm text-(--fg-2)">{{ issue.details }}</p>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">
            <span class="font-mono">{{ issue.reference }}</span>
            <template v-if="issue.providerTransactionId"> · provider transaction {{ issue.providerTransactionId }}</template>
            · found {{ formatDate(issue.foundAt) }}
          </p>
          <p v-if="issue.resolutionNote" class="m-0 mt-1 text-xs text-(--fg-3)">Resolved: {{ issue.resolutionNote }}</p>
        </div>
        <RaChip :tone="issue.resolvedAt ? 'neutral' : 'info'">{{ issue.resolvedAt ? 'Resolved' : 'Open' }}</RaChip>
        <Button v-if="!issue.resolvedAt" size="sm" variant="outline" @click="() => { target = issue; error = null }">Resolve</Button>
      </div>

      <ReasonDialog
        :open="target !== null"
        title="Mark as dealt with"
        label="What did you find or do?"
        confirm-label="Resolve"
        :pending="pending"
        :error="error"
        @update:open="(open) => { if (!open) target = null }"
        @submit="resolve"
      />

      <Pagination
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-count="meta?.totalCount ?? 0"
        @update:page="goToPage"
        @update:page-size="setPageSize"
      />
    </RaCard>
  </div>
</template>
