<script setup lang="ts">
import { Star } from 'lucide-vue-next'

// Up to three challenge stars for a simulation lesson: filled for those earned.
const props = withDefaults(defineProps<{ stars: number; size?: number }>(), { size: 16 })
</script>

<template>
  <span class="inline-flex items-center gap-0.5" role="img" :aria-label="`${props.stars} of 3 stars`">
    <Star
      v-for="n in 3"
      :key="n"
      :size="props.size"
      :class="n <= props.stars ? 'text-(--warning) fill-current' : 'text-(--line-3)'"
      aria-hidden="true"
    />
  </span>
</template>
