<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxItem,
  ComboboxEmpty,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn, RaChip } from '@roboacademy/ui'
import { listTenants, type Tenant } from '@/api/tenancy'

// Multi-tenant picker for "Copy to tenants…" - export fan-out. Same fetch-once-and-filter-
// client-side tradeoff as TenantComboBox (listTenants has no server-side search).
const props = withDefaults(
  defineProps<{ modelValue: Tenant[]; excludeTenantId?: string | null; max?: number }>(),
  { excludeTenantId: null, max: 25 },
)
const emit = defineEmits<{ 'update:modelValue': [tenants: Tenant[]] }>()

const searchText = ref('')
const allTenants = ref<Tenant[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const result = await listTenants(1, 100)
    allTenants.value = result.items.filter((t) => t.tenantId !== props.excludeTenantId && t.isActive)
  } finally {
    loading.value = false
  }
})

const selectedIds = computed(() => new Set(props.modelValue.map((t) => t.tenantId)))

const results = computed(() => {
  const needle = searchText.value.trim().toLowerCase()
  return allTenants.value
    .filter((t) => !selectedIds.value.has(t.tenantId))
    .filter((t) => !needle || t.name.toLowerCase().includes(needle) || t.slug.toLowerCase().includes(needle))
})

function addTenant(tenantId: string) {
  if (props.modelValue.length >= props.max) return
  const tenant = allTenants.value.find((t) => t.tenantId === tenantId)
  if (!tenant) return
  emit('update:modelValue', [...props.modelValue, tenant])
  searchText.value = ''
}

function removeTenant(tenantId: string) {
  emit('update:modelValue', props.modelValue.filter((t) => t.tenantId !== tenantId))
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="modelValue.length > 0" class="flex flex-wrap gap-1.5">
      <RaChip v-for="tenant in modelValue" :key="tenant.tenantId" tone="neutral">
        <span class="inline-flex items-center gap-1">
          {{ tenant.name }}
          <button
            type="button"
            class="cursor-pointer bg-transparent p-0 text-(--fg-4) hover:text-(--fg-2)"
            @click="removeTenant(tenant.tenantId)"
          >
            <X :size="11" />
          </button>
        </span>
      </RaChip>
    </div>

    <ComboboxRoot ignore-filter class="relative" @update:model-value="(value) => addTenant(value as string)">
      <ComboboxAnchor class="flex h-9 items-center gap-1.5 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5">
        <ComboboxInput
          :model-value="searchText"
          :placeholder="modelValue.length >= max ? `Maximum ${max} tenants selected` : 'Search tenants…'"
          :disabled="modelValue.length >= max"
          class="w-full bg-transparent text-[13px] text-(--fg-2) outline-none placeholder:text-(--fg-4) disabled:cursor-not-allowed"
          @update:model-value="(value) => (searchText = value as string)"
        />
      </ComboboxAnchor>

      <ComboboxPortal>
        <ComboboxContent
          :class="
            cn(
              'z-50 w-64 rounded-none bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            )
          "
        >
          <ComboboxViewport class="max-h-60 overflow-y-auto">
            <ComboboxEmpty class="px-2.5 py-2 text-[13px] text-(--fg-3)">
              {{ loading ? 'Loading…' : 'No tenants found.' }}
            </ComboboxEmpty>
            <ComboboxItem
              v-for="tenant in results"
              :key="tenant.tenantId"
              :value="tenant.tenantId"
              :text-value="tenant.name"
              class="cursor-pointer px-2.5 py-2 text-[13px] text-(--fg-2) outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
            >
              <div class="font-semibold text-(--fg-1)">{{ tenant.name }}</div>
              <div class="text-xs text-(--fg-3)">{{ tenant.slug }}</div>
            </ComboboxItem>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  </div>
</template>
