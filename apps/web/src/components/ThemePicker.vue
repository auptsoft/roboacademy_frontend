<template>
  <div class="flex items-center gap-1 bg-secondary-100 dark:bg-secondary-800 p-1 rounded-xl border border-secondary-200 dark:border-secondary-700">
    <Button
      v-for="item in modes"
      :key="item.id"
      @click="mode = item.id"
      variant="ghost"
      square
      size="sm"
      class="rounded-lg transition-all relative group"
      :class="mode === item.id ? 'text-primary' : ''"
      :title="item.name"
    >
      <component :is="item.icon" class="w-4 h-4" />
      <span class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-secondary-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {{ item.name }}
      </span>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Sun, Moon, Monitor } from 'lucide-vue-next';
import Button from './ui/button/Button.vue';
import { useThemeSwitcher, type ThemeMode } from '@roboacademy/ui';

const { mode } = useThemeSwitcher()

const modes: { id: ThemeMode; name: string; icon: typeof Sun }[] = [
  { id: 'light', name: 'Light', icon: Sun },
  { id: 'dark', name: 'Dark', icon: Moon },
  { id: 'system', name: 'System', icon: Monitor }
];
</script>
