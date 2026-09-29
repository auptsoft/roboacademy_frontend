<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Cpu, Bell } from 'lucide-vue-next'
import ProfileMenu from './ProfileMenu.vue'
import type { TenantBranding } from '@/api/tenancy.ts'

const router = useRouter()

const props = defineProps<{
  branding: TenantBranding
}>()
</script>

<template>
  <header class="flex items-center justify-end gap-6 h-(--topbar-h) shrink-0 px-12 border-b border-(--line-1) bg-(--canvas) max-lg:px-8 max-md:justify-between max-md:px-4 max-md:bg-(--surface)">
    <!-- The sidebar carries the logo on desktop; on mobile it's hidden, so show it here. -->
    <div class="hidden items-center gap-2.5 cursor-pointer max-md:flex" @click="router.push('/app')">
      <img v-if="props.branding?.logoUrl" :src="props.branding.logoUrl" :alt="`${props.branding.name} logo`" class="h-8" />
      <template v-else>
        <span class="w-8 h-8 rounded-(--ra-md) bg-(--brand-navy) flex items-center justify-center text-(--brand-navy-fg) shrink-0">
          <Cpu :size="18" />
        </span>
        <span class="text-(--heading) text-[17px] font-bold tracking-[-0.01em] whitespace-nowrap">{{ props.branding?.name || 'RoboAcademy' }}</span>
      </template>
    </div>

    <div class="flex items-center gap-8 max-md:gap-4">
      <button class="bg-transparent border-0 p-0 cursor-pointer text-(--fg-2) hover:text-(--heading)" aria-label="Notifications">
        <Bell :size="22" :stroke-width="1.75" />
      </button>
      <ProfileMenu />
    </div>
  </header>
</template>
