<script setup lang="ts">
import { computed, ref } from 'vue'
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

export interface SearchOption {
  id: string
  label: string
  sublabel?: string
}

// Generic chip multi-select over a server-side search (users, courses, paths, classes...).
// Same visual shape as TenantMultiSelect, but the search is delegated to `search` (debounced)
// since those lists are paged server-side rather than fetched once.
const props = withDefaults(
  defineProps<{
    modelValue: SearchOption[]
    search: (query: string) => Promise<SearchOption[]>
    placeholder?: string
    max?: number
    excludeIds?: string[]
  }>(),
  { placeholder: 'Search…', max: 100, excludeIds: () => [] },
)
const emit = defineEmits<{ 'update:modelValue': [options: SearchOption[]] }>()

const searchText = ref('')
const results = ref<SearchOption[]>([])
const searching = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | undefined

const hiddenIds = computed(() => new Set([...props.modelValue.map((o) => o.id), ...props.excludeIds]))
const visibleResults = computed(() => results.value.filter((o) => !hiddenIds.value.has(o.id)))

function runSearch(value: string) {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(async () => {
    searching.value = true
    try {
      results.value = await props.search(value)
    } catch {
      results.value = []
    } finally {
      searching.value = false
    }
  }, 300)
}

function onSearchInput(value: string) {
  searchText.value = value
  runSearch(value)
}

function add(id: string) {
  if (props.modelValue.length >= props.max) return
  const option = results.value.find((o) => o.id === id)
  if (!option) return
  emit('update:modelValue', [...props.modelValue, option])
  searchText.value = ''
}

function remove(id: string) {
  emit('update:modelValue', props.modelValue.filter((o) => o.id !== id))
}

function onOpenChange(open: boolean) {
  if (open && results.value.length === 0) runSearch(searchText.value)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="modelValue.length > 0" class="flex flex-wrap gap-1.5">
      <RaChip v-for="option in modelValue" :key="option.id" tone="neutral">
        <span class="inline-flex items-center gap-1">
          {{ option.label }}
          <button
            type="button"
            class="cursor-pointer bg-transparent p-0 text-(--fg-4) hover:text-(--fg-2)"
            :aria-label="`Remove ${option.label}`"
            @click="remove(option.id)"
          >
            <X :size="11" />
          </button>
        </span>
      </RaChip>
    </div>

    <ComboboxRoot
      ignore-filter
      class="relative"
      @update:model-value="(value) => add(value as string)"
      @update:open="onOpenChange"
    >
      <ComboboxAnchor class="flex h-9 items-center gap-1.5 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5">
        <ComboboxInput
          :model-value="searchText"
          :display-value="() => ''"
          :placeholder="modelValue.length >= max ? `Maximum ${max} selected` : placeholder"
          :disabled="modelValue.length >= max"
          class="w-full bg-transparent text-[13px] text-(--fg-2) outline-none placeholder:text-(--fg-4) disabled:cursor-not-allowed"
          @update:model-value="(value) => onSearchInput(value as string)"
          @focus="onOpenChange(true)"
        />
      </ComboboxAnchor>

      <ComboboxPortal>
        <ComboboxContent
          position="popper"
          :side-offset="6"
          :class="
            cn(
              'z-50 w-(--reka-combobox-trigger-width) min-w-64 rounded-none bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            )
          "
        >
          <ComboboxViewport class="max-h-60 overflow-y-auto">
            <ComboboxEmpty class="px-2.5 py-2 text-[13px] text-(--fg-3)">
              {{ searching ? 'Searching…' : 'No matches.' }}
            </ComboboxEmpty>
            <ComboboxItem
              v-for="option in visibleResults"
              :key="option.id"
              :value="option.id"
              :text-value="option.label"
              class="cursor-pointer px-2.5 py-2 text-[13px] text-(--fg-2) outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
            >
              <div class="font-semibold text-(--fg-1)">{{ option.label }}</div>
              <div v-if="option.sublabel" class="text-xs text-(--fg-3)">{{ option.sublabel }}</div>
            </ComboboxItem>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  </div>
</template>
