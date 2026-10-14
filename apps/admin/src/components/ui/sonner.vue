<script setup lang="ts">
import { computed } from 'vue'
import { Toaster as Sonner } from 'vue-sonner'
// vue-sonner v2 no longer injects its styles; without this the toasts render unstyled and unseen.
import 'vue-sonner/style.css'
import { useThemeSwitcher } from '@roboacademy/ui'

const { isDark } = useThemeSwitcher()
const theme = computed(() => (isDark.value ? 'dark' : 'light'))
</script>

<template>
  <Sonner
    :theme="theme"
    rich-colors
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
    }"
  />
</template>
