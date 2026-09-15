<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@roboacademy/ui'

defineProps<{
  for?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <label
    data-slot="label"
    :for="$props.for"
    :class="cn('flex items-center gap-2 text-xs font-semibold tracking-wide uppercase select-none', $props.class)"
  >
    <slot />
  </label>
</template>
