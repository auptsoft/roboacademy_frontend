<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatMoney, toMinorUnits } from '@roboacademy/ui'
import { ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { ApiError } from '@/api/client'
import {
  clearTenantFee,
  describeFee,
  getTenantFee,
  listPayoutAccounts,
  setTenantFee,
  type PayoutAccount,
  type TenantFee,
} from '@/api/payments'

// A school's selling setup, for the platform admin (Payments Phase P2 §6.2): where it's paid, and
// a negotiated fee. Parts of the override left blank follow the platform default.

const props = defineProps<{ tenantId: string }>()

const open = ref(false)
const fee = ref<TenantFee | null>(null)
const account = ref<PayoutAccount | null>(null)
const saving = ref(false)
const form = reactive({ percent: '', flat: '', cap: '', notes: '' })

const naira = (minor: number) => formatMoney(minor, 'NGN')

function fill(value: TenantFee) {
  fee.value = value
  Object.assign(form, {
    percent: value.percentBps === null ? '' : String(value.percentBps / 100),
    flat: value.flatMinor === null ? '' : String(value.flatMinor / 100),
    cap: value.capMinor === null ? '' : String(value.capMinor / 100),
    notes: value.notes ?? '',
  })
}

onMounted(async () => {
  try {
    const [loadedFee, accounts] = await Promise.all([getTenantFee(props.tenantId), listPayoutAccounts(props.tenantId)])
    fill(loadedFee)
    account.value = accounts[0] ?? null
  } catch {
    // Shown as "unavailable" below.
  }
})

async function save() {
  saving.value = true
  try {
    fill(await setTenantFee(props.tenantId, {
      percentBps: form.percent.trim() === '' ? null : Math.round(Number(form.percent) * 100),
      flatMinor: form.flat.trim() === '' ? null : toMinorUnits(form.flat),
      capMinor: form.cap.trim() === '' ? null : toMinorUnits(form.cap),
      notes: form.notes.trim() || null,
    }))
    toast.success('Fee saved. New orders from this school use it.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to save the fee.')
  } finally {
    saving.value = false
  }
}

async function clear() {
  saving.value = true
  try {
    fill(await clearTenantFee(props.tenantId))
    toast.success('This school now pays the default fee.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to remove the fee override.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <RaCard id="payments" :padding="0" class="scroll-mt-6 overflow-hidden">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
        <div>
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">Course sales</h3>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">
            <template v-if="fee">Fee {{ describeFee(fee.effective, naira) }}{{ fee.isOverridden ? ' (custom)' : '' }}</template>
            <template v-if="account"> · paid into {{ account.bankName }} ending {{ account.accountNumberLast4 }}</template>
            <template v-else> · no payout account</template>
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <RaChip v-if="account" :tone="account.status === 'Active' ? 'info' : 'neutral'">{{ account.status }}</RaChip>
          <ChevronDown :size="16" class="text-(--fg-3) transition-transform duration-200" :class="open && 'rotate-180'" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form class="flex flex-col gap-4 py-5 px-6" @submit.prevent="save">
          <p class="m-0 text-xs text-(--fg-3)">Leave a field blank to use the platform default for it.</p>
          <div class="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            <div class="flex flex-col gap-1.5">
              <Label for="tenant-fee-percent">Percentage</Label>
              <Input id="tenant-fee-percent" v-model="form.percent" inputmode="decimal" placeholder="Default" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="tenant-fee-flat">Flat amount (₦)</Label>
              <Input id="tenant-fee-flat" v-model="form.flat" inputmode="decimal" placeholder="Default" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="tenant-fee-cap">At most (₦)</Label>
              <Input id="tenant-fee-cap" v-model="form.cap" inputmode="decimal" placeholder="Default" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="tenant-fee-notes">Notes</Label>
            <Input id="tenant-fee-notes" v-model="form.notes" maxlength="500" placeholder="e.g. Pilot rate agreed until March" />
          </div>
          <div class="flex justify-end gap-2">
            <Button v-if="fee?.isOverridden" type="button" variant="outline" :disabled="saving" @click="clear">Use default fee</Button>
            <Button type="submit" :disabled="saving">Save fee</Button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  </RaCard>
</template>
