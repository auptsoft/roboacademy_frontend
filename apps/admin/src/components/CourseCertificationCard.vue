<script setup lang="ts">
import { ref, watch } from 'vue'
import { RaCard, RaChip } from '@roboacademy/ui'
import { ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

const props = defineProps<{
  requiresPractical: boolean
  saving: boolean
}>()
const emit = defineEmits<{ save: [requiresPractical: boolean] }>()

const open = ref(false)
const selected = ref(props.requiresPractical)
watch(() => props.requiresPractical, (value) => { selected.value = value })

const options = [
  {
    value: true,
    label: 'Lessons, assessments and a practical',
    description: 'The learner must also pass a practical session (simulation or robot lab).',
  },
  {
    value: false,
    label: 'Lessons and assessments only',
    description: 'For courses with no practical component. The learner is certified without one.',
  },
]
</script>

<template>
  <RaCard id="certification" :padding="0" class="scroll-mt-6 overflow-hidden">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
        <div>
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">Certification</h3>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">
            What a learner must complete to earn this course's certificate. Required lessons and required assessments always count.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <RaChip tone="neutral">{{ requiresPractical ? 'Practical required' : 'No practical' }}</RaChip>
          <ChevronDown :size="16" class="text-(--fg-3) transition-transform duration-200" :class="open && 'rotate-180'" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form class="flex flex-col gap-3 py-5 px-6" @submit.prevent="emit('save', selected)">
          <label
            v-for="option in options"
            :key="String(option.value)"
            class="flex cursor-pointer items-start gap-3 rounded-(--ra-md) border p-3 transition-colors"
            :class="selected === option.value ? 'border-(--brand-blue) bg-(--brand-blue-soft)' : 'border-(--line-2) hover:bg-(--bg-3)'"
          >
            <input
              v-model="selected"
              type="radio"
              name="course-practical-requirement"
              :value="option.value"
              class="mt-0.5 size-4 accent-(--brand-blue)"
            >
            <span>
              <span class="block text-sm font-semibold text-(--fg-1)">{{ option.label }}</span>
              <span class="block text-xs text-(--fg-3)">{{ option.description }}</span>
            </span>
          </label>
          <p class="m-0 text-xs text-(--fg-4)">
            Applies to certificates issued from now on. Learners who already qualify under the new rule aren't certified automatically; issue theirs from the Certificates page.
          </p>
          <div class="flex justify-end">
            <Button type="submit" :disabled="saving || selected === requiresPractical">
              {{ saving ? 'Saving…' : 'Save requirement' }}
            </Button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  </RaCard>
</template>
