<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaStatusDot } from '@roboacademy/ui'
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
import TenantMultiSelect from '@/components/TenantMultiSelect.vue'
import type { Tenant } from '@/api/tenancy'

// Generic "Copy to tenants…" dialog, reused for courses, standalone assessments, and question
// bank items - the tenant multi-select and per-target result rendering are identical across all
// three; only what gets copied differs, supplied by the caller as copyFn. copyFn is expected to
// call the copy-to-tenants endpoint and never throw for an individual target's failure - the
// backend reports one result per target so one tenant failing doesn't stop the others.
export interface CopyTargetResult {
  tenantId: string
  isSuccessful: boolean
  error: string | null
  warnings?: string[]
}

const props = defineProps<{
  open: boolean
  title: string
  description?: string
  copyFn: (targetTenantIds: string[]) => Promise<CopyTargetResult[]>
}>()
const emit = defineEmits<{ 'update:open': [boolean]; completed: [] }>()

const selected = ref<Tenant[]>([])
const submitting = ref(false)
const results = ref<CopyTargetResult[] | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      selected.value = []
      results.value = null
    }
  },
)

function tenantName(tenantId: string): string {
  return selected.value.find((t) => t.tenantId === tenantId)?.name ?? tenantId
}

async function submit() {
  if (selected.value.length === 0) return
  submitting.value = true
  try {
    const targetIds = selected.value.map((t) => t.tenantId)
    results.value = await props.copyFn(targetIds)
    if (results.value.some((r) => r.isSuccessful)) {
      emit('completed')
    }
    if (results.value.every((r) => r.isSuccessful)) {
      toast.success('Copied to every selected tenant.')
    } else {
      toast.error('Some tenants failed — see details below.')
    }
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to copy.')
  } finally {
    submitting.value = false
  }
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>

      <div v-if="!results" class="flex flex-col gap-4">
        <TenantMultiSelect v-model="selected" />
        <DialogFooter>
          <Button variant="outline" type="button" @click="close">Cancel</Button>
          <Button type="button" :disabled="submitting || selected.length === 0" @click="submit">
            {{ submitting ? 'Copying…' : `Copy to ${selected.length || ''} tenant${selected.length === 1 ? '' : 's'}`.trim() }}
          </Button>
        </DialogFooter>
      </div>

      <div v-else class="flex flex-col gap-4">
        <div class="flex flex-col gap-2 max-h-80 overflow-y-auto">
          <div v-for="result in results" :key="result.tenantId" class="rounded-(--ra-md) border border-(--line-1) p-3">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold text-(--fg-1)">{{ tenantName(result.tenantId) }}</span>
              <RaStatusDot
                :status="result.isSuccessful ? 'active' : 'busy'"
                :label="result.isSuccessful ? 'Copied' : 'Failed'"
              />
            </div>
            <p v-if="result.error" class="m-0 mt-1 text-xs text-(--danger)">{{ result.error }}</p>
            <p v-for="warning in result.warnings" :key="warning" class="m-0 mt-1 text-xs text-(--fg-3)">
              {{ warning }}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" @click="close">Done</Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
