<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { mainNav } from './nav-items'

const route = useRoute()
const router = useRouter()

const tabs = [
  ...mainNav
]

function isActive(path: string) {
  if (path === '/app') return route.path === '/app'
  return route.path.startsWith(path)
}
</script>

<template>
  <nav class="hidden fixed inset-x-0 bottom-0 z-50 h-[60px] bg-(--bg-1) border-t border-(--line-1) max-md:flex">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="flex-1 flex flex-col items-center justify-center gap-[3px] bg-transparent border-0 cursor-pointer transition-colors duration-(--dur-1) ease-(--ease-out)"
      :class="isActive(tab.path) ? 'text-(--brand-blue)' : 'text-(--fg-4)'"
      @click="router.push(tab.path)"
    >
      <component :is="tab.icon" :size="18" />
      <span class="text-[10px] font-semibold">{{ tab.label }}</span>
    </button>
  </nav>
</template>
