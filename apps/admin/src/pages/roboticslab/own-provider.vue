<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import {
  createOwnProvider,
  deleteOwnProvider,
  getOwnProvider,
  listOwnHosts,
  listOwnTemplates,
  testOwnProvider,
  updateOwnProvider,
  type LabProvider,
  type LabTemplate,
  type OwnBotnovaHost,
} from '@/api/roboticsLab'

/**
 * A school's own botnova account (Robotics Lab Phase P2): connect it with an API token from
 * botnova, check it works, and see its templates. Robot time is then scheduled under
 * "Our Robot Time", without the platform team.
 */
const hosts = ref<OwnBotnovaHost[]>([])
const provider = ref<LabProvider | null>(null)
const templates = ref<LabTemplate[] | null>(null)
const templatesError = ref('')
const loaded = ref(false)
const busy = ref(false)

const fail = (err: unknown, fallback = 'Something went wrong.') => toast.error(err instanceof ApiError ? err.message : fallback)

async function loadTemplates() {
  templates.value = null
  templatesError.value = ''
  if (provider.value?.status !== 'Active') return
  try {
    templates.value = await listOwnTemplates()
  } catch (err) {
    templatesError.value = err instanceof ApiError ? err.message : "Templates couldn't be loaded."
  }
}

async function load() {
  try {
    ;[hosts.value, provider.value] = await Promise.all([listOwnHosts(), getOwnProvider()])
    if (!provider.value) startConnect()
    await loadTemplates()
  } catch (err) {
    fail(err, "Your botnova connection couldn't be loaded.")
  } finally {
    loaded.value = true
  }
}
onMounted(load)

// --- Connect / edit ---
const form = reactive({ name: '', hostId: '', apiToken: '' })
const editing = ref(false)

function startConnect() {
  Object.assign(form, { name: 'Our robots', hostId: hosts.value[0]?.id ?? '', apiToken: '' })
}

function startEdit() {
  const p = provider.value!
  Object.assign(form, { name: p.name, hostId: p.hostId, apiToken: '' })
  editing.value = true
}

