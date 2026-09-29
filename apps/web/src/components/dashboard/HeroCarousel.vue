<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RaButton } from '@roboacademy/ui'
import { Cpu } from 'lucide-vue-next'

export interface HeroSlide {
  id: string
  title: string
  body: string
  ctaLabel: string
  imageUrl?: string | null
  onCta: () => void
}

const props = withDefaults(defineProps<{
  slides: HeroSlide[]
  intervalMs?: number
}>(), { intervalMs: 7000 })

const index = ref(0)
const current = computed(() => props.slides[index.value] ?? props.slides[0])

watch(() => props.slides.length, (len) => {
  if (index.value >= len) index.value = 0
})

function go(i: number) {
  const len = props.slides.length
  if (!len) return
  index.value = (i + len) % len
}

let timer: ReturnType<typeof setInterval> | undefined
const paused = ref(false)

function start() {
  stop()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  timer = setInterval(() => {
    if (!paused.value && props.slides.length > 1) go(index.value + 1)
  }, props.intervalMs)
}

function stop() {
  if (timer) clearInterval(timer)
  timer = undefined
}

onMounted(start)
onUnmounted(stop)
</script>

<template>
  <section
    v-if="current"
    class="flex flex-col items-center gap-4"
    aria-roledescription="carousel"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
    @focusin="paused = true"
    @focusout="paused = false"
    @keydown.left="go(index - 1)"
    @keydown.right="go(index + 1)"
  >
    <Transition name="hero-fade" mode="out-in">
      <div
        :key="current.id"
        class="relative w-full min-h-[240px] overflow-hidden rounded-(--ra-xl) bg-(--surface) shadow-(--surface-shadow) grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] max-md:grid-cols-1"
        role="group"
        :aria-label="`Slide ${index + 1} of ${props.slides.length}`"
      >
        <!-- Decorative chevron pattern, like the reference banner. -->
        <div class="pointer-events-none absolute inset-0 opacity-[0.05] bg-[repeating-linear-gradient(135deg,var(--brand-navy)_0_2px,transparent_2px_48px)]" />

        <div class="relative min-h-[180px] max-md:h-44">
          <img v-if="current.imageUrl" :src="current.imageUrl" alt="" class="absolute inset-0 w-full h-full object-cover" />
          <div v-else class="absolute inset-0 flex items-center justify-center bg-(--sidebar-active-bg)">
            <span class="w-20 h-20 rounded-(--ra-xl) bg-(--brand-navy) flex items-center justify-center text-(--brand-navy-fg)">
              <Cpu :size="40" />
            </span>
          </div>
        </div>

        <div class="relative flex flex-col justify-center items-start gap-3 px-10 py-8 max-md:px-6 max-md:py-6">
          <h2 class="m-0 text-[30px] font-bold text-(--heading) leading-tight max-sm:text-2xl">{{ current.title }}</h2>
          <p class="m-0 text-base text-(--fg-2) max-w-140">{{ current.body }}</p>
          <RaButton class="mt-2" @click="current.onCta()">{{ current.ctaLabel }}</RaButton>
        </div>

        <div class="absolute inset-x-0 bottom-0 h-2 bg-(--brand-sand)" />
      </div>
    </Transition>

    <div v-if="props.slides.length > 1" class="flex items-center gap-2">
      <button
        v-for="(slide, i) in props.slides"
        :key="slide.id"
        class="w-2 h-2 rounded-full border-0 p-0 cursor-pointer transition-colors duration-(--dur-2)"
        :class="i === index ? 'bg-(--brand-navy)' : 'bg-(--line-3)'"
        :aria-label="`Go to slide ${i + 1}`"
        :aria-current="i === index ? 'true' : undefined"
        @click="go(i)"
      />
    </div>
  </section>
</template>

<style scoped>
.hero-fade-enter-active,
.hero-fade-leave-active {
  transition: opacity var(--dur-3) var(--ease-out);
}
.hero-fade-enter-from,
.hero-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .hero-fade-enter-active,
  .hero-fade-leave-active {
    transition: none;
  }
}
</style>
