<script setup lang="ts">
import { RaChip } from '@roboacademy/ui'
import { Lock, GripVertical, MoreVertical } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { OrderedItem } from '@/pages/courses/detail.vue'

defineProps<{
  item: OrderedItem
  isDraft: boolean
  toggling: boolean
  deleting: boolean
  reordering: boolean
  gatedByTitle: string | null
}>()
defineEmits<{ edit: []; open: []; 'toggle-required': []; delete: [] }>()
</script>

<template>
  <GripVertical
    v-if="isDraft"
    :size="14"
    class="shrink-0 text-(--fg-4)"
    :class="reordering ? 'cursor-not-allowed' : 'cursor-move'"
  />
  <button
    v-if="item.kind === 'assessment'"
    type="button"
    class="bg-transparent border-0 p-0 cursor-pointer text-sm text-(--fg-1) underline-offset-2 hover:underline"
    @click="$emit('open')"
  >
    {{ item.order }}. {{ item.title }}
  </button>
  <button
    v-else-if="isDraft"
    type="button"
    class="bg-transparent border-0 p-0 cursor-pointer text-sm text-(--fg-1) underline-offset-2 hover:underline"
    @click="$emit('edit')"
  >
    {{ item.order }}. {{ item.title }}
  </button>
  <span v-else class="text-sm text-(--fg-1)">{{ item.order }}. {{ item.title }}</span>

  <RaChip tone="neutral">{{ item.typeLabel }}</RaChip>
  <RaChip v-if="item.kind === 'assessment'" tone="info">Assessment</RaChip>

  <label class="ml-auto flex items-center gap-1.5 text-xs text-(--fg-3)">
    <input
      type="checkbox"
      class="size-3.5 accent-(--brand-blue)"
      :checked="item.isRequired"
      :disabled="toggling || (item.kind === 'lesson' && !isDraft)"
      @change="$emit('toggle-required')"
    >
    Required
  </label>

  <span
    v-if="gatedByTitle"
    class="inline-flex items-center gap-1 text-[11px] text-(--fg-4)"
    :title="`Locked for a learner until '${gatedByTitle}' is completed or passed`"
  >
    <Lock :size="11" /> gated by "{{ gatedByTitle }}"
  </span>

  <DropdownMenu>
    <DropdownMenuTrigger
      class="inline-flex size-7 shrink-0 items-center justify-center rounded-(--ra-md) border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-(--bg-3) hover:text-(--fg-1)"
    >
      <MoreVertical :size="14" />
      <span class="sr-only">Open actions</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem
        variant="destructive"
        :disabled="deleting || (item.kind === 'lesson' && !isDraft)"
        @select="$emit('delete')"
      >
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
