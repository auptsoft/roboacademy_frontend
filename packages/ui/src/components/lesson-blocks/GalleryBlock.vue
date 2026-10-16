<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-vue-next'
import { useAssetUrl } from './assets'
import type { GalleryBlock } from './types'

// Step-by-step photos. A scroll-snap strip, so swiping works natively on phones; the buttons and
// counter are for keyboards and desktops. Photos load lazily, small copies on phones.
const props = defineProps<{ block: GalleryBlock }>()
const assetUrl = useAssetUrl()
const strip = ref<HTMLElement | null>(null)
const current = ref(0)

const images = computed(() => props.block.images.map(image => {
  const src = assetUrl(image.asset)
  const small = assetUrl(image.assetSmall)
  return { ...image, src, srcset: small && src ? `${small} 800w, ${src} 1600w` : undefined }
}))

function go(index: number) {
  const target = Math.max(0, Math.min(index, images.value.length - 1))
  strip.value?.children[target]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
}

function onScroll() {
  if (!strip.value) return
  current.value = Math.round(strip.value.scrollLeft / strip.value.clientWidth)
}
</script>

<template>
  <figure class="m-0" role="group" :aria-label="`Photo gallery, ${images.length} photos`">
    <div
      ref="strip"
      class="flex snap-x snap-mandatory overflow-x-auto rounded-(--ra-lg) border border-(--line-1) bg-(--bg-3) [scrollbar-width:none]"
      @scroll.passive="onScroll"
    >
      <div v-for="image in images" :key="image.id" class="w-full shrink-0 snap-start">
        <img
          v-if="image.src"
          :src="image.src"
          :srcset="image.srcset"
          sizes="(max-width: 768px) 100vw, 720px"
          :alt="image.alt"
          loading="lazy"
          decoding="async"
          class="block aspect-[4/3] w-full object-contain"
        >
        <div v-else class="flex aspect-[4/3] items-center justify-center text-(--fg-4)" role="img" :aria-label="image.alt">
          <ImageOff :size="22" />
        </div>
      </div>
    </div>
    <div class="mt-2 flex items-center gap-3">
      <button
        type="button"
        class="flex size-8 cursor-pointer items-center justify-center rounded-full border border-(--line-2) bg-(--bg-2) text-(--fg-2) disabled:cursor-default disabled:opacity-30"
        :disabled="current === 0"
        aria-label="Previous photo"
        @click="go(current - 1)"
      >
        <ChevronLeft :size="16" />
      </button>
      <span class="text-xs text-(--fg-3)" aria-live="polite">{{ current + 1 }} / {{ images.length }}</span>
      <button
        type="button"
        class="flex size-8 cursor-pointer items-center justify-center rounded-full border border-(--line-2) bg-(--bg-2) text-(--fg-2) disabled:cursor-default disabled:opacity-30"
        :disabled="current >= images.length - 1"
        aria-label="Next photo"
        @click="go(current + 1)"
      >
        <ChevronRight :size="16" />
      </button>
      <figcaption v-if="images[current]?.caption" class="min-w-0 flex-1 text-[13px] text-(--fg-3)">{{ images[current]!.caption }}</figcaption>
    </div>
  </figure>
</template>
