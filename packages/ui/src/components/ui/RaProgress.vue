<script setup lang="ts">
defineProps<{
  value: number
  tone?: 'blue' | 'violet' | 'green'
}>()
</script>

<template>
  <div class="track">
    <div class="fill" :class="`fill--${tone ?? 'blue'}`" :style="{ width: `${value}%` }" />
  </div>
</template>

<style scoped>
.track {
  height: 6px;
  background: rgba(255,255,255,0.08);
  border-radius: var(--ra-pill);
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: var(--ra-pill);
  transition: width 600ms var(--ease-out);
}
.fill--blue   { background: var(--brand-blue); }
.fill--violet { background: var(--brand-violet); }
.fill--green  { background: var(--success); }
</style>
