<script setup lang="ts">
import { computed, ref } from 'vue'
import { MonitorPlay } from 'lucide-vue-next'
import { isAllowedEmbed, type EmbedBlock } from './types'

// An outside activity (Wokwi, Tinkercad, YouTube, H5P). Simulators are heavy, so the frame only
// loads when the learner asks for it - on 3G that's the difference between a lesson that opens
// and one that stalls. Sandboxed, and only ever from the allowlisted hosts.
const props = defineProps<{ block: EmbedBlock }>()
const loaded = ref(false)

const allowed = computed(() => isAllowedEmbed(props.block.url))
const aspect = computed(() => ({ '16:9': '16 / 9', '4:3': '4 / 3', '1:1': '1 / 1' })[props.block.aspect ?? '16:9'])
</script>

<template>
  <div v-if="allowed" class="overflow-hidden rounded-(--ra-lg) border border-(--line-1) bg-(--bg-2)" :style="{ aspectRatio: aspect }">
    <iframe
      v-if="loaded"
      :src="block.url"
      :title="block.title"
      class="block h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
      allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
      referrerpolicy="strict-origin-when-cross-origin"
    />
    <button
      v-else
      type="button"
      class="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 border-0 bg-transparent text-(--fg-2) hover:text-(--fg-1)"
      @click="loaded = true"
    >
      <MonitorPlay :size="28" class="text-(--brand-blue)" />
      <span class="text-sm font-semibold">{{ block.title }}</span>
      <span class="text-xs text-(--fg-3)">Tap to load the activity</span>
    </button>
  </div>
</template>
