<script setup lang="ts">
import { onMounted } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { useAIAvailability } from '@/composables/useAIAvailability'
import { useStaffAssistant } from '@/composables/useStaffAssistant'
import StaffAssistantPanel from './StaffAssistantPanel.vue'

// A button on every admin page (bottom-right), shown only when the school offers the staff assistant.

const { feature, load } = useAIAvailability()
const { open, openAssistant } = useStaffAssistant()

onMounted(() => void load())
</script>

<template>
  <template v-if="feature('StaffAssistant')?.available">
    <button
      v-if="!open"
      type="button"
      class="fixed right-6 bottom-6 z-30 inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-(--brand-blue) py-3 pr-5 pl-4 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 max-md:right-4 max-md:bottom-4 max-md:p-3.5"
      aria-label="Ask the assistant"
      @click="openAssistant()"
    >
      <Sparkles :size="18" />
      <span class="max-md:hidden">Ask the assistant</span>
    </button>
    <StaffAssistantPanel />
  </template>
</template>
