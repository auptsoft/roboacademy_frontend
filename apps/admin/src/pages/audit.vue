<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RaCard, formatDate } from '@roboacademy/ui'
import Pagination from '@/components/Pagination.vue'
import UserPreviewPopover from '@/components/UserPreviewPopover.vue'
import AuditLogFilters, { type AuditLogFilterState } from '@/components/AuditLogFilters.vue'
import { usePagedList } from '@/composables/usePagedList'
import { getIdentityAuditLog } from '@/api/identity'

const IDENTITY_ENTITY_TYPES = [
  { value: 'User', label: 'User' },
  { value: 'Department', label: 'Department' },
  { value: 'Class', label: 'Class' },
  { value: 'UserRole', label: 'User Role' },
  { value: 'ClassStudent', label: 'Class Student' },
  { value: 'ClassStaffMember', label: 'Class Staff Member' },
]

const filters = ref<AuditLogFilterState>({ userId: null, fromDate: '', toDate: '', entityType: '', action: '' })
let filterDebounce: ReturnType<typeof setTimeout> | undefined

const {
  items: entries,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList((page, pageSize) => getIdentityAuditLog(page, pageSize, filters.value), {
  initialPageSize: 20,
  errorMessage: 'Failed to load audit log.',
})

watch(filters, () => {
  clearTimeout(filterDebounce)
  filterDebounce = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
}, { deep: true })

onMounted(load)
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Audit Log</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">Recent changes to users, classes, and departments.</p>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <AuditLogFilters v-model="filters" :entity-type-options="IDENTITY_ENTITY_TYPES" />

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading activity…</p>
      <p v-else-if="entries.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">No activity recorded yet.</p>
      <ul v-else class="m-0 flex list-none flex-col p-0">
        <li
          v-for="entry in entries"
          :key="entry.id"
          class="flex items-start justify-between gap-3 border-b border-(--line-1) py-3 px-6 last:border-b-0 max-md:flex-col"
        >
          <div>
            <div class="flex flex-wrap items-center gap-1.5 text-sm text-(--fg-1)">
              <span class="font-semibold">{{ entry.action }}</span> — {{ entry.entityType }}
              <UserPreviewPopover v-if="entry.userId" :user-id="entry.userId" />
              <span v-else class="text-xs text-(--fg-4)">System</span>
            </div>
            <div v-if="entry.changes" class="mt-1 font-mono text-xs text-(--fg-4)">{{ entry.changes }}</div>
          </div>
          <span class="shrink-0 text-xs text-(--fg-3)">{{ formatDate(entry.occurredAt) }}</span>
        </li>
      </ul>

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
