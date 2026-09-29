<script setup lang="ts" generic="T">
// Table with the navy rounded header row used across the learner dashboard.
// Cells render via a `cell-<key>` slot, falling back to the raw value.
export interface DataTableColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

const props = defineProps<{
  columns: DataTableColumn[]
  rows: T[]
  rowKey: (row: T, index: number) => string
}>()
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <th
            v-for="(col, i) in props.columns"
            :key="col.key"
            scope="col"
            class="bg-(--brand-navy) text-(--brand-navy-fg) font-semibold tracking-wide px-6 py-3.5"
            :class="[
              col.align === 'right' ? 'text-right' : 'text-left',
              i === 0 ? 'rounded-l-(--ra-lg)' : '',
              i === props.columns.length - 1 ? 'rounded-r-(--ra-lg)' : '',
            ]"
          >{{ col.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, r) in props.rows" :key="props.rowKey(row, r)">
          <td
            v-for="col in props.columns"
            :key="col.key"
            class="px-6 py-5 border-b border-(--line-2) text-(--fg-2)"
            :class="col.align === 'right' ? 'text-right' : 'text-left'"
          >
            <slot :name="`cell-${col.key}`" :row="row">{{ (row as Record<string, unknown>)[col.key] }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
