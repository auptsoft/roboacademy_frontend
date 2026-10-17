<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate, formatMoney } from '@roboacademy/ui'
import { Button } from '@/components/ui/button'
import Pagination from '@/components/Pagination.vue'
import ReasonDialog from '@/components/ReasonDialog.vue'
import { ApiError } from '@/api/client'
import { listTenants } from '@/api/tenancy'
import { usePagedList } from '@/composables/usePagedList'
import {
  REFUND_STATUS_LABEL,
  approveRefund,
  listRefundRequests,
  rejectRefund,
  type RefundRequest,
  type RefundRequestStatus,
} from '@/api/payments'

// Schools' refund requests (Payments Phase P3 §3.2). Refunds on split payments come out of the
// platform's provider balance, so only a platform admin approves them. Approving sends the refund
// to the provider straight away; it completes when the provider confirms.

const status = ref<RefundRequestStatus | ''>('')
const { items: requests, loading, page, pageSize, meta, totalPages, load, goToPage, setPageSize } = usePagedList(
  (page, pageSize) => listRefundRequests(status.value, page, pageSize),
  { initialPageSize: 20, errorMessage: 'Failed to load refund requests.' },
)

const tenantNames = ref<Record<string, string>>({})

onMounted(async () => {
  load()
  try {
    tenantNames.value = Object.fromEntries((await listTenants(1, 200)).items.map((t) => [t.tenantId, t.name]))
  } catch {
    // Names are a nicety; ids still show.
  }
})

watch(status, () => {
  page.value = 1
  load()
})

type Decision = { request: RefundRequest; approve: boolean }
const decision = ref<Decision | null>(null)
const pending = ref(false)
const error = ref<string | null>(null)

function decide(request: RefundRequest, approve: boolean) {
  decision.value = { request, approve }
  error.value = null
}

async function submit(note: string) {
  if (!decision.value) return
  const { request, approve } = decision.value
  pending.value = true
  error.value = null
  try {
    const result = approve ? await approveRefund(request.id, note || null) : await rejectRefund(request.id, note)
    if (result.status === 'Failed') {
      error.value = result.failureReason ?? 'The payment provider refused the refund.'
    } else {
      toast.success(approve
        ? result.status === 'Completed' ? 'Refunded.' : 'Refund sent. It completes when the provider confirms.'
        : 'Refund request declined.')
      decision.value = null
    }
    await load()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong.'
  } finally {
    pending.value = false
  }
}

function tone(s: RefundRequestStatus): 'info' | 'neutral' {
  return s === 'Requested' || s === 'Failed' ? 'info' : 'neutral'
}

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Refunds</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Schools ask; you decide. Approving refunds the learner in full through the payment provider, and the learner loses
        access unless the course was also assigned to them.
      </p>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6 max-sm:px-4">
        <select v-model="status" :class="selectClass" aria-label="Status">
          <option value="">Waiting first</option>
          <option value="Requested">Requested</option>
          <option value="Processing">Processing</option>
          <option value="Failed">Failed</option>
          <option value="Completed">Completed</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading refunds…</p>
      <p v-else-if="requests.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No refund requests.</p>

      <div
        v-for="request in requests"
        :key="request.id"
        class="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-(--line-1) py-4 px-6 last:border-b-0"
      >
        <div class="min-w-0 flex-1">
          <p class="m-0 text-sm font-semibold text-(--fg-1)">
            {{ request.courseTitle }} · {{ formatMoney(request.amountMinor, request.currency) }}
          </p>
          <p class="m-0 text-xs text-(--fg-3)">
            {{ tenantNames[request.tenantId] ?? request.tenantId }} · {{ request.requestedByName ?? 'Payment provider' }} ·
            {{ formatDate(request.createdAt) }} · <span class="font-mono">{{ request.reference }}</span>
          </p>
          <p class="m-0 mt-1.5 text-sm text-(--fg-2)">“{{ request.reason }}”</p>
          <p v-if="request.decisionNote" class="m-0 mt-1 text-xs text-(--fg-3)">Note: {{ request.decisionNote }}</p>
          <p v-if="request.failureReason" class="m-0 mt-1 text-xs text-(--danger)">{{ request.failureReason }}</p>
        </div>
        <RaChip :tone="tone(request.status)">{{ REFUND_STATUS_LABEL[request.status] }}</RaChip>
        <div v-if="request.status === 'Requested' || request.status === 'Failed'" class="flex gap-2">
          <Button size="sm" variant="outline" :disabled="pending" @click="decide(request, false)">Decline</Button>
          <Button size="sm" :disabled="pending" @click="decide(request, true)">{{ request.status === 'Failed' ? 'Retry refund' : 'Approve' }}</Button>
        </div>
      </div>

      <ReasonDialog
        :open="decision !== null"
        :title="decision?.approve ? 'Approve this refund' : 'Decline this refund'"
        :description="decision ? `${decision.request.courseTitle}: ${formatMoney(decision.request.amountMinor, decision.request.currency)} back to the learner.` : undefined"
        :label="decision?.approve ? 'Note for the school (optional)' : 'Why not? The school sees this.'"
        :confirm-label="decision?.approve ? 'Refund the learner' : 'Decline'"
        :required="!decision?.approve"
        :destructive="decision?.approve"
        :pending="pending"
        :error="error"
        @update:open="(open) => { if (!open) decision = null }"
        @submit="submit"
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
