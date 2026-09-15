<script setup lang="ts">
import { ref } from 'vue'
import { RaCard, RaChip } from '@roboacademy/ui'
import { ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import type { CourseState } from '@/api/learning'

defineProps<{
  state: CourseState
  isDraft: boolean
  canPublish: boolean
  publishing: boolean
  unpublishing: boolean
}>()
defineEmits<{ publish: []; unpublish: [] }>()

const open = ref(false)
</script>

<template>
  <RaCard id="publish" :padding="0" class="scroll-mt-6 overflow-hidden">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
        <div>
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">Publish</h3>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">
            Unpublishing returns the course to Draft so modules and lessons can be edited again.
          </p>
        </div>
        <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="open && 'rotate-180'" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="py-5 px-6">
          <div class="flex items-center justify-between">
            <RaChip :tone="state === 'Published' ? 'info' : 'neutral'">{{ state }}</RaChip>
            <Button v-if="isDraft" :disabled="!canPublish || publishing" @click="$emit('publish')">
              {{ publishing ? 'Publishing…' : 'Publish Course' }}
            </Button>
            <Button v-else variant="outline" :disabled="unpublishing" @click="$emit('unpublish')">
              {{ unpublishing ? 'Unpublishing…' : 'Unpublish Course' }}
            </Button>
          </div>
          <p v-if="isDraft && !canPublish" class="m-0 mt-2 text-xs text-(--fg-4)">
            Add at least one module with at least one lesson before publishing.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </RaCard>
</template>
