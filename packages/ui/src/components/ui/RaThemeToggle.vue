<script setup lang="ts">
import { Sun, Moon, Monitor } from 'lucide-vue-next'
import { useThemeSwitcher, type ThemeMode } from '../../composables/theme-switcher'

const { mode } = useThemeSwitcher()

const modes: { id: ThemeMode; name: string; icon: typeof Sun }[] = [
  { id: 'light', name: 'Light', icon: Sun },
  { id: 'dark', name: 'Dark', icon: Moon },
  { id: 'system', name: 'System', icon: Monitor },
]
</script>

<template>
  <div class="theme-toggle-wrap" role="radiogroup" aria-label="Theme">
    <button
      v-for="m in modes"
      :key="m.id"
      type="button"
      class="theme-toggle-btn"
      :class="{ 'theme-toggle-btn--active': mode === m.id }"
      :aria-pressed="mode === m.id"
      :title="m.name"
      @click="mode = m.id"
    >
      <component :is="m.icon" :size="16" />
    </button>
  </div>
</template>

<style scoped>
.theme-toggle-wrap {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--bg-2);
  border: 1px solid var(--line-2);
  border-radius: var(--ra-md);
}
.theme-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: calc(var(--ra-md) - 2px);
  background: transparent;
  color: var(--fg-3);
  cursor: pointer;
  transition: background var(--dur-1) var(--ease-out), color var(--dur-1) var(--ease-out);
}
.theme-toggle-btn:hover {
  color: var(--fg-1);
}
.theme-toggle-btn--active {
  background: var(--bg-4);
  color: var(--brand-blue);
}
</style>
