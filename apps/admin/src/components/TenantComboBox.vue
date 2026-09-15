<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxCancel,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxItem,
  ComboboxEmpty,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn } from '@roboacademy/ui'
import { listTenants, type Tenant } from '@/api/tenancy'

// Single-tenant picker for the cross-tenant import flow's "source tenant" step. listTenants has
// no server-side search, so this loads a working set once and filters client-side - the same
// tradeoff assessments/index.vue makes loading courses for its filter dropdown.
const props = withDefaults(
  defineProps<{ modelValue: string | null; excludeTenantId?: string | null }>(),
  { excludeTenantId: null },
)
const emit = defineEmits<{ 'update:modelValue': [tenantId: string | null] }>()

const searchText = ref('')
const allTenants = ref<Tenant[]>([])
const results = ref<Tenant[]>([])
const loading = ref(true)
const selectedTenant = ref<Tenant | null>(null)

onMounted(async () => {
  try {
    const result = await listTenants(1, 100)
    allTenants.value = result.items.filter((t) => t.tenantId !== props.excludeTenantId && t.isActive)
    results.value = allTenants.value
  } finally {
    loading.value = false
  }
})

function onSearchInput(value: string) {
  searchText.value = value
  const needle = value.trim().toLowerCase()
  results.value = !needle
    ? allTenants.value
    : allTenants.value.filter(
        (t) => t.name.toLowerCase().includes(needle) || t.slug.toLowerCase().includes(needle),
      )
}

function onSelect(tenantId: string) {
  selectedTenant.value = allTenants.value.find((t) => t.tenantId === tenantId) ?? null
  emit('update:modelValue', tenantId)
}

function clear() {
  selectedTenant.value = null
  searchText.value = ''
  emit('update:modelValue', null)
}
</script>

<template>
  <ComboboxRoot
    :model-value="props.modelValue ?? undefined"
    ignore-filter
    class="relative"
    @update:model-value="(value) => onSelect(value as string)"
  >
    <ComboboxAnchor
      class="flex h-9 w-64 items-center gap-1.5 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5"
    >
      <ComboboxInput
        :model-value="searchText"
        :placeholder="loading ? 'Loading tenants…' : 'Search tenants…'"
        class="w-full bg-transparent text-[13px] text-(--fg-2) outline-none placeholder:text-(--fg-4)"
        @update:model-value="(value) => onSearchInput(value as string)"
      />
      <ComboboxCancel v-if="selectedTenant" as-child>
        <button type="button" class="flex shrink-0 cursor-pointer bg-transparent p-0 text-(--fg-4) hover:text-(--fg-2)" @click="clear">
          <X :size="13" />
        </button>
      </ComboboxCancel>
    </ComboboxAnchor>
    <div v-if="selectedTenant" class="mt-1 text-xs text-(--fg-3)">
      Selected: <span class="font-semibold text-(--fg-1)">{{ selectedTenant.name }}</span>
    </div>

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
</template>
