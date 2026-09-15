<script setup lang="ts">
defineProps<{
  status?: 'active' | 'offline' | 'busy'
  label?: string
}>()
</script>

<template>
  <span class="status-dot-wrap">
    <span :class="['dot', `dot--${status ?? 'offline'}`]" />
    <span v-if="label" :class="['label', `label--${status ?? 'offline'}`]">{{ label }}</span>
  </span>
</template>

<style scoped>
.status-dot-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--active  { background: var(--dot-active); }
.dot--offline { background: var(--dot-offline); }
.dot--busy    { background: var(--dot-busy); }
.label--active  { color: var(--dot-active); }
.label--offline { color: var(--fg-3); }
.label--busy    { color: var(--dot-busy); }
</style>
