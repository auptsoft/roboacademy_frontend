<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'

// String-only for now (see callers) - values are typed as string throughout rather than
// `unknown`/`object`, deliberately narrower than what the underlying storage (e.g. a jsonb
// column) could actually hold.
const model = defineModel<Record<string, string>>({ required: true })

interface Row {
  key: string
  value: string
}

function toRows(record: Record<string, string>): Row[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }))
}

// Blank/duplicate keys are dropped when flattening back to a record - only the last row with
// a given key survives, matching plain object-literal semantics.
function toRecord(rows: Row[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const row of rows) {
    if (row.key.trim()) result[row.key.trim()] = row.value
  }
  return result
}

const rows = ref<Row[]>(toRows(model.value))

// Resyncs from the outside only when the incoming model doesn't already match what these
// rows would themselves produce - otherwise every keystroke's own write-back (sync() below)
// would immediately bounce back and clobber in-progress edits (e.g. a key not yet blurred).
watch(model, (next) => {
  if (JSON.stringify(toRecord(rows.value)) !== JSON.stringify(next)) {
    rows.value = toRows(next)
  }
})

function sync() {
  model.value = toRecord(rows.value)
}

function addRow() {
  rows.value.push({ key: '', value: '' })
}

function removeRow(index: number) {
  rows.value.splice(index, 1)
  sync()
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(row, index) in rows" :key="index" class="flex items-center gap-2">
      <Input v-model="row.key" placeholder="Key" class="flex-1" @input="sync" />
      <Input v-model="row.value" placeholder="Value" class="flex-1" @input="sync" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Remove property"
        @click="removeRow(index)"
      >
        <Trash2 :size="14" />
      </Button>
    </div>
    <Button variant="outline" size="sm" type="button" class="self-start" @click="addRow">
      <Plus :size="14" /> Add Property
    </Button>
    <p v-if="rows.length === 0" class="m-0 text-xs text-(--fg-4)">No extra properties yet.</p>
  </div>
</template>
