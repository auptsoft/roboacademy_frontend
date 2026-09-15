<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { Cpu, Bell } from 'lucide-vue-next'
import { mainNav } from './nav-items'
import ProfileMenu from './ProfileMenu.vue'
import type { TenantBranding } from '@/api/tenancy.ts'

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
  <header class="grid grid-cols-[1fr_auto_1fr] items-center gap-5 h-(--topbar-h) shrink-0 px-8 border-b border-(--line-1) bg-(--bg-0) max-md:px-4 max-md:gap-3">
    <div class="col-start-1 justify-self-start shrink-0 flex items-center gap-2.5 cursor-pointer" @click="router.push('/app')">
      <span v-if="!props.branding?.logoUrl" class="w-8 h-8 rounded-(--ra-md) bg-(--brand-blue) flex items-center justify-center text-white shrink-0">
        <Cpu  :size="18" />
      </span>
      <span v-else class=" h-8 rounded-(--ra-md) flex items-center justify-center text-white shrink-0">
        <img :src="props.branding?.logoUrl" alt="RoboAcademy Logo" class="h-8" />
      </span>
      <span class="text-(--brand-blue) text-[17px] font-bold tracking-[-0.01em] whitespace-nowrap">{{ props.branding?.name || 'RoboAcademy'   }}</span>
    </div>

    <nav class="col-start-2 justify-self-center shrink-0 flex items-center gap-0.5 max-md:hidden">
      <button
        v-for="item in mainNav"
        :key="item.id"
        class="flex items-center gap-1.5 px-3 py-2 rounded-(--ra-md) cursor-pointer text-sm font-medium bg-transparent border-0 whitespace-nowrap transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--bg-3) hover:text-(--fg-2)"
        :class="isActive(item.path) ? 'bg-[rgba(59,130,246,0.10)] text-(--brand-blue) font-semibold' : 'text-(--fg-3)'"
        @click="router.push(item.path)"
      >
        <component :is="item.icon" :size="16" />
        {{ item.label }}
      </button>
    </nav>

    <div class="col-start-3 justify-self-end flex items-center gap-5">
      <Bell :size="20" class="text-(--fg-3) cursor-pointer shrink-0" />
      <div class="h-7 w-px bg-(--line-2) shrink-0 max-md:hidden" />
      <ProfileMenu />
    </div>
  </header>
</template>
