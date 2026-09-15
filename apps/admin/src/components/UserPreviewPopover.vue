<script setup lang="ts">
import { ref } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { cn } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import { getUser, type AdminUser } from '@/api/identity'

const props = defineProps<{ userId: string }>()

const loaded = ref(false)
const loading = ref(false)
const error = ref('')
const user = ref<AdminUser | null>(null)

async function onOpenChange(open: boolean) {
  if (!open || loaded.value) return
  loaded.value = true
  loading.value = true
  error.value = ''
  try {
    user.value = await getUser(props.userId)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load user.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <PopoverRoot @update:open="onOpenChange">
    <PopoverTrigger
      :title="userId"
      class="cursor-pointer bg-transparent p-0 font-mono text-[13px] text-(--fg-2) underline-offset-2 outline-none hover:underline"
    >
      {{ userId.slice(0, 8) }}…
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side-offset="6"
        align="start"
        :class="
          cn(
            'z-50 w-56 rounded-none bg-popover p-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )
        "
      >
        <p v-if="loading" class="m-0 text-[13px] text-(--fg-3)">Loading…</p>
        <p v-else-if="error" class="m-0 text-[13px] text-(--danger)">{{ error }}</p>
        <div v-else-if="user">
          <div class="text-sm font-semibold text-(--fg-1)">{{ user.fullName }}</div>
          <div class="mt-0.5 text-xs text-(--fg-3)">{{ user.email }}</div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
