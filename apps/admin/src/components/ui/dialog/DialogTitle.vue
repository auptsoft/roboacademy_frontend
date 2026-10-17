<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DialogTitle as DialogTitlePrimitive } from 'reka-ui'
import { cn } from '@roboacademy/ui'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <DialogTitlePrimitive :class="cn('text-lg leading-tight font-semibold tracking-[-0.01em]', $props.class)">
    <slot />
  </DialogTitlePrimitive>
</template>
