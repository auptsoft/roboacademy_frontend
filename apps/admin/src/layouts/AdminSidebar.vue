<script setup lang="ts">
import AdminNavList from './AdminNavList.vue'
import BrandMark from '@/components/BrandMark.vue'
</script>

<template>
  <aside
    class="hidden md:flex h-full w-(--sidebar-w) shrink-0 flex-col gap-4.5 overflow-y-auto border-r border-(--line-1) bg-(--bg-1) px-3 py-5"
  >
    <div class="flex items-center gap-2.5 px-1">
      <BrandMark />
      <span class="text-base font-bold tracking-[-0.01em] text-(--brand-blue)">RoboAcademy Admin</span>
    </div>

    <AdminNavList />
  </aside>
</template>
