<script setup lang="ts">
import RaCard from './RaCard.vue'

defineProps<{
  label: string
  value: string
  delta?: string
  deltaTone?: 'success' | 'muted'
  icon?: string
}>()
</script>

<template>
  <RaCard padding="18px">
    <div class="kpi-header">
      <span class="kpi-label">{{ label }}</span>
      <component v-if="icon" :is="`lucide-${icon}`" class="kpi-icon" />
    </div>
    <div class="kpi-value">{{ value }}</div>
    <div v-if="delta" :class="['kpi-delta', `kpi-delta--${deltaTone ?? 'success'}`]">{{ delta }}</div>
  </RaCard>
</template>

<style scoped>
.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.kpi-label {
  font-size: 12px;
  color: var(--fg-3);
}
.kpi-icon {
  width: 16px;
  height: 16px;
  color: var(--fg-4);
}
.kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--fg-1);
  margin-top: 8px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.kpi-delta {
  font-size: 11px;
  margin-top: 8px;
}
.kpi-delta--success { color: var(--success); }
.kpi-delta--muted   { color: var(--fg-3); }
</style>
