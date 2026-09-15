<script setup lang="ts">
import { ref } from 'vue'
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
import { listUsers, type AdminUser } from '@/api/identity'

const props = defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [userId: string | null] }>()

const searchText = ref('')
const results = ref<AdminUser[]>([])
const searching = ref(false)
const selectedUser = ref<AdminUser | null>(null)
let searchDebounce: ReturnType<typeof setTimeout> | undefined

function onSearchInput(value: string) {
  searchText.value = value
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(async () => {
    searching.value = true
    try {
      const result = await listUsers(1, 10, value)
      results.value = result.items
    } catch {
      results.value = []
    } finally {
      searching.value = false
    }
  }, 300)
}

function onSelect(userId: string) {
  selectedUser.value = results.value.find((u) => u.userId === userId) ?? null
  emit('update:modelValue', userId)
}

function clear() {
  selectedUser.value = null
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
      class="flex h-9 w-52 items-center gap-1.5 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5"
    >
      <ComboboxInput
        :model-value="searchText"
        placeholder="Filter by user..."
        class="w-full bg-transparent text-[13px] text-(--fg-2) outline-none placeholder:text-(--fg-4)"
        @update:model-value="(value) => onSearchInput(value as string)"
      />
      <ComboboxCancel v-if="selectedUser" as-child>
        <button type="button" class="flex shrink-0 cursor-pointer bg-transparent p-0 text-(--fg-4) hover:text-(--fg-2)" @click="clear">
          <X :size="13" />
        </button>
      </ComboboxCancel>
    </ComboboxAnchor>
    <div v-if="selectedUser" class="mt-1 text-xs text-(--fg-3)">
      Selected: <span class="font-semibold text-(--fg-1)">{{ selectedUser.fullName }}</span>
    </div>

    <ComboboxPortal>
      <ComboboxContent
        :class="
          cn(
            'z-50 w-52 rounded-none bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )
        "
      >
        <ComboboxViewport class="max-h-60 overflow-y-auto">
          <ComboboxEmpty class="px-2.5 py-2 text-[13px] text-(--fg-3)">
            {{ searching ? 'Searching…' : 'No users found.' }}
          </ComboboxEmpty>
          <ComboboxItem
            v-for="user in results"
            :key="user.userId"
            :value="user.userId"
            :text-value="user.fullName"
            class="cursor-pointer px-2.5 py-2 text-[13px] text-(--fg-2) outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
          >
            <div class="font-semibold text-(--fg-1)">{{ user.fullName }}</div>
            <div class="text-xs text-(--fg-3)">{{ user.email }}</div>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
