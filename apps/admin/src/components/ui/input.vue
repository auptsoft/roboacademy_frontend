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
        'h-10 w-full min-w-0 border border-transparent border-b-input bg-transparent px-0 py-1 text-sm transition-[color,border-color] outline-none placeholder:text-muted-foreground focus-visible:border-b-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-b-destructive',
        $props.class,
      )
    "
  >
</template>
