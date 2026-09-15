<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { X } from 'lucide-vue-next'
import { DialogClose, DialogContent as DialogContentPrimitive, DialogOverlay, DialogPortal } from 'reka-ui'
import { cn } from '@roboacademy/ui'

defineProps<{
  class?: HTMLAttributes['class']
  showCloseButton?: boolean
}>()
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
    />
    <DialogContentPrimitive class="group fixed inset-0 z-50 flex items-center justify-center p-4 outline-none">
      <div
        :class="
          cn(
            'relative grid w-full max-w-md max-h-[calc(100vh-2rem)] gap-6 overflow-y-auto rounded-none bg-popover p-6 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 group-data-[state=open]:animate-in group-data-[state=open]:fade-in-0 group-data-[state=open]:zoom-in-95 group-data-[state=closed]:animate-out group-data-[state=closed]:fade-out-0 group-data-[state=closed]:zoom-out-95',
            $props.class,
          )
        "
      >
        <slot />
        <DialogClose
          v-if="showCloseButton !== false"
          class="absolute top-5 right-5 inline-flex size-9 items-center justify-center bg-secondary text-secondary-foreground hover:bg-secondary/80"
        >
          <X class="size-4" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </div>
    </DialogContentPrimitive>
  </DialogPortal>
</template>
