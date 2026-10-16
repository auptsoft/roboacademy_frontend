<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate, formatMoney } from '@roboacademy/ui'
import { CheckCircle2, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { ApiError } from '@/api/client'
import {
  describeFee,
  getPayoutOverview,
  listBanks,
  resolveBankAccount,
  savePayoutAccount,
  type Bank,
  type PayoutAccountStatus,
  type PayoutOverview,
} from '@/api/payments'

// A school's payout account (Payments Phase P2): where Paystack pays the school's share of each
// course sale. The account name is looked up by the provider and must be confirmed before saving;
// RoboAcademy keeps only the last four digits and never holds the school's money.

const overview = ref<PayoutOverview | null>(null)
const banks = ref<Bank[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    overview.value = await getPayoutOverview()
    if (overview.value.providerConfigured) banks.value = await listBanks()
    editing.value = !overview.value.account
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load payouts.')
  } finally {
    loading.value = false
  }
}

onMounted(load)

const editing = ref(false)
const form = reactive({ bankCode: '', accountNumber: '', businessName: '' })
const resolvedName = ref<string | null>(null)
const resolving = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

// The confirmed name belongs to one bank and number; changing either asks again.
watch(() => [form.bankCode, form.accountNumber], () => {
  resolvedName.value = null
  error.value = null
})

function startEditing() {
  const account = overview.value?.account
  Object.assign(form, { bankCode: account?.bankCode ?? '', accountNumber: '', businessName: account?.businessName ?? '' })
  editing.value = true
}

const numberValid = computed(() => /^\d{10}$/.test(form.accountNumber))

async function lookUp() {
  resolving.value = true
  error.value = null
  try {
    resolvedName.value = (await resolveBankAccount(form.bankCode, form.accountNumber)).accountName
    if (!form.businessName.trim()) form.businessName = resolvedName.value
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to look up the account.'
  } finally {
    resolving.value = false
  }
}

async function save() {
  saving.value = true
  error.value = null
  try {
    const account = await savePayoutAccount({ ...form, businessName: form.businessName.trim() })
    if (account.status === 'Failed') {
      error.value = account.failureReason ?? 'The payment provider refused these details.'
    } else {
      toast.success('Payout account saved.')
      editing.value = false
    }
    await load()
    if (account.status === 'Failed') editing.value = true
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to save the payout account.'
  } finally {
    saving.value = false
  }
}

const STATUS_LABEL: Record<PayoutAccountStatus, string> = {
  PendingVerification: 'Being set up',
  Active: 'Active',
  Failed: 'Needs attention',
  Disabled: 'Paused by RoboAcademy',
}

const naira = (minor: number) => formatMoney(minor, overview.value?.currency ?? 'NGN')