async function connect() {
  busy.value = true
  try {
    provider.value = await createOwnProvider({ name: form.name.trim(), hostId: form.hostId, apiToken: form.apiToken.trim() })
    form.apiToken = ''
    if (provider.value.status === 'Active') toast.success('botnova connected.')
    else toast.warning(`Saved, but the connection test failed: ${provider.value.lastError}`)
    await loadTemplates()
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}

async function saveEdit() {
  busy.value = true
  try {
    await updateOwnProvider({ name: form.name.trim(), hostId: form.hostId, apiToken: form.apiToken.trim() || null })
    // A changed token or server needs a test before it can be used again.
    provider.value = await testOwnProvider()
    editing.value = false
    if (provider.value.status === 'Active') toast.success('Saved. The connection works.')
    else toast.warning(`Saved, but the connection test failed: ${provider.value.lastError}`)
    await loadTemplates()
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}

async function test() {
  busy.value = true
  try {
    provider.value = await testOwnProvider()
    if (provider.value.status === 'Active') toast.success('The connection works.')
    else toast.error(`Connection test failed: ${provider.value.lastError}`)
    await loadTemplates()
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}

async function disconnect() {
  if (!window.confirm('Disconnect your botnova account? You can connect it again later.')) return
  busy.value = true
  try {
    await deleteOwnProvider()
    provider.value = null
    templates.value = null
    startConnect()
    toast.success('botnova disconnected.')
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}

const statusLabel = computed(() => {
  switch (provider.value?.status) {
    case 'Active': return 'Connected'
    case 'Failing': return 'Not working'
    case 'Suspended': return 'Paused'
    case 'Disabled': return 'Disabled'
    default: return ''
  }
})

const selectClass = 'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Our botnova Account</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">
        Connect your school's own botnova account to schedule your own robots for lab sessions.
      </p>
    </div>

    <p v-if="!loaded" class="text-sm text-(--fg-3)">Loading…</p>

    <!-- Not connected yet -->
    <template v-else-if="!provider">
      <RaCard :padding="24" class="flex flex-col gap-3">
        <h2 class="m-0 text-base font-semibold text-(--fg-1)">Before you connect</h2>
        <ol class="m-0 grid gap-2 pl-5 text-sm text-(--fg-2)">
          <li>In botnova, open your user menu, choose <strong>Robot lab</strong>, and set up a template for each robot setup learners will use.</li>
          <li>On the same page, create an <strong>API token</strong> and copy it. botnova shows it only once.</li>
          <li>
            Ask whoever runs your botnova server to allow the web address your learners use for RoboAcademy to show botnova's
            robot controls. This connection can't check that for you; without it, learners see an empty frame.
          </li>
        </ol>
      </RaCard>

      <RaCard :padding="24" class="flex flex-col gap-4">
        <h2 class="m-0 text-base font-semibold text-(--fg-1)">Connect botnova</h2>
        <p v-if="!hosts.length" class="m-0 text-sm text-(--fg-3)">
          No botnova servers are available yet. Ask the RoboAcademy team to approve yours.
        </p>
        <template v-else>
          <div class="grid gap-1.5"><Label for="own-name">Name</Label><Input id="own-name" v-model="form.name" /></div>
          <div class="grid gap-1.5">
            <Label for="own-host">botnova server</Label>
            <select id="own-host" v-model="form.hostId" :class="selectClass">
              <option v-for="host in hosts" :key="host.id" :value="host.id">{{ host.name }}</option>
            </select>
          </div>
          <div class="grid gap-1.5">
            <Label for="own-token">API token</Label>
            <Input id="own-token" v-model="form.apiToken" type="password" autocomplete="off" placeholder="bnv_…" />
            <p class="m-0 text-xs text-(--fg-3)">Stored encrypted. Nobody can see it again, including you.</p>
          </div>
          <div>
            <Button :disabled="busy || !form.name.trim() || !form.hostId || !form.apiToken.trim()" @click="connect">Connect and test</Button>
          </div>
        </template>
      </RaCard>
    </template>

    <!-- Connected -->
    <template v-else>
      <RaCard :padding="24" class="flex flex-col gap-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 text-base font-semibold text-(--fg-1)">
              {{ provider.name }} <RaChip :tone="provider.status === 'Active' ? 'info' : 'neutral'">{{ statusLabel }}</RaChip>
            </div>
            <div class="mt-1 text-xs text-(--fg-3)">
              {{ provider.hostName }}{{ provider.accountName ? ` · botnova account: ${provider.accountName}` : '' }}
              <template v-if="provider.lastCheckedAt"> · checked {{ formatDate(provider.lastCheckedAt) }}</template>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" :disabled="busy || provider.status === 'Suspended'" @click="test">Test connection</Button>
            <Button variant="ghost" size="sm" :disabled="busy || provider.status === 'Suspended'" @click="startEdit">Edit</Button>
            <Button variant="ghost" size="sm" class="text-(--danger)" :disabled="busy" @click="disconnect">Disconnect</Button>
          </div>
        </div>
        <p v-if="provider.status === 'Suspended'" class="m-0 text-sm text-(--fg-2)">
          Your plan no longer includes your own robots, so upcoming sessions on them are paused. Nothing has been cancelled;
          they carry on if the plan is upgraded again.
        </p>
        <p v-else-if="provider.lastError" class="m-0 text-sm text-(--danger)">{{ provider.lastError }}</p>
      </RaCard>

      <RaCard :padding="0" class="overflow-hidden">
        <div class="flex items-center justify-between border-b border-(--line-1) px-6 py-3">
          <div>
            <h2 class="m-0 text-sm font-semibold text-(--fg-1)">Templates</h2>
            <p class="m-0 text-xs text-(--fg-3)">Set up in botnova. Schedule them under Our Robot Time.</p>
          </div>
          <RouterLink to="/roboticslab/own-slots" class="text-xs font-semibold text-(--brand-blue) no-underline">Schedule robot time</RouterLink>
        </div>
        <p v-if="provider.status !== 'Active'" class="p-6 text-center text-[13px] text-(--fg-3)">Templates show once the connection works.</p>
        <p v-else-if="templatesError" class="p-6 text-center text-[13px] text-(--danger)">{{ templatesError }}</p>
        <p v-else-if="!templates" class="p-6 text-center text-[13px] text-(--fg-3)">Loading templates…</p>
        <p v-else-if="!templates.length" class="p-6 text-center text-[13px] text-(--fg-3)">No templates in your botnova account yet.</p>
        <div v-for="(template, i) in templates ?? []" v-else :key="template.templateId" class="px-6 py-3" :class="i < templates!.length - 1 && 'border-b border-(--line-1)'">
          <div class="text-sm font-semibold text-(--fg-1)">{{ template.name }}</div>
          <div class="text-xs text-(--fg-3)">
            {{ template.description ? `${template.description} · ` : '' }}Robots: {{ template.robotIds.join(', ') || 'none' }}
          </div>
        </div>
      </RaCard>
    </template>

    <Dialog :open="editing" @update:open="(open) => (editing = open)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit botnova connection</DialogTitle>
          <DialogDescription>Paste a new API token only if you've replaced it in botnova.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-3">
          <div class="grid gap-1.5"><Label for="edit-name">Name</Label><Input id="edit-name" v-model="form.name" /></div>
          <div class="grid gap-1.5">
            <Label for="edit-host">botnova server</Label>
            <select id="edit-host" v-model="form.hostId" :class="selectClass">
              <option v-for="host in hosts" :key="host.id" :value="host.id">{{ host.name }}</option>
            </select>
          </div>
          <div class="grid gap-1.5">
            <Label for="edit-token">API token</Label>
            <Input id="edit-token" v-model="form.apiToken" type="password" autocomplete="off" placeholder="Leave blank to keep the current token" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="editing = false">Cancel</Button>
          <Button :disabled="busy || !form.name.trim() || !form.hostId" @click="saveEdit">Save and test</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
