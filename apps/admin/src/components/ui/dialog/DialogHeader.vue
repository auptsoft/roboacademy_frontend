<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@roboacademy/ui'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div :class="cn('flex flex-col gap-2', $props.class)">
    <slot />
  </div>
</template>
