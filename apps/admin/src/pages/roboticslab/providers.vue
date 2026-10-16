<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import {
  createBotnovaHost,
  createLabProvider,
  listBotnovaHosts,
  listLabProviders,
  listLabTemplates,
  listSchoolLabProviders,
  testLabProvider,
  updateBotnovaHost,
  updateLabProvider,
  type BotnovaHost,
  type LabProvider,
  type LabTemplate,
  type SchoolLabProvider,
} from '@/api/roboticsLab'
import { listTenants, type Tenant } from '@/api/tenancy'

/**
 * Platform admin: the botnova servers RoboAcademy may use, and the botnova accounts (providers)
 * whose robots it schedules. A provider's API token is write-only; the connection test also
 * registers RoboAcademy's webhook with botnova.
 */
const hosts = ref<BotnovaHost[]>([])
const providers = ref<LabProvider[]>([])
const templates = reactive<Record<string, LabTemplate[] | 'loading' | 'error'>>({})
const busy = ref<string | null>(null)
const schoolProviders = ref<SchoolLabProvider[]>([])
const tenants = ref<Tenant[]>([])
const schoolName = (id: string) => tenants.value.find((t) => t.tenantId === id)?.name ?? 'Unknown school'

async function load() {
  try {
    ;[hosts.value, providers.value, schoolProviders.value] = await Promise.all([listBotnovaHosts(), listLabProviders(), listSchoolLabProviders()])
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : 'Robot lab settings could not be loaded.')
  }
  try {
    tenants.value = (await listTenants(1, 200)).items
  } catch {
    // Shown as "Unknown school"; the list still works.
  }
}
onMounted(load)

