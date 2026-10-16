<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate, formatMoney, toMinorUnits } from '@roboacademy/ui'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { ApiError } from '@/api/client'
import { listTenants } from '@/api/tenancy'
import {
  describeFee,
  getPlatformFees,
  listPayoutAccounts,
  setPayoutAccountEnabled,
  setPlatformFees,
  type FeeBearer,
  type PayoutAccount,
  type PlatformFees,
} from '@/api/payments'

// The platform side of schools selling (Payments Phase P2 §6.2): the default fee on every sale,
// and every school's payout account, which can be paused if something looks wrong (e.g. an
// unexpected bank change - platform admins are emailed about every one).

const fees = ref<PlatformFees | null>(null)
const accounts = ref<PayoutAccount[]>([])
const tenantNames = ref<Record<string, string>>({})
const loading = ref(true)
const pending = ref(false)

const form = reactive({ percent: '', flat: '', cap: '', bearer: 'Tenant' as FeeBearer })

async function load() {
  loading.value = true
  try {
    const [loadedFees, loadedAccounts, tenants] = await Promise.all([
      getPlatformFees(), listPayoutAccounts(), listTenants(1, 200).catch(() => ({ items: [] })),
    ])
    fees.value = loadedFees
    accounts.value = loadedAccounts
    tenantNames.value = Object.fromEntries(tenants.items.map((t) => [t.tenantId, t.name]))
    Object.assign(form, {
      percent: String(loadedFees.percentBps / 100),
      flat: loadedFees.flatMinor ? String(loadedFees.flatMinor / 100) : '',
      cap: loadedFees.capMinor ? String(loadedFees.capMinor / 100) : '',
      bearer: loadedFees.bearer,
    })
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load payouts.')
  } finally {
    loading.value = false
  }
}

onMounted(load)

const percentBps = computed(() => {
  const value = Number(form.percent)
  return form.percent.trim() !== '' && Number.isFinite(value) ? Math.round(value * 100) : null
})

async function saveFees() {
  if (percentBps.value === null) return
  if (!window.confirm('Change the fee on every school\'s new sales? Orders already started keep their fee.')) return
  pending.value = true
  try {
    fees.value = await setPlatformFees({
      percentBps: percentBps.value,
      flatMinor: toMinorUnits(form.flat) ?? 0,
      capMinor: toMinorUnits(form.cap),
      bearer: form.bearer,
    })
    toast.success('Fees updated.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to save fees.')
  } finally {
    pending.value = false
  }
}

async function toggle(account: PayoutAccount) {
  const enable = account.status === 'Disabled'
  const school = tenantNames.value[account.tenantId] ?? 'this school'
  if (!enable && !window.confirm(`Pause payouts for ${school}? Its courses keep their prices, but learners can't buy them until you resume.`)) return
  pending.value = true
  try {
    const updated = await setPayoutAccountEnabled(account.id, enable)
    accounts.value = accounts.value.map((a) => (a.id === updated.id ? updated : a))
    toast.success(enable ? `Payouts resumed for ${school}.` : `Payouts paused for ${school}.`)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Something went wrong.')
  } finally {
    pending.value = false
  }
}

const naira = (minor: number) => formatMoney(minor, 'NGN')
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Fees & Payouts</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        What RoboAcademy keeps from schools' course sales, and where each school is paid. Paystack splits every
        payment, so schools' money never passes through RoboAcademy.
      </p>
    </div>

    <p v-if="loading" class="m-0 text-center text-[13px] text-(--fg-3)">Loading…</p>

    <template v-else-if="fees">
      <RaCard :padding="0" class="overflow-hidden">
        <div class="border-b border-(--line-1) py-5 px-6">
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">Platform fee</h3>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">
            Currently {{ describeFee(fees, naira) }} · changed {{ formatDate(fees.updatedAt) }}. Set a different fee for one school on its setup page.
          </p>
        </div>
        <form class="flex flex-col gap-4 py-5 px-6" @submit.prevent="saveFees">
          <div class="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <div class="flex flex-col gap-1.5">
              <Label for="fee-percent">Percentage of each sale</Label>
              <Input id="fee-percent" v-model="form.percent" inputmode="decimal" placeholder="5" required />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="fee-flat">Plus a flat amount (₦)</Label>
              <Input id="fee-flat" v-model="form.flat" inputmode="decimal" placeholder="0" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="fee-cap">At most (₦)</Label>
              <Input id="fee-cap" v-model="form.cap" inputmode="decimal" placeholder="No cap" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="fee-bearer">Paystack's fee paid by</Label>
              <select id="fee-bearer" v-model="form.bearer" class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none">
                <option value="Tenant">The school</option>
                <option value="Platform">RoboAcademy</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end">
            <Button type="submit" :disabled="pending || percentBps === null">Save fee</Button>
          </div>
        </form>
      </RaCard>

      <RaCard :padding="0" class="overflow-hidden">
        <div class="border-b border-(--line-1) py-5 px-6">
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">Payout accounts</h3>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">Schools set these up themselves under Payments → Payouts.</p>
        </div>
        <p v-if="accounts.length === 0" class="m-0 p-6 text-center text-[13px] text-(--fg-3)">No school has set up payouts yet.</p>
        <div
          v-for="account in accounts"
          :key="account.id"
          class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-(--line-1) py-3.5 px-6 last:border-b-0"
        >
          <div class="min-w-0 flex-1">
            <p class="m-0 text-sm font-semibold text-(--fg-1)">{{ tenantNames[account.tenantId] ?? account.tenantId }}</p>
            <p class="m-0 text-xs text-(--fg-3)">
              {{ account.accountName }} · {{ account.bankName }} ending {{ account.accountNumberLast4 }} · updated {{ formatDate(account.updatedAt) }}
            </p>
            <p v-if="account.failureReason" class="m-0 text-xs text-(--danger)">{{ account.failureReason }}</p>
          </div>
          <RaChip :tone="account.status === 'Active' ? 'info' : 'neutral'">{{ account.status }}</RaChip>
          <Button
            v-if="account.status === 'Active' || account.status === 'Disabled'"
            size="sm"
            variant="outline"
            :disabled="pending"
            @click="toggle(account)"
          >{{ account.status === 'Disabled' ? 'Resume' : 'Pause' }}</Button>
        </div>
      </RaCard>
    </template>
  </div>
</template>
