<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
}>()
</script>

<template>
  <button :class="['ra-btn', `ra-btn--${variant ?? 'primary'}`]" :disabled="disabled">
    <slot name="icon" />
    <slot />
    <slot name="icon-right" />
  </button>
</template>

<style scoped>
.ra-btn {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--ra-md);
  padding: 10px 18px;
  border: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background var(--dur-1) var(--ease-out), color var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out);
  white-space: nowrap;
  line-height: 1;
}
.ra-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ra-btn--primary { background: var(--brand-blue); color: #fff; }
.ra-btn--primary:hover:not(:disabled) { background: var(--brand-blue-hover); }
.ra-btn--primary:active:not(:disabled) { background: var(--brand-blue-press); }

.ra-btn--secondary {
  background: var(--bg-3);
  color: var(--fg-2);
  border: 1px solid var(--line-3);
}
.ra-btn--secondary:hover:not(:disabled) { background: var(--bg-4); }

.ra-btn--ghost { background: transparent; color: var(--fg-3); border: 0; }
.ra-btn--ghost:hover:not(:disabled) { color: var(--fg-2); }
</style>