const fail = (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Something went wrong.')

// --- Host dialog ---
const hostDialog = ref<{ id: string | null } | null>(null)
const hostForm = reactive({ name: '', apiBaseUrl: '', embedOrigin: '', enabled: true })

function editHost(host?: BotnovaHost) {
  Object.assign(hostForm, host ? { name: host.name, apiBaseUrl: host.apiBaseUrl, embedOrigin: host.embedOrigin, enabled: host.enabled }
    : { name: '', apiBaseUrl: '', embedOrigin: '', enabled: true })
  hostDialog.value = { id: host?.id ?? null }
}

async function saveHost() {
  busy.value = 'host'
  try {
    const body = { ...hostForm, name: hostForm.name.trim(), apiBaseUrl: hostForm.apiBaseUrl.trim(), embedOrigin: hostForm.embedOrigin.trim() }
    if (hostDialog.value?.id) await updateBotnovaHost(hostDialog.value.id, body)
    else await createBotnovaHost(body)
    hostDialog.value = null
    toast.success('Host saved.')
    await load()
  } catch (err) {
    fail(err)
  } finally {
    busy.value = null
  }
}

// --- Provider dialog ---
const providerDialog = ref<{ id: string | null } | null>(null)
const providerForm = reactive({ name: '', hostId: '', apiToken: '', disabled: false })

function editProvider(provider?: LabProvider) {
  Object.assign(providerForm, provider
    ? { name: provider.name, hostId: provider.hostId, apiToken: '', disabled: provider.status === 'Disabled' }
    : { name: '', hostId: hosts.value.find((h) => h.enabled)?.id ?? '', apiToken: '', disabled: false })
  providerDialog.value = { id: provider?.id ?? null }
}

async function saveProvider() {
  busy.value = 'provider'
  try {
    if (providerDialog.value?.id) {
      const saved = await updateLabProvider(providerDialog.value.id, {
        name: providerForm.name.trim(), hostId: providerForm.hostId, disabled: providerForm.disabled,
        apiToken: providerForm.apiToken.trim() || null,
      })
      // A changed token or host needs testing before the provider can be used again.
      if (!providerForm.disabled) await testLabProvider(saved.id)
    } else {
      await createLabProvider({ name: providerForm.name.trim(), hostId: providerForm.hostId, apiToken: providerForm.apiToken.trim() })
    }
    providerDialog.value = null
    await load()
    const provider = providers.value.find((p) => p.name === providerForm.name.trim())
    if (provider?.status === 'Active') toast.success('Provider connected.')
    else toast.warning(`Saved, but the connection test failed: ${provider?.lastError ?? 'unknown error'}`)
  } catch (err) {
    fail(err)
  } finally {
    busy.value = null
  }
}

async function test(provider: LabProvider) {
  busy.value = provider.id
  try {
    const result = await testLabProvider(provider.id)
    if (result.status === 'Active') toast.success('Connection works.')
    else toast.error(`Connection test failed: ${result.lastError}`)
    await load()
  } catch (err) {
    fail(err)
  } finally {
    busy.value = null
  }
}

async function toggleTemplates(provider: LabProvider) {
  if (templates[provider.id] && templates[provider.id] !== 'error') {
    delete templates[provider.id]
    return
  }
  templates[provider.id] = 'loading'
  try {
    templates[provider.id] = await listLabTemplates(provider.id)
  } catch (err) {
    templates[provider.id] = 'error'
    fail(err)
  }
}

const statusTone = (status: string) => (status === 'Active' ? 'info' : 'neutral')
const selectClass = 'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Robot Lab Providers</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        The botnova accounts whose robots RoboAcademy schedules. Templates are set up in botnova; slots are created from them under Robot Lab Slots.
      </p>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex items-center justify-between border-b border-(--line-1) px-6 py-3">
        <h2 class="m-0 text-sm font-semibold text-(--fg-1)">Providers</h2>
        <Button size="sm" :disabled="!hosts.some((h) => h.enabled)" @click="editProvider()"><Plus :size="14" />Connect botnova account</Button>
      </div>
      <p v-if="!providers.length" class="p-6 text-center text-[13px] text-(--fg-3)">
        {{ hosts.length ? 'No providers yet.' : 'Approve a botnova host first, below.' }}
      </p>
      <div v-for="(provider, i) in providers" :key="provider.id" :class="i < providers.length - 1 && 'border-b border-(--line-1)'">
        <div class="flex flex-wrap items-center gap-3 px-6 py-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 text-sm font-semibold text-(--fg-1)">
              {{ provider.name }} <RaChip :tone="statusTone(provider.status)">{{ provider.status }}</RaChip>
            </div>
            <div class="text-xs text-(--fg-3)">
              {{ provider.hostName }}{{ provider.accountName ? ` · ${provider.accountName}` : '' }}
              <template v-if="provider.lastCheckedAt"> · checked {{ formatDate(provider.lastCheckedAt) }}</template>
            </div>
            <div v-if="provider.lastError" class="mt-1 text-xs text-(--danger)">{{ provider.lastError }}</div>
          </div>
          <Button variant="ghost" size="sm" @click="toggleTemplates(provider)">{{ templates[provider.id] && templates[provider.id] !== 'error' ? 'Hide templates' : 'Templates' }}</Button>
          <Button variant="outline" size="sm" :disabled="busy === provider.id" @click="test(provider)">Test connection</Button>
          <Button variant="ghost" size="sm" @click="editProvider(provider)">Edit</Button>
        </div>
        <div v-if="templates[provider.id]" class="border-t border-(--line-1) bg-(--bg-3) px-6 py-3 text-[13px]">
          <p v-if="templates[provider.id] === 'loading'" class="m-0 text-(--fg-3)">Loading templates…</p>
          <p v-else-if="templates[provider.id] === 'error'" class="m-0 text-(--danger)">Templates couldn't be loaded.</p>
          <p v-else-if="!(templates[provider.id] as LabTemplate[]).length" class="m-0 text-(--fg-3)">No templates in this botnova account yet.</p>
          <ul v-else class="m-0 grid gap-1.5 pl-0 list-none">
            <li v-for="template in templates[provider.id] as LabTemplate[]" :key="template.templateId">
              <span class="font-semibold text-(--fg-1)">{{ template.name }}</span>
              <span class="text-(--fg-3)"> · robots: {{ template.robotIds.join(', ') || 'none' }}</span>
            </li>
          </ul>
        </div>
      </div>
    </RaCard>

    <RaCard v-if="schoolProviders.length" :padding="0" class="overflow-hidden">
      <div class="border-b border-(--line-1) px-6 py-3">
        <h2 class="m-0 text-sm font-semibold text-(--fg-1)">School providers</h2>
        <p class="m-0 text-xs text-(--fg-3)">Schools' own botnova accounts. The schools manage these; they're listed here for support.</p>
      </div>
      <div v-for="(entry, i) in schoolProviders" :key="entry.provider.id" class="flex flex-wrap items-center gap-3 px-6 py-3" :class="i < schoolProviders.length - 1 && 'border-b border-(--line-1)'">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 text-sm font-semibold text-(--fg-1)">
            {{ schoolName(entry.tenantId) }} · {{ entry.provider.name }} <RaChip :tone="statusTone(entry.provider.status)">{{ entry.provider.status }}</RaChip>
          </div>
          <div class="text-xs text-(--fg-3)">
            {{ entry.provider.hostName }}{{ entry.provider.accountName ? ` · ${entry.provider.accountName}` : '' }}
            <template v-if="entry.provider.lastCheckedAt"> · checked {{ formatDate(entry.provider.lastCheckedAt) }}</template>
          </div>
          <div v-if="entry.provider.lastError && entry.provider.status !== 'Suspended'" class="mt-1 text-xs text-(--danger)">{{ entry.provider.lastError }}</div>
        </div>
      </div>
    </RaCard>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex items-center justify-between border-b border-(--line-1) px-6 py-3">
        <div>
          <h2 class="m-0 text-sm font-semibold text-(--fg-1)">Approved botnova hosts</h2>
          <p class="m-0 text-xs text-(--fg-3)">Providers can only use these servers. Each embed origin must also be allowed in the web app's frame-src.</p>
        </div>
        <Button variant="outline" size="sm" @click="editHost()"><Plus :size="14" />Add host</Button>
      </div>
      <p v-if="!hosts.length" class="p-6 text-center text-[13px] text-(--fg-3)">No hosts approved yet.</p>
      <div v-for="(host, i) in hosts" :key="host.id" class="flex flex-wrap items-center gap-3 px-6 py-3" :class="i < hosts.length - 1 && 'border-b border-(--line-1)'">
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-(--fg-1)">{{ host.name }} <RaChip v-if="!host.enabled" tone="neutral">Disabled</RaChip></div>
          <div class="truncate text-xs text-(--fg-3)">{{ host.apiBaseUrl }} · embed {{ host.embedOrigin }}</div>
        </div>
        <Button variant="ghost" size="sm" @click="editHost(host)">Edit</Button>
      </div>
    </RaCard>

    <Dialog :open="!!hostDialog" @update:open="(open) => !open && (hostDialog = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ hostDialog?.id ? 'Edit host' : 'Approve a botnova host' }}</DialogTitle>
          <DialogDescription>The server's API address and the origin its robot control screen is served from.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-3">
          <div class="grid gap-1.5"><Label for="host-name">Name</Label><Input id="host-name" v-model="hostForm.name" /></div>
          <div class="grid gap-1.5"><Label for="host-api">API address</Label><Input id="host-api" v-model="hostForm.apiBaseUrl" placeholder="https://api.botnova.example" /></div>
          <div class="grid gap-1.5"><Label for="host-embed">Embed origin</Label><Input id="host-embed" v-model="hostForm.embedOrigin" placeholder="https://sim.botnova.example" /></div>
          <label class="inline-flex items-center gap-2 text-sm text-(--fg-2)"><input v-model="hostForm.enabled" type="checkbox"> Enabled</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="hostDialog = null">Cancel</Button>
          <Button :disabled="busy === 'host'" @click="saveHost">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!providerDialog" @update:open="(open) => !open && (providerDialog = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ providerDialog?.id ? 'Edit provider' : 'Connect a botnova account' }}</DialogTitle>
          <DialogDescription>Create an API token for RoboAcademy in botnova, then paste it here. It's stored encrypted and never shown again.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-3">
          <div class="grid gap-1.5"><Label for="provider-name">Name</Label><Input id="provider-name" v-model="providerForm.name" placeholder="e.g. RoboAcademy robots" /></div>
          <div class="grid gap-1.5">
            <Label for="provider-host">botnova host</Label>
            <select id="provider-host" v-model="providerForm.hostId" :class="selectClass">
              <option v-for="host in hosts.filter((h) => h.enabled)" :key="host.id" :value="host.id">{{ host.name }}</option>
            </select>
          </div>
          <div class="grid gap-1.5">
            <Label for="provider-token">API token</Label>
            <Input id="provider-token" v-model="providerForm.apiToken" type="password" autocomplete="off" :placeholder="providerDialog?.id ? 'Leave blank to keep the current token' : ''" />
          </div>
          <label v-if="providerDialog?.id" class="inline-flex items-center gap-2 text-sm text-(--fg-2)"><input v-model="providerForm.disabled" type="checkbox"> Disabled</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="providerDialog = null">Cancel</Button>
          <Button :disabled="busy === 'provider' || !providerForm.name.trim() || !providerForm.hostId || (!providerDialog?.id && !providerForm.apiToken.trim())" @click="saveProvider">
            Save and test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
