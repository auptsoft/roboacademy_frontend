<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { Cpu, HelpCircle } from 'lucide-vue-next'
import { mainNav } from './nav-items'
import type { TenantBranding } from '@/api/tenancy'

const route = useRoute()
const router = useRouter()

const props = defineProps<{
  branding: TenantBranding
}>()

function isActive(path: string) {
  if (path === '/app') return route.path === '/app'
  return route.path.startsWith(path)
}
</script>

<template>
  <aside class="flex flex-col w-(--sidebar-w) shrink-0 h-full bg-(--surface) border-r border-(--line-1) px-6 pt-8 pb-6 overflow-y-auto max-md:hidden">
    <button class="flex justify-center items-center gap-2.5 bg-transparent border-0 p-0 cursor-pointer text-left" @click="router.push('/app')">
      <img v-if="props.branding.logoUrl" :src="props.branding.logoUrl" :alt="`${props.branding.name} logo`" class="h-12 max-w-full object-contain" />
      <template v-else>
        <span class="w-9 h-9 rounded-(--ra-md) bg-(--brand-navy) flex items-center justify-center text-(--brand-navy-fg) shrink-0">
          <Cpu :size="20" />
        </span>
        <span class="text-(--heading) text-lg font-bold tracking-[-0.01em] truncate">{{ props.branding.name || 'RoboAcademy' }}</span>
      </template>
    </button>

    <nav class="flex flex-col gap-2 mt-12">
      <button
        v-for="item in mainNav"
        :key="item.id"
        class="flex items-center gap-3 px-4 py-3 rounded-(--ra-md) cursor-pointer text-[15px] bg-transparent border-0 text-left transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--sidebar-active-bg) hover:text-(--heading)"
        :class="isActive(item.path) ? 'bg-(--sidebar-active-bg)! text-(--heading) font-semibold' : 'text-(--fg-2) font-medium'"
        :aria-current="isActive(item.path) ? 'page' : undefined"
        @click="router.push(item.path)"
      >
        <component :is="item.icon" :size="20" :stroke-width="1.75" />
        {{ item.label }}
      </button>
    </nav>

    <div class="relative mt-auto pt-10">
      <div class="relative overflow-hidden rounded-(--ra-lg) bg-(--brand-navy) text-(--brand-navy-fg) px-5 pt-10 pb-6 text-center">
        <span class="pointer-events-none absolute -top-10 -left-10 w-28 h-28 rounded-full bg-white/5" />
        <span class="pointer-events-none absolute -bottom-12 -right-10 w-32 h-32 rounded-full bg-white/5" />
        <div class="relative text-base font-semibold">Help Center</div>
        <p class="relative mt-2 mb-0 text-[13px] leading-relaxed text-(--brand-navy-muted)">
          Having trouble? Reach out to your {{ props.branding.name || 'academy' }} administrator for help.
        </p>
      </div>
      <span class="absolute top-10 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-(--brand-sand) border-4 border-(--surface) flex items-center justify-center text-(--brand-sand-fg)">
        <HelpCircle :size="20" />
      </span>
    </div>
  </aside>
</template>
