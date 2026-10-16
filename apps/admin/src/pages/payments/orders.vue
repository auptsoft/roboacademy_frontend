<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate, formatMoney } from '@roboacademy/ui'
import { MoreVertical } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Pagination from '@/components/Pagination.vue'
import ReasonDialog from '@/components/ReasonDialog.vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import {
  REFUND_STATUS_LABEL,
  canRequestRefund,
  listPlatformOrders,
  refundOrder,
  type OrderStatus,
  type PlatformOrder,
} from '@/api/payments'

// Every course order across all tenants (Payments Phases P1-P3), for support and spotting
// problems. A paid order can be refunded from its menu; disputes are answered in the provider's
// dashboard and show here as they change.

const filters = reactive<{ status: OrderStatus | ''; search: string; issuesOnly: boolean; disputedOnly: boolean }>({
  status: '', search: '', issuesOnly: false, disputedOnly: false,
})

const { items: orders, loading, page, pageSize, meta, totalPages, load, goToPage, setPageSize } = usePagedList(
  (page, pageSize) => listPlatformOrders(
    {
      status: filters.status || undefined, search: filters.search.trim() || undefined,
      issuesOnly: filters.issuesOnly, disputedOnly: filters.disputedOnly,
    },
    page,
    pageSize,
  ),
  { initialPageSize: 20, errorMessage: 'Failed to load orders.' },
)

onMounted(load)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(() => [filters.status, filters.issuesOnly, filters.disputedOnly], () => {
  page.value = 1
  load()
})
watch(() => filters.search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})

function clearFilters() {
  Object.assign(filters, { status: '', search: '', issuesOnly: false, disputedOnly: false })
}

function statusTone(order: PlatformOrder): 'info' | 'neutral' {
  return order.status === 'Paid' && order.disputeStatus !== 'Open' ? 'info' : 'neutral'
}

function statusLabel(order: PlatformOrder): string {
  if (order.disputeStatus === 'Open') return 'Disputed'
  if (order.status === 'Paid' && (order.refundStatus === 'Requested' || order.refundStatus === 'Processing' || order.refundStatus === 'Failed')) {
    return REFUND_STATUS_LABEL[order.refundStatus]
  }
  return order.status
}

// --- Refund straight away (Phase P3) ---
const refundTarget = ref<PlatformOrder | null>(null)
const refunding = ref(false)
const refundError = ref<string | null>(null)

function openRefund(order: PlatformOrder) {
  refundTarget.value = order
  refundError.value = null
}

async function submitRefund(reason: string) {
  if (!refundTarget.value) return
  refunding.value = true
  refundError.value = null
  try {
    const result = await refundOrder(refundTarget.value.id, reason)
    if (result.status === 'Failed') {
      refundError.value = result.failureReason ?? 'The payment provider refused the refund.'
    } else {
      toast.success(result.status === 'Completed' ? 'Refunded.' : 'Refund sent. It completes when the provider confirms.')
      refundTarget.value = null
    }
    await load()
  } catch (error) {
    refundError.value = error instanceof ApiError ? error.message : 'Failed to refund.'
  } finally {
    refunding.value = false
  }
}

const menuTriggerClass =
  'inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50'

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'

const columns = 'grid grid-cols-[1.6fr_1.4fr_120px_140px_150px_44px] items-center gap-3'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Orders</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Course purchases across every school. Refund a paid order from its menu; schools' refund requests are under Refunds.
      </p>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6 max-sm:px-4">
        <Input v-model="filters.search" class="max-w-64" placeholder="Reference or course" aria-label="Search orders" />
        <select v-model="filters.status" :class="selectClass" aria-label="Status">
          <option value="">Any status</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
          <option value="Abandoned">Abandoned</option>
          <option value="Refunded">Refunded</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-(--fg-2)">
          <input v-model="filters.issuesOnly" type="checkbox" class="size-4 accent-(--brand-blue)">
          Needs attention
        </label>
        <label class="flex items-center gap-2 text-sm text-(--fg-2)">
          <input v-model="filters.disputedOnly" type="checkbox" class="size-4 accent-(--brand-blue)">
          Disputed
        </label>
        <Button
          v-if="filters.status || filters.search || filters.issuesOnly || filters.disputedOnly"
          variant="ghost"
          size="sm"
          @click="clearFilters"
        >Clear filters</Button>
      </div>

      <div :class="[columns, 'border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden']">
        <span>Course</span>
        <span>Buyer</span>
        <span>Amount</span>
        <span>Status</span>
        <span>Date</span>
        <span />
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading orders…</p>
      <p v-else-if="orders.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No orders found.</p>

      <div
        v-for="(order, i) in orders"
        :key="order.id"
        :class="[columns, 'py-3.5 px-6 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4', i < orders.length - 1 && 'border-b border-(--line-1)']"
      >
        <div class="flex min-w-0 flex-col gap-0.5 max-md:w-full">
          <span class="truncate text-sm font-semibold text-(--fg-1)">{{ order.courseTitle }}</span>
          <span class="truncate font-mono text-[11px] text-(--fg-4)" :title="order.providerTransactionId ?? undefined">{{ order.reference }}</span>
          <span v-if="order.issue" class="text-xs text-(--danger)">{{ order.issue }}</span>
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="truncate text-sm text-(--fg-1)">{{ order.buyerName ?? 'Unknown learner' }}</span>
          <span class="truncate text-xs text-(--fg-3)">{{ order.buyerEmail ?? order.userId }}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-sm text-(--fg-1)">{{ formatMoney(order.amountMinor, order.currency) }}</span>
          <span v-if="order.providerFeeMinor !== null" class="text-[11px] text-(--fg-4)">
            Fee {{ formatMoney(order.providerFeeMinor, order.currency) }}
          </span>
        </div>
        <div class="flex flex-col items-start gap-1">
          <RaChip :tone="statusTone(order)">{{ statusLabel(order) }}</RaChip>
          <span v-if="order.disputeStatus && order.disputeStatus !== 'Open'" class="text-[11px] text-(--fg-4)">
            Dispute {{ order.disputeStatus.toLowerCase() }}
          </span>
        </div>
        <div class="text-sm text-(--fg-2)">{{ formatDate(order.refundedAt ?? order.paidAt ?? order.createdAt) }}</div>
        <div class="flex justify-end">
          <DropdownMenu v-if="canRequestRefund(order)">
            <DropdownMenuTrigger :class="menuTriggerClass">
              <MoreVertical :size="16" />
              <span class="sr-only">Actions for {{ order.reference }}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="openRefund(order)">Refund…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ReasonDialog
        :open="refundTarget !== null"
        title="Refund this order"
        :description="refundTarget ? `${refundTarget.buyerName ?? 'The learner'} gets back ${formatMoney(refundTarget.amountMinor, refundTarget.currency)} and loses access to ${refundTarget.courseTitle}, unless it was also assigned to them.` : undefined"
        label="Reason (kept with the order)"
        confirm-label="Refund"
        destructive
        :pending="refunding"
        :error="refundError"
        @update:open="(open) => { if (!open) refundTarget = null }"
        @submit="submitRefund"
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
