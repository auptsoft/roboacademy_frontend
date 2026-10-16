<script setup lang="ts">
import { computed } from 'vue'
import { Download, FileText, ImageOff } from 'lucide-vue-next'
import { useAssetUrl } from './assets'
import type { AudioBlock, FileBlock, ImageBlock, VideoBlock } from './types'

// Images, video, audio and downloads. Built for slow connections: nothing loads until it's near
// the screen (images) or the learner presses play (video and audio), and phones get the small image.
const props = defineProps<{ block: ImageBlock | VideoBlock | AudioBlock | FileBlock }>()
const assetUrl = useAssetUrl()

const src = computed(() => assetUrl(props.block.asset))
const srcset = computed(() => {
  if (props.block.type !== 'image' || !props.block.assetSmall) return undefined
  const small = assetUrl(props.block.assetSmall)
  return small && src.value ? `${small} 800w, ${src.value} 1600w` : undefined
})
const poster = computed(() => (props.block.type === 'video' ? assetUrl(props.block.poster) : undefined))
const transcript = computed(() =>
  props.block.type === 'video' || props.block.type === 'audio' ? props.block.transcript : undefined)
const caption = computed(() => (props.block.type === 'file' ? undefined : props.block.caption))
</script>

<template>
  <figure class="m-0">
    <template v-if="block.type === 'image'">
      <img
        v-if="src"
        :src="src"
        :srcset="srcset"
        sizes="(max-width: 768px) 100vw, 720px"
        :alt="block.alt"
        loading="lazy"
        decoding="async"
        class="block h-auto max-w-full rounded-(--ra-lg) border border-(--line-1)"
      >
      <div v-else class="flex aspect-video items-center justify-center rounded-(--ra-lg) border border-(--line-1) bg-(--bg-3) text-(--fg-4)" role="img" :aria-label="block.alt">
        <ImageOff :size="22" />
      </div>
    </template>

    <video
      v-else-if="block.type === 'video'"
      :src="src"
      :poster="poster"
      controls
      preload="none"
      playsinline
      class="block aspect-video w-full rounded-(--ra-lg) border border-(--line-1) bg-black"
    />

    <audio v-else-if="block.type === 'audio'" :src="src" controls preload="none" class="block w-full" />

    <a
      v-else-if="block.type === 'file'"
      :href="src"
      target="_blank"
      rel="noopener"
      :aria-disabled="!src"
      class="flex items-center gap-3 rounded-(--ra-lg) border border-(--line-1) bg-(--bg-2) px-4 py-3 no-underline hover:border-(--brand-blue)"
      :class="!src && 'pointer-events-none opacity-60'"
    >
      <FileText :size="20" class="shrink-0 text-(--fg-3)" />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-semibold text-(--fg-1)">{{ block.name }}</span>
        <span v-if="block.description" class="text-xs text-(--fg-3)">{{ block.description }}</span>
      </span>
      <Download :size="16" class="shrink-0 text-(--fg-3)" />
    </a>

    <figcaption v-if="caption" class="mt-2 text-[13px] text-(--fg-3)">{{ caption }}</figcaption>
    <details v-if="transcript" class="mt-2 text-[13px] text-(--fg-2)">
      <summary class="cursor-pointer text-(--fg-3)">Transcript</summary>
      <p class="mt-2 mb-0 whitespace-pre-line leading-[1.6]">{{ transcript }}</p>
    </details>
  </figure>
</template>
