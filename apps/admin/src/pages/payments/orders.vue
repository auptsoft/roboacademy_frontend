<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue'
import { RaCard, RaChip, formatDate, formatMoney } from '@roboacademy/ui'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Pagination from '@/components/Pagination.vue'
import { usePagedList } from '@/composables/usePagedList'
import { listPlatformOrders, type OrderStatus, type PlatformOrder } from '@/api/payments'

// Every course order across all tenants (Payments Phase P1), for support and spotting problems.
// Read-only: refunds are made in the provider's dashboard until Phase P3.

const filters = reactive<{ status: OrderStatus | ''; search: string; issuesOnly: boolean }>({
  status: '', search: '', issuesOnly: false,
})

const { items: orders, loading, page, pageSize, meta, totalPages, load, goToPage, setPageSize } = usePagedList(
  (page, pageSize) => listPlatformOrders(
    { status: filters.status || undefined, search: filters.search.trim() || undefined, issuesOnly: filters.issuesOnly },
    page,
    pageSize,
  ),
  { initialPageSize: 20, errorMessage: 'Failed to load orders.' },
)

onMounted(load)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(() => [filters.status, filters.issuesOnly], () => {
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
  Object.assign(filters, { status: '', search: '', issuesOnly: false })
}

function statusTone(order: PlatformOrder): 'info' | 'neutral' {
  return order.status === 'Paid' ? 'info' : 'neutral'
}

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'

const columns = 'grid grid-cols-[1.6fr_1.4fr_120px_100px_150px] items-center gap-3'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Orders</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Course purchases across every school. Refunds are made in the payment provider's dashboard for now.
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
        </select>
        <label class="flex items-center gap-2 text-sm text-(--fg-2)">
          <input v-model="filters.issuesOnly" type="checkbox" class="size-4 accent-(--brand-blue)">
          Needs attention
        </label>
        <Button
          v-if="filters.status || filters.search || filters.issuesOnly"
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
        <div><RaChip :tone="statusTone(order)">{{ order.status }}</RaChip></div>
        <div class="text-sm text-(--fg-2)">{{ formatDate(order.paidAt ?? order.createdAt) }}</div>
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
  </div>
</template>
