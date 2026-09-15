<script setup lang="ts">
import { Shield } from 'lucide-vue-next'
import { tenantLogoUrl } from '@/branding'

withDefaults(defineProps<{ size?: 'sm' | 'lg' }>(), { size: 'sm' })
</script>

<template>
  <img
    v-if="tenantLogoUrl"
    :src="tenantLogoUrl"
    alt="Logo"
    :class="[size === 'lg' ? 'h-14 max-w-64' : 'h-8 max-w-40', 'w-auto shrink-0 object-contain']"
  >
  <span
    v-else
    :class="[
      size === 'lg' ? 'size-14' : 'size-8',
      'flex shrink-0 items-center justify-center rounded-(--ra-md) bg-(--brand-blue) text-white',
    ]"
  >
    <Shield :size="size === 'lg' ? 28 : 16" />
  </span>
</template>
