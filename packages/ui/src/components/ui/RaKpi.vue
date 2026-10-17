<script setup lang="ts">
import { computed, type Component } from 'vue'
import RaCard from './RaCard.vue'

const props = defineProps<{
  label: string
  value: string
  delta?: string
  deltaTone?: 'success' | 'muted' | 'danger'
  icon?: Component
  // Any CSS color; tints the icon badge and progress bar. Defaults to the brand color.
  accent?: string
  // 0-100. Renders a meter under the value (e.g. plan usage).
  progress?: number
}>()

const accentColor = computed(() => props.accent ?? 'var(--brand-blue)')
const clampedProgress = computed(() =>
  props.progress === undefined ? undefined : Math.max(0, Math.min(100, props.progress)))
// The meter turns amber, then red, as it fills, whatever the accent.
const progressColor = computed(() => {
  const p = clampedProgress.value ?? 0
  if (p >= 100) return 'var(--danger)'
  if (p >= 80) return 'var(--warning)'
  return accentColor.value
})
</script>

<template>
  <RaCard padding="18px" class="kpi" :style="{ '--kpi-accent': accentColor }">
    <div class="kpi-header">
      <span class="kpi-label">{{ label }}</span>
      <span v-if="icon" class="kpi-icon" aria-hidden="true">
        <component :is="icon" :size="16" />
      </span>
    </div>
    <div class="kpi-value">{{ value }}</div>
    <div
      v-if="clampedProgress !== undefined"
      class="kpi-meter"
      role="meter"
      :aria-valuenow="clampedProgress"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label"
    >
      <div class="kpi-meter-fill" :style="{ width: `${clampedProgress}%`, background: progressColor }" />
    </div>
    <div v-if="delta" :class="['kpi-delta', `kpi-delta--${deltaTone ?? 'success'}`]">{{ delta }}</div>
  </RaCard>
</template>

<style scoped>
.kpi {
  display: flex;
  flex-direction: column;
  transition: box-shadow 160ms ease, transform 160ms ease;
}
.kpi:hover {
  box-shadow: var(--shadow-card-hover, none);
}
.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.kpi-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-3);
}
.kpi-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--ra-md);
  color: var(--kpi-accent);
  background: color-mix(in srgb, var(--kpi-accent) 12%, transparent);
}
.kpi-value {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fg-1);
  margin-top: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.kpi-meter {
  height: 6px;
  margin-top: 12px;
  border-radius: var(--ra-pill);
  background: color-mix(in srgb, var(--kpi-accent) 12%, var(--bg-3));
  overflow: hidden;
}
.kpi-meter-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 400ms ease;
}
.kpi-delta {
  font-size: 12px;
  margin-top: 8px;
}
.kpi-delta--success { color: var(--success); }
.kpi-delta--muted   { color: var(--fg-3); }
.kpi-delta--danger  { color: var(--danger); }
</style>
