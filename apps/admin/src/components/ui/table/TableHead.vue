<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@roboacademy/ui'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <th
    data-slot="table-head"
    :class="
      cn(
        'h-12 px-3 text-left align-middle text-xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase',
        $props.class,
      )
    "
  >
    <slot />
  </th>
</template>
