<script setup lang="ts">
defineProps<{
  padding?: string | number
  noBorder?: boolean
}>()
</script>

<template>
  <div class="ra-card" :style="{ padding: typeof padding === 'number' ? `${padding}px` : (padding ?? '20px') }">
    <slot />
  </div>
</template>

<style scoped>
.ra-card {
  background: var(--bg-2);
  border: 1px solid var(--line-1);
  border-radius: var(--ra-lg);
}
</style>
