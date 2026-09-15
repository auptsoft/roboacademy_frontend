<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CollapsibleContent as CollapsibleContentPrimitive } from 'reka-ui'
import { cn } from '@roboacademy/ui'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <CollapsibleContentPrimitive
    :class="
      cn(
        'grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out data-[state=open]:grid-rows-[1fr]',
        props.class,
      )
    "
  >
    <div class="overflow-hidden">
      <slot />
    </div>
  </CollapsibleContentPrimitive>
</template>
