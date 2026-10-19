<script setup lang="ts">
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { BLOCK_TYPES, type BlockType } from '@/lib/lesson-blocks'

/** Grouped block-type picker; the trigger is supplied by the parent via the default slot. */
defineEmits<{ select: [type: BlockType] }>()

const blockGroups = [...new Set(BLOCK_TYPES.map(t => t.group))]
  .map(group => ({ group, types: BLOCK_TYPES.filter(t => t.group === group) }))
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="max-h-[70vh] w-72 overflow-y-auto">
      <template v-for="{ group, types } in blockGroups" :key="group">
        <div class="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-(--fg-4)">{{ group }}</div>
        <DropdownMenuItem v-for="option in types" :key="option.type" class="items-start" @select="$emit('select', option.type)">
          <component :is="option.icon" class="mt-0.5" />
          <span class="flex flex-col">
            <span class="font-semibold text-(--fg-1)">{{ option.label }}</span>
            <span class="text-xs text-(--fg-3)">{{ option.description }}</span>
          </span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
