<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@roboacademy/ui'

defineProps<{
  type?: string
  class?: HTMLAttributes['class']
}>()

const modelValue = defineModel<string | number>()
</script>

<template>
  <input
    v-model="modelValue"
    data-slot="input"
    :type="type"
    :class="
      cn(
        'h-10 w-full min-w-0 rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-3 py-1 text-sm text-(--fg-1) shadow-xs transition-[color,border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        $props.class,
      )
    "
  >
</template>
