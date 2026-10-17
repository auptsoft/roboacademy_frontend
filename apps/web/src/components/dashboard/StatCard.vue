<script setup lang="ts">
import { ArrowUp, ArrowDown } from 'lucide-vue-next'

// Large-number KPI tile for the learner dashboard. `split` shows two figures side by side
// (e.g. done vs total); `navy` is the filled accent variant.
const props = defineProps<{
  label: string
  value: string
  caption?: string
  delta?: string
  deltaDirection?: 'up' | 'down'
  variant?: 'default' | 'navy' | 'split'
  secondaryValue?: string
  secondaryCaption?: string
}>()
</script>

<template>
  <div
    class="rounded-(--ra-xl) px-6 pt-6 pb-7 max-sm:p-3.5 flex flex-col min-w-0 shadow-(--surface-shadow)"
    :class="props.variant === 'navy' ? 'bg-(--brand-navy) text-(--brand-navy-fg)' : 'bg-(--surface) text-(--heading)'"
  >
    <span class="text-[15px] font-medium max-sm:text-[13px] max-sm:leading-tight">{{ props.label }}</span>

    <div v-if="props.variant === 'split'" class="grid grid-cols-2 gap-4 mt-7 max-sm:mt-2.5">
      <div class="min-w-0">
        <div class="text-[52px] font-bold leading-none tabular-nums text-(--success) max-sm:text-[28px]">{{ props.value }}</div>
        <div v-if="props.caption" class="mt-4 text-sm max-sm:mt-1.5 max-sm:text-xs text-(--fg-2)">{{ props.caption }}</div>
      </div>
      <div class="min-w-0">
        <div class="text-[52px] font-bold leading-none tabular-nums max-sm:text-[28px]">{{ props.secondaryValue }}</div>
        <div v-if="props.secondaryCaption" class="mt-4 text-sm max-sm:mt-1.5 max-sm:text-xs text-(--fg-3)">{{ props.secondaryCaption }}</div>
      </div>
    </div>

    <template v-else>
      <div class="mt-7 max-sm:mt-2.5 text-[52px] font-bold leading-none tabular-nums max-sm:text-[28px]">{{ props.value }}</div>
      <div v-if="props.delta || props.caption" class="mt-4 flex flex-wrap items-center gap-x-1.5 text-sm max-sm:mt-1.5 max-sm:text-xs max-sm:leading-tight">
        <template v-if="props.delta">
          <component
            :is="props.deltaDirection === 'down' ? ArrowDown : ArrowUp"
            :size="14"
            :class="props.variant === 'navy' ? '' : props.deltaDirection === 'down' ? 'text-(--danger)' : 'text-(--success)'"
          />
          <span
            class="font-medium"
            :class="props.variant === 'navy' ? '' : props.deltaDirection === 'down' ? 'text-(--danger)' : 'text-(--success)'"
          >{{ props.delta }}</span>
        </template>
        <span v-if="props.caption" :class="props.variant === 'navy' ? 'text-(--brand-navy-muted)' : 'text-(--fg-3)'">{{ props.caption }}</span>
      </div>
    </template>
  </div>
</template>
