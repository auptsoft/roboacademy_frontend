<script setup lang="ts">
defineProps<{
  tone?: 'admin' | 'instructor' | 'student' | 'info' | 'overlay' | 'neutral'
}>()
</script>

<template>
  <span :class="['ra-chip', `ra-chip--${tone ?? 'student'}`]">
    <slot />
  </span>
</template>

<style scoped>
.ra-chip {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: var(--ra-pill);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}
.ra-chip--admin {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 32%, transparent);
}
.ra-chip--instructor {
  color: var(--secondary);
  background: color-mix(in srgb, var(--secondary) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--secondary) 45%, transparent);
}
.ra-chip--student {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 16%, transparent);
}
.ra-chip--info {
  color: var(--primary);
  background: var(--brand-blue-soft);
  border: 1px solid var(--brand-blue-ring);
}
.ra-chip--overlay {
  color: #fff;
  background: rgba(0,0,0,0.65);
  border: 1px solid rgba(255,255,255,0.14);
}
.ra-chip--neutral {
  color: var(--fg-2);
  background: var(--bg-4);
  border: 1px solid var(--line-2);
}
</style>
