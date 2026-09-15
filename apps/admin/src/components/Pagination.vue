<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const props = withDefaults(
  defineProps<{
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
    pageSizeOptions?: number[]
  }>(),
  {
    pageSizeOptions: () => [10, 20, 50, 100],
  },
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [pageSize: number]
}>()

// Always show first, last, current ±1, with an ellipsis for any gap — e.g. 1 … 4 [5] 6 … 12.
function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)

  const result: (number | 'ellipsis')[] = []
  let previous = 0
  for (const p of sorted) {
    if (previous && p - previous > 1) result.push('ellipsis')
    result.push(p)
    previous = p
  }
  return result
}

const pageList = computed(() => buildPageList(props.page, props.totalPages))
</script>

<template>
  <div
    v-if="totalCount > 0"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-(--line-1) py-3 px-6 max-sm:flex-col max-sm:items-stretch"
  >
    <div class="flex items-center gap-2 text-xs text-(--fg-3)">
      <span>{{ totalCount }} total</span>
      <label class="flex items-center gap-1.5">
        <span>Rows per page</span>
        <select
          class="rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-1.5 py-1 text-xs text-(--fg-2) outline-none"
          :value="pageSize"
          @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
    </div>

    <div v-if="totalPages > 1" class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="page <= 1"
        aria-label="Previous page"
        @click="emit('update:page', page - 1)"
      >
        <ChevronLeft :size="14" />
      </Button>

      <template v-for="(item, i) in pageList" :key="i">
        <span v-if="item === 'ellipsis'" class="px-1.5 text-xs text-(--fg-4)">…</span>
        <Button
          v-else
          :variant="item === page ? 'secondary' : 'ghost'"
          size="icon-sm"
          class="text-xs"
          @click="emit('update:page', item)"
        >
          {{ item }}
        </Button>
      </template>

      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="page >= totalPages"
        aria-label="Next page"
        @click="emit('update:page', page + 1)"
      >
        <ChevronRight :size="14" />
      </Button>
    </div>
  </div>
</template>
