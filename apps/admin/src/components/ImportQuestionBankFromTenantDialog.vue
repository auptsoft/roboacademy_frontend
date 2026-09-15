<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import TenantComboBox from '@/components/TenantComboBox.vue'
import {
  listTenantQuestionBank,
  importQuestionBankItemsFromTenant,
  type QuestionBankItemSummary,
} from '@/api/assessment'

const PLATFORM_TENANT_ID = import.meta.env.VITE_PLATFORM_TENANT_ID

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean]; imported: [count: number] }>()

const sourceTenantId = ref<string | null>(null)
const items = ref<QuestionBankItemSummary[]>([])
const selectedIds = ref<Set<string>>(new Set())
const loading = ref(false)
const submitting = ref(false)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    sourceTenantId.value = null
    items.value = []
    selectedIds.value = new Set()
  }
})

watch(sourceTenantId, async () => {
  items.value = []
  selectedIds.value = new Set()
  if (!sourceTenantId.value) return
  loading.value = true
  try {
    const result = await listTenantQuestionBank(sourceTenantId.value, undefined, 1, 100)
    items.value = result.items
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : "Failed to load the source tenant's question bank.")
  } finally {
    loading.value = false
  }
})

function toggle(itemId: string) {
  const next = new Set(selectedIds.value)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  selectedIds.value = next
}

async function submit() {
  if (!sourceTenantId.value || selectedIds.value.size === 0) return
  submitting.value = true
  try {
    const result = await importQuestionBankItemsFromTenant({
      sourceTenantId: sourceTenantId.value,
      itemIds: [...selectedIds.value],
    })
    toast.success(`Imported ${result.itemsImported} question${result.itemsImported === 1 ? '' : 's'}.`)
    emit('imported', result.itemsImported)
    emit('update:open', false)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to import questions.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>Import questions from tenant</DialogTitle>
        <DialogDescription>Pull question bank items from another tenant into the platform's question bank.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <TenantComboBox v-model="sourceTenantId" :exclude-tenant-id="PLATFORM_TENANT_ID" />

        <template v-if="sourceTenantId">
          <div class="flex flex-col gap-2 max-h-80 overflow-y-auto">
            <p v-if="loading" class="p-3 text-center text-[13px] text-(--fg-3)">Loading question bank…</p>
            <p v-else-if="items.length === 0" class="p-3 text-center text-[13px] text-(--fg-3)">No questions found.</p>
            <label
              v-for="item in items"
              :key="item.id"
              class="flex cursor-pointer items-start gap-3 rounded-(--ra-md) border border-(--line-1) p-3"
            >
              <input
                type="checkbox"
                :checked="selectedIds.has(item.id)"
                class="mt-1"
                @change="toggle(item.id)"
              />
              <div>
                <div class="text-sm font-semibold text-(--fg-1)">{{ item.text }}</div>
                <div class="mt-0.5 text-xs text-(--fg-3)">{{ item.optionCount }} options</div>
              </div>
            </label>
          </div>
        </template>
      </div>

      <DialogFooter>
        <Button variant="outline" type="button" @click="emit('update:open', false)">Cancel</Button>
        <Button type="button" :disabled="submitting || selectedIds.size === 0" @click="submit">
          {{ submitting ? 'Importing…' : `Import ${selectedIds.size || ''} question${selectedIds.size === 1 ? '' : 's'}`.trim() }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
