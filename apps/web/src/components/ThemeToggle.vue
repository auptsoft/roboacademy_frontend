<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next'
import { useThemeSwitcher } from '@roboacademy/ui'

const { mode, isDark } = useThemeSwitcher()

function toggleTheme() {
  mode.value = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <button
    class="w-9 h-9 rounded-full bg-transparent border border-(--line-2) text-(--fg-3) cursor-pointer inline-grid place-items-center relative transition-colors duration-(--dur-1) ease-(--ease-out) p-0 hover:text-(--fg-1) hover:bg-(--bg-3) hover:border-(--line-3)"
    type="button" @click="toggleTheme" aria-label="Toggle theme"
  >
    <Sun :size="16" :class="['absolute opacity-0 rotate-90 [transition:opacity_var(--dur-2)_var(--ease-out),transform_var(--dur-3)_var(--ease-out)]', isDark && 'opacity-100 rotate-0']" />
    <Moon :size="16" :class="['absolute opacity-0 rotate-90 [transition:opacity_var(--dur-2)_var(--ease-out),transform_var(--dur-3)_var(--ease-out)]', !isDark && 'opacity-100 rotate-0']" />
  </button>
</template>
