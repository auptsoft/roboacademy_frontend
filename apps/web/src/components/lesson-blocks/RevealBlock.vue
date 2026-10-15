<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { renderRichText } from '@/lib/rich-text'
import type { RevealBlock } from './types'

// Explore-to-learn ("tap each part to see what it does"). Not a check: it never gates the lesson.
defineProps<{ block: RevealBlock }>()

const openIds = ref(new Set<string>())

function toggle(id: string) {
  const next = new Set(openIds.value)
  if (!next.delete(id)) next.add(id)
  openIds.value = next
}
</script>

<template>
  <div>
    <p v-if="block.prompt" class="mt-0 mb-3 text-[15px] font-semibold text-(--fg-1)">{{ block.prompt }}</p>
    <div class="grid grid-cols-2 gap-2 max-md:grid-cols-1">
      <div
        v-for="item in block.items"
        :key="item.id"
        :class="[
          'rounded-(--ra-md) border bg-(--bg-2)',
          openIds.has(item.id) ? 'border-(--brand-blue)' : 'border-(--line-2)',
        ]"
      >
        <button
          type="button"
          class="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent px-3.5 py-3 text-left text-sm font-semibold text-(--fg-1)"
          :aria-expanded="openIds.has(item.id)"
          :aria-controls="`reveal-${block.id}-${item.id}`"
          @click="toggle(item.id)"
        >
          {{ item.label }}
          <ChevronDown :size="14" :class="['shrink-0 text-(--fg-3) transition-transform', openIds.has(item.id) && 'rotate-180']" />
        </button>
        <div
          v-show="openIds.has(item.id)"
          :id="`reveal-${block.id}-${item.id}`"
          class="rich-text px-3.5 pb-3 text-[13px] leading-[1.6] text-(--fg-2)"
          v-html="renderRichText(item.body)"
        />
      </div>
    </div>
  </div>
</template>