const example = computed(() => {
  const fee = overview.value?.fee
  if (!fee) return null
  const price = 500_000
  const platformFee = Math.min(Math.round(price * fee.percentBps / 10_000) + fee.flatMinor, fee.capMinor ?? Infinity)
  return { price, platformFee, received: price - platformFee }
})

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Payouts</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Where your school is paid for course sales. Paystack pays your share straight into this account on its normal
        schedule; RoboAcademy never holds your money.
      </p>
    </div>

    <p v-if="loading" class="m-0 text-center text-[13px] text-(--fg-3)">Loading…</p>

    <template v-else-if="overview">
      <RaCard v-if="!overview.providerConfigured" :padding="24">
        <p class="m-0 text-sm text-(--fg-2)">Payments aren't available yet. RoboAcademy will let you know when you can start selling courses.</p>
      </RaCard>

      <template v-else>
        <RaCard v-if="overview.account && !editing" :padding="0" class="overflow-hidden">
          <div class="flex flex-wrap items-start justify-between gap-4 py-5 px-6">
            <div>
              <p class="m-0 text-xs text-(--fg-3)">Paid into</p>
              <p class="m-0 mt-1 text-lg font-bold text-(--fg-1)">{{ overview.account.accountName }}</p>
              <p class="m-0 text-sm text-(--fg-2)">{{ overview.account.bankName }} · account ending {{ overview.account.accountNumberLast4 }}</p>
              <p class="m-0 mt-1 text-xs text-(--fg-3)">Shown to buyers as {{ overview.account.businessName }} · updated {{ formatDate(overview.account.updatedAt) }}</p>
              <p v-if="overview.account.failureReason" class="m-0 mt-2 text-xs text-(--danger)">{{ overview.account.failureReason }}</p>
            </div>
            <div class="flex items-center gap-3">
              <RaChip :tone="overview.account.status === 'Active' ? 'info' : 'neutral'">{{ STATUS_LABEL[overview.account.status] }}</RaChip>
              <Button variant="outline" size="sm" @click="startEditing">Change account</Button>
            </div>
          </div>
          <p v-if="overview.account.status === 'Disabled'" class="m-0 border-t border-(--line-1) py-3 px-6 text-xs text-(--fg-3)">
            Your courses keep their prices, but learners can't buy them until RoboAcademy resumes your payouts.
          </p>
        </RaCard>

        <RaCard v-if="editing" :padding="0" class="overflow-hidden">
          <div class="border-b border-(--line-1) py-5 px-6">
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">{{ overview.account ? 'Change payout account' : 'Set up payouts' }}</h3>
            <p class="m-0 mt-1 text-xs text-(--fg-3)">Use an account in your school's name. RoboAcademy's support team is told whenever this changes.</p>
          </div>
          <form class="flex flex-col gap-4 py-5 px-6" @submit.prevent="save">
            <div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <div class="flex flex-col gap-1.5">
                <Label for="payout-bank">Bank</Label>
                <select id="payout-bank" v-model="form.bankCode" :class="selectClass" required>
                  <option value="" disabled>Choose your bank</option>
                  <option v-for="bank in banks" :key="bank.code" :value="bank.code">{{ bank.name }}</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="payout-number">Account number</Label>
                <div class="flex gap-2">
                  <Input id="payout-number" v-model="form.accountNumber" inputmode="numeric" maxlength="10" placeholder="0123456789" autocomplete="off" required />
                  <Button type="button" variant="outline" :disabled="!form.bankCode || !numberValid || resolving" @click="lookUp">
                    <Loader2 v-if="resolving" :size="14" class="animate-spin" />
                    Look up
                  </Button>
                </div>
              </div>
            </div>
            <p v-if="resolvedName" class="m-0 flex items-center gap-2 text-sm text-(--fg-1)">
              <CheckCircle2 :size="16" class="text-(--success)" /> {{ resolvedName }}
            </p>
            <div class="flex max-w-md flex-col gap-1.5">
              <Label for="payout-business">Name shown to buyers</Label>
              <Input id="payout-business" v-model="form.businessName" maxlength="200" required />
            </div>
            <p v-if="error" class="m-0 text-xs text-(--danger)">{{ error }}</p>
            <div class="flex justify-end gap-2">
              <Button v-if="overview.account" type="button" variant="outline" @click="editing = false">Cancel</Button>
              <Button type="submit" :disabled="!resolvedName || saving || !form.businessName.trim()">
                {{ saving ? 'Saving…' : 'Confirm and save' }}
              </Button>
            </div>
          </form>
        </RaCard>

        <RaCard :padding="24">
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">Fees</h3>
          <p class="m-0 mt-2 text-sm text-(--fg-2)">
            RoboAcademy keeps {{ describeFee(overview.fee, naira) }} of each sale.
            <template v-if="overview.providerFeePaidBySchool">Paystack's own fee also comes out of your share.</template>
          </p>
          <p v-if="example" class="m-0 mt-2 text-xs text-(--fg-3)">
            On a {{ naira(example.price) }} course you receive {{ naira(example.received) }}<template v-if="overview.providerFeePaidBySchool">, less Paystack's fee</template>.
          </p>
        </RaCard>
      </template>
    </template>
  </div>
</template>
