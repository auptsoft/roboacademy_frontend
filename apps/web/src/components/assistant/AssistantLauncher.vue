<script setup lang="ts">
import { onMounted } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { useAIAvailability } from '@/composables/useAIAvailability'
import { useAssistant } from '@/composables/useAssistant'
import AssistantPanel from './AssistantPanel.vue'

// A button on every page of the learner app (bottom-right, above the phone nav bar), shown only
// when the school offers the assistant.

const { assistantAvailable, load } = useAIAvailability()
const { open, openAssistant } = useAssistant()

onMounted(() => void load())

</script>

<template>
  <template v-if="assistantAvailable">
    <button
      v-if="!open"
      type="button"
      class="fixed right-6 bottom-6 z-30 inline-flex items-center gap-2 rounded-(--ra-pill) border-0 bg-(--brand-navy) py-3 pr-5 pl-4 text-sm font-semibold text-(--brand-navy-fg) shadow-lg cursor-pointer transition-transform duration-(--dur-1) ease-(--ease-out) hover:-translate-y-0.5 max-md:right-4 max-md:bottom-[76px] max-md:p-3.5"
      aria-label="Ask the assistant"
      @click="openAssistant()"
    >
      <Sparkles :size="18" />
      <span class="max-md:hidden">Ask the assistant</span>
    </button>
    <AssistantPanel />
  </template>
</template>
