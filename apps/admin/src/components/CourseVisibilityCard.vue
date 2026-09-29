<script setup lang="ts">
import { ref, watch } from 'vue'
import { RaCard, RaChip } from '@roboacademy/ui'
import { ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { COURSE_VISIBILITIES, visibilityLabel, type CourseVisibility, type CourseState } from '@/api/learning'

const props = defineProps<{
  visibility: CourseVisibility
  state: CourseState
  saving: boolean
}>()
const emit = defineEmits<{ save: [visibility: CourseVisibility] }>()

const open = ref(false)
const selected = ref<CourseVisibility>(props.visibility)
watch(() => props.visibility, (value) => { selected.value = value })
</script>

<template>
  <RaCard id="visibility" :padding="0" class="scroll-mt-6 overflow-hidden">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
        <div>
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">Visibility</h3>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">
            Controls who sees this course in the student catalog. Admins can enroll students at any level.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <RaChip tone="neutral">{{ visibilityLabel(visibility) }}</RaChip>
          <ChevronDown :size="16" class="text-(--fg-3) transition-transform duration-200" :class="open && 'rotate-180'" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form class="flex flex-col gap-3 py-5 px-6" @submit.prevent="emit('save', selected)">
          <label
            v-for="option in COURSE_VISIBILITIES"
            :key="option.value"
            class="flex cursor-pointer items-start gap-3 rounded-(--ra-md) border p-3 transition-colors"
            :class="selected === option.value ? 'border-(--brand-blue) bg-(--brand-blue-soft)' : 'border-(--line-2) hover:bg-(--bg-3)'"
          >
            <input
              v-model="selected"
              type="radio"
              name="course-visibility"
              :value="option.value"
              class="mt-0.5 size-4 accent-(--brand-blue)"
            >
            <span>
              <span class="block text-sm font-semibold text-(--fg-1)">{{ option.label }}</span>
              <span class="block text-xs text-(--fg-3)">{{ option.description }}</span>
            </span>
          </label>
          <p v-if="state !== 'Published'" class="m-0 text-xs text-(--fg-4)">
            This course is a draft, so students won't see it until it's published, whatever you choose here.
          </p>
          <div class="flex justify-end">
            <Button type="submit" :disabled="saving || selected === visibility">
              {{ saving ? 'Saving…' : 'Save visibility' }}
            </Button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  </RaCard>
</template>
