<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate, formatMoney } from '@roboacademy/ui'
import { Download, MoreVertical } from 'lucide-vue-next'
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
  downloadSalesCsv,
  getEarnings,
  listSales,
  requestRefund,
  type Earnings,
  type OrderStatus,
  type Sale,
} from '@/api/payments'

// A school's course sales (Payments Phase P2 §6.1): totals for a period, then every order. Net is
// what reaches the school's bank - Paystack pays it directly.

type Period = 'month' | '30d' | 'all'

const filters = reactive<{ period: Period; status: OrderStatus | ''; search: string }>({ period: 'month', status: 'Paid', search: '' })

const range = computed(() => {
  const now = new Date()
  if (filters.period === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() }
  if (filters.period === '30d') return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString() }
  return {}
})

const query = computed(() => ({ ...range.value, status: filters.status || undefined, search: filters.search.trim() || undefined }))

const { items: sales, loading, page, pageSize, meta, totalPages, load, goToPage, setPageSize } = usePagedList(
  (page, pageSize) => listSales(query.value, page, pageSize),
  { initialPageSize: 20, errorMessage: 'Failed to load sales.' },
)

const earnings = ref<Earnings | null>(null)

async function loadEarnings() {
  try {
    earnings.value = await getEarnings(range.value)
  } catch {
    earnings.value = null
  }
}

onMounted(() => {
  load()
  loadEarnings()
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(() => [filters.period, filters.status], () => {
  page.value = 1
  load()
  loadEarnings()
})
watch(() => filters.search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})

const exporting = ref(false)

async function exportCsv() {
  exporting.value = true
  try {
    await downloadSalesCsv(query.value)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to export sales.')
  } finally {
    exporting.value = false
  }
}

// --- Refund requests (Phase P3): RoboAcademy approves, then the learner is refunded. ---
const refundTarget = ref<Sale | null>(null)
const refunding = ref(false)
const refundError = ref<string | null>(null)

function openRefund(sale: Sale) {
  refundTarget.value = sale
  refundError.value = null
}

async function submitRefund(reason: string) {
  if (!refundTarget.value) return
  refunding.value = true
  refundError.value = null
  try {
    await requestRefund(refundTarget.value.id, reason)
    toast.success('Refund requested. RoboAcademy will review it and email you.')
    refundTarget.value = null
    await load()
  } catch (error) {
    refundError.value = error instanceof ApiError ? error.message : 'Failed to request the refund.'
  } finally {
    refunding.value = false
  }
}

function saleLabel(sale: Sale): string {
  if (sale.disputeStatus === 'Open') return 'Disputed'
  if (sale.status === 'Paid' && sale.refundStatus && sale.refundStatus !== 'Rejected') return REFUND_STATUS_LABEL[sale.refundStatus]
  return sale.status
}

const menuTriggerClass =
  'inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50'

const money = (minor: number) => formatMoney(minor, earnings.value?.currency ?? 'NGN')

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
const columns = 'grid grid-cols-[1.5fr_1.3fr_110px_110px_110px_130px_130px_44px] items-center gap-3'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Sales</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Your course sales. Paystack pays your share into your payout account on its normal schedule.</p>
      </div>
      <Button variant="outline" :disabled="exporting" @click="exportCsv">
        <Download :size="14" /> Export CSV
      </Button>
    </div>

    <div v-if="earnings" class="grid grid-cols-4 gap-4 max-md:grid-cols-2">
      <RaCard :padding="20">
        <p class="m-0 text-xs text-(--fg-3)">Sales</p>
        <p class="m-0 mt-1 text-2xl font-bold text-(--fg-1)">{{ earnings.sales }}</p>
      </RaCard>
      <RaCard :padding="20">
        <p class="m-0 text-xs text-(--fg-3)">Paid by learners</p>
        <p class="m-0 mt-1 text-2xl font-bold text-(--fg-1)">{{ money(earnings.grossMinor) }}</p>
      </RaCard>
      <RaCard :padding="20">
        <p class="m-0 text-xs text-(--fg-3)">Fees (RoboAcademy + Paystack)</p>
        <p class="m-0 mt-1 text-2xl font-bold text-(--fg-1)">{{ money(earnings.platformFeeMinor + earnings.providerFeeMinor) }}</p>
      </RaCard>
      <RaCard :padding="20">
        <p class="m-0 text-xs text-(--fg-3)">Your share</p>
        <p class="m-0 mt-1 text-2xl font-bold text-(--fg-1)">{{ money(earnings.netMinor) }}</p>
      </RaCard>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6 max-sm:px-4">
        <select v-model="filters.period" :class="selectClass" aria-label="Period">
          <option value="month">This month</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <select v-model="filters.status" :class="selectClass" aria-label="Status">
          <option value="Paid">Paid</option>
          <option value="">Any status</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
          <option value="Abandoned">Abandoned</option>
          <option value="Refunded">Refunded</option>
        </select>
        <Input v-model="filters.search" class="max-w-64" placeholder="Reference or course" aria-label="Search sales" />
      </div>

      <div :class="[columns, 'border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-lg:hidden']">
        <span>Course</span>
        <span>Learner</span>
        <span>Price</span>
        <span>Fees</span>
        <span>Your share</span>
        <span>Status</span>
        <span>Date</span>
        <span />
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading sales…</p>
      <p v-else-if="sales.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No sales yet.</p>

      <div
        v-for="(sale, i) in sales"
        :key="sale.id"
        :class="[columns, 'py-3.5 px-6 max-lg:flex max-lg:flex-wrap max-lg:gap-x-4 max-lg:gap-y-1 max-lg:p-4', i < sales.length - 1 && 'border-b border-(--line-1)']"
      >
        <div class="flex min-w-0 flex-col gap-0.5 max-lg:w-full">
          <span class="truncate text-sm font-semibold text-(--fg-1)">{{ sale.courseTitle }}</span>
          <span class="truncate font-mono text-[11px] text-(--fg-4)">{{ sale.reference }}</span>
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="truncate text-sm text-(--fg-1)">{{ sale.buyerName ?? 'Unknown learner' }}</span>
          <span class="truncate text-xs text-(--fg-3)">{{ sale.buyerEmail }}</span>
        </div>
        <span class="text-sm text-(--fg-1)">{{ formatMoney(sale.amountMinor, sale.currency) }}</span>
        <span class="text-sm text-(--fg-2)">{{ formatMoney(sale.platformFeeMinor + (sale.providerFeeMinor ?? 0), sale.currency) }}</span>
        <span class="text-sm font-semibold text-(--fg-1)">{{ sale.netMinor === null ? '—' : formatMoney(sale.netMinor, sale.currency) }}</span>
        <div><RaChip :tone="sale.status === 'Paid' && sale.disputeStatus !== 'Open' ? 'info' : 'neutral'">{{ saleLabel(sale) }}</RaChip></div>
        <span class="text-sm text-(--fg-2)">{{ formatDate(sale.paidAt ?? sale.createdAt) }}</span>
        <div class="flex justify-end">
          <DropdownMenu v-if="canRequestRefund(sale)">
            <DropdownMenuTrigger :class="menuTriggerClass">
              <MoreVertical :size="16" />
              <span class="sr-only">Actions for {{ sale.reference }}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="openRefund(sale)">Request refund</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ReasonDialog
        :open="refundTarget !== null"
        title="Request a refund"
        :description="refundTarget ? `RoboAcademy reviews every refund. If approved, the learner gets back ${formatMoney(refundTarget.amountMinor, refundTarget.currency)} and loses access to ${refundTarget.courseTitle}.` : undefined"
        label="Why should this be refunded?"
        confirm-label="Request refund"
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
