<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@roboacademy/ui'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <tr
    data-slot="table-row"
    :class="cn('border-b border-border transition-colors hover:bg-muted/50', $props.class)"
  >
    <slot />
  </tr>
</template>
