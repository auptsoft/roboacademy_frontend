<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { Copy, MoreVertical, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ApiError } from '@/api/client'
import {
  SUPPORTED_CURRENCIES,
  createPaymentProvider,
  deletePaymentProvider,
  listPaymentProviders,
  testPaymentProvider,
  updatePaymentProvider,
  type PaymentProvider,
  type PaymentProviderMode,
  type PaymentProviderType,
} from '@/api/payments'

// Payment providers (Payments Phase P1): the accounts learners' payments go through. One provider
// is active per currency; activating another takes over from it. Keys are stored encrypted and
// never shown again, and each environment only lets one mode (Test or Live) be active.

const providers = ref<PaymentProvider[]>([])
const loading = ref(true)
const pending = ref(false)

async function load() {
  loading.value = true
  try {
    providers.value = await listPaymentProviders()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load payment providers.')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Same ⋮ trigger as the AI Models page.
const menuTriggerClass =
  'inline-flex size-9 items-center justify-center rounded-lg border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50'

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'

async function run(action: () => Promise<unknown>, success: string): Promise<boolean> {
  pending.value = true
  try {
    await action()
    toast.success(success)
    await load()
    return true
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Something went wrong.')
    return false
  } finally {
    pending.value = false
  }
}

function updateRequest(provider: PaymentProvider, status: PaymentProvider['status']) {
  return {
    name: provider.name, mode: provider.mode, currencies: provider.currencies,
    publicKey: provider.publicKey, secretKey: null, status,
  }
}

function activate(provider: PaymentProvider) {
  const current = providers.value.find((p) => p.id !== provider.id && p.status === 'Active'
    && p.currencies.some((c) => provider.currencies.includes(c)))
  const message = current
    ? `Make ${provider.name} take payments in ${provider.currencies.join(', ')}? ${current.name} will be disabled. Orders already started on it finish there.`
    : `Make ${provider.name} take payments in ${provider.currencies.join(', ')}?`
  if (window.confirm(message)) {
    void run(() => updatePaymentProvider(provider.id, updateRequest(provider, 'Active')), `${provider.name} is now active.`)
  }
}

function disable(provider: PaymentProvider) {
  if (window.confirm(`Disable ${provider.name}? Learners can't buy courses in ${provider.currencies.join(', ')} until another provider is active.`)) {
    void run(() => updatePaymentProvider(provider.id, updateRequest(provider, 'Disabled')), `${provider.name} disabled.`)
  }
}

async function test(provider: PaymentProvider) {
  pending.value = true
  try {
    const result = await testPaymentProvider(provider.id)
    toast[result.ok ? 'success' : 'error'](result.message)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Connection test failed.')
  } finally {
    pending.value = false
  }
}

function confirmDelete(provider: PaymentProvider) {
  if (window.confirm(`Delete ${provider.name}? This can't be undone.`)) {
    void run(() => deletePaymentProvider(provider.id), 'Provider deleted.')
  }
}

async function copyWebhookUrl(provider: PaymentProvider) {
  try {
    await navigator.clipboard.writeText(provider.webhookUrl)
    toast.success('Webhook URL copied.')
  } catch {
    toast.error("Couldn't copy to the clipboard.")
  }
}

// --- Add / edit ---
const dialog = reactive({
  open: false,
  provider: null as PaymentProvider | null,
  name: '',
  type: 'Paystack' as PaymentProviderType,
  mode: 'Test' as PaymentProviderMode,
  currencies: ['NGN'] as string[],
  publicKey: '',
  secretKey: '',
})

function openDialog(provider?: PaymentProvider) {
  Object.assign(dialog, {
    open: true,
    provider: provider ?? null,
    name: provider?.name ?? '',
    type: provider?.type ?? 'Paystack',
    mode: provider?.mode ?? 'Test',
    currencies: [...(provider?.currencies ?? ['NGN'])],
    publicKey: provider?.publicKey ?? '',
    secretKey: '',
  })
}

async function submit() {
  const { provider, name, type, mode, currencies, publicKey, secretKey } = dialog
  const saved = await run(
    () => provider
      ? updatePaymentProvider(provider.id, {
          name: name.trim(), mode, currencies, publicKey: publicKey.trim() || null,
          secretKey: secretKey.trim() || null, status: provider.status,
        })
      : createPaymentProvider({
          name: name.trim(), type, mode, currencies, publicKey: publicKey.trim() || null, secretKey: secretKey.trim(),
        }),
    provider ? 'Provider updated.' : 'Provider added. Test the connection, then activate it.',
  )
  if (saved) dialog.open = false
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div class="flex items-start justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Payment Providers</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">
          The accounts learners pay through when they buy a course. One provider takes payments in each currency.
        </p>
      </div>
      <Button @click="openDialog()">
        <Plus :size="14" />
        Add Provider
      </Button>
    </div>

    <p v-if="loading" class="m-0 text-center text-[13px] text-(--fg-3)">Loading…</p>

    <RaCard v-else :padding="0" class="overflow-hidden">
      <p v-if="providers.length === 0" class="m-0 p-6 text-center text-[13px] text-(--fg-3)">
        No providers yet. Add your Paystack account to start selling courses.
      </p>
      <div
        v-for="provider in providers"
        :key="provider.id"
        class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--line-1) py-4 px-6 last:border-b-0"
      >
        <div class="min-w-0 flex-1">
          <p class="m-0 text-sm font-semibold text-(--fg-1)">{{ provider.name }}</p>
          <p class="m-0 text-xs text-(--fg-3)">
            {{ provider.type }} · {{ provider.mode }} keys · {{ provider.currencies.join(', ') }} ·
            {{ provider.orderCount }} order{{ provider.orderCount === 1 ? '' : 's' }} ·
            {{ provider.hasSecretKey ? 'Secret key set' : 'No secret key' }}
          </p>
          <button
            type="button"
            class="mt-1 inline-flex max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left font-mono text-xs text-(--fg-3) hover:text-(--fg-1)"
            :title="`Webhook URL - paste into the ${provider.type} dashboard`"
            @click="copyWebhookUrl(provider)"
          >
            <Copy :size="12" class="shrink-0" />
            <span class="truncate">{{ provider.webhookUrl }}</span>
          </button>
        </div>
        <RaChip :tone="provider.status === 'Active' ? 'info' : 'neutral'">{{ provider.status }}</RaChip>
        <DropdownMenu>
          <DropdownMenuTrigger :class="menuTriggerClass" :disabled="pending">
            <MoreVertical :size="16" />
            <span class="sr-only">Actions for {{ provider.name }}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @select="openDialog(provider)">Edit</DropdownMenuItem>
            <DropdownMenuItem @select="test(provider)">Test connection</DropdownMenuItem>
            <DropdownMenuItem @select="copyWebhookUrl(provider)">Copy webhook URL</DropdownMenuItem>
            <DropdownMenuItem v-if="provider.status === 'Disabled'" @select="activate(provider)">Activate</DropdownMenuItem>
            <DropdownMenuItem v-else @select="disable(provider)">Disable</DropdownMenuItem>
            <template v-if="provider.orderCount === 0">
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" @select="confirmDelete(provider)">Delete</DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </RaCard>

    <Dialog v-model:open="dialog.open">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ dialog.provider ? 'Edit provider' : 'Add provider' }}</DialogTitle>
          <DialogDescription>
            Keys are in the provider's dashboard under Settings → API Keys & Webhooks. New providers start disabled.
          </DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <div class="flex flex-col gap-1.5">
            <Label for="payment-provider-name">Name</Label>
            <Input id="payment-provider-name" v-model="dialog.name" placeholder="Paystack (live)" required />
          </div>
          <div class="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            <div class="flex flex-col gap-1.5">
              <Label for="payment-provider-type">Provider</Label>
              <select id="payment-provider-type" v-model="dialog.type" :class="selectClass" :disabled="!!dialog.provider">
                <option value="Paystack">Paystack</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="payment-provider-mode">Keys</Label>
              <select id="payment-provider-mode" v-model="dialog.mode" :class="selectClass">
                <option value="Test">Test (no real money)</option>
                <option value="Live">Live</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="payment-provider-currency">Currency</Label>
              <select id="payment-provider-currency" v-model="dialog.currencies[0]" :class="selectClass">
                <option v-for="currency in SUPPORTED_CURRENCIES" :key="currency" :value="currency">{{ currency }}</option>
              </select>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="payment-provider-public">Public key</Label>
            <Input id="payment-provider-public" v-model="dialog.publicKey" autocomplete="off" placeholder="pk_test_…" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="payment-provider-secret">Secret key</Label>
            <Input
              id="payment-provider-secret"
              v-model="dialog.secretKey"
              type="password"
              autocomplete="off"
              :placeholder="dialog.provider ? 'Leave blank to keep the current key' : 'sk_test_…'"
              :required="!dialog.provider"
            />
            <p class="m-0 text-xs text-(--fg-4)">Stored encrypted. It also signs the provider's webhooks.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="dialog.open = false">Cancel</Button>
            <Button type="submit" :disabled="pending">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
