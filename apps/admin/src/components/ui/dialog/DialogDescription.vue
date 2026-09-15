<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DialogDescription as DialogDescriptionPrimitive } from 'reka-ui'
import { cn } from '@roboacademy/ui'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <DialogDescriptionPrimitive :class="cn('mt-0.5 text-sm leading-relaxed text-muted-foreground', $props.class)">
    <slot />
  </DialogDescriptionPrimitive>
</template>
