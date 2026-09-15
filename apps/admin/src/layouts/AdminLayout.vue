<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { User, Menu, LogOut } from 'lucide-vue-next'
import { RaThemeToggle, RaAvatar } from '@roboacademy/ui'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import AdminSidebar from './AdminSidebar.vue'
import AdminNavList from './AdminNavList.vue'
import BrandMark from '@/components/BrandMark.vue'
import { exitTenant, getCurrentUser, getImpersonationTarget } from '@/store/auth'

const router = useRouter()
const drawerOpen = ref(false)
const user = getCurrentUser()
const impersonation = computed(() => getImpersonationTarget())

function goToProfile() {
  drawerOpen.value = false
  router.push('/profile')
}

async function exitImpersonation() {
  await exitTenant()
  router.push('/tenants')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-(--bg-0)">
    <AdminSidebar />

    <div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <header
        class="flex h-(--topbar-h) shrink-0 items-center gap-4 border-b border-(--line-1) bg-(--bg-0) px-8 max-md:px-4"
      >
        <button
          class="hidden size-9 items-center justify-center rounded-(--ra-md) text-(--fg-2) transition-colors hover:bg-(--bg-3) max-md:flex"
          aria-label="Open navigation"
          @click="drawerOpen = true"
        >
          <Menu :size="20" />
        </button>
        <div class="hidden items-center gap-2.5 max-md:flex">
          <BrandMark />
          <span class="text-base font-bold tracking-[-0.01em] text-(--brand-blue)">RoboAcademy Admin</span>
        </div>
        <div class="flex-1" />
        <RaThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger class="hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/30 md:inline-flex" aria-label="Account menu">
            <RaAvatar :name="user?.fullName ?? ''" :size="32" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <div v-if="user" class="truncate px-2.5 py-1.5 text-xs text-(--fg-3)">{{ user.email }}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="goToProfile">
              <User :size="14" /><span>Profile</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div
        v-if="impersonation"
        class="flex shrink-0 items-center justify-between gap-3 border-b px-8 py-2 max-md:px-4"
        style="background: color-mix(in srgb, var(--danger) 12%, transparent); border-color: color-mix(in srgb, var(--danger) 32%, transparent);"
      >
        <span class="text-[13px] font-medium text-(--danger)">
          Viewing <strong>{{ impersonation.tenantName }}</strong> as {{ user?.email }}
        </span>
        <Button variant="outline" size="sm" @click="exitImpersonation">
          <LogOut :size="14" />
          Exit
        </Button>
      </div>
      <main class="min-h-0 flex-1 overflow-y-auto">
        <router-view />
      </main>
    </div>

    <Drawer v-model:open="drawerOpen">
      <DrawerContent>
        <div class="flex items-center gap-2.5 px-1 pb-2">
          <BrandMark />
          <span class="text-base font-bold tracking-[-0.01em] text-(--brand-blue)">RoboAcademy Admin</span>
        </div>
        <AdminNavList @navigate="drawerOpen = false" />
        <div class="flex-1" />
        <div class="flex flex-col gap-2 border-t border-(--line-1) pt-2">
          <span v-if="user" class="truncate px-1.5 text-xs text-(--fg-3)">{{ user.email }}</span>
          <button
            class="flex w-full items-center gap-2.5 rounded-(--ra-md) px-2.5 py-2.5 text-left font-sans text-sm font-medium text-(--fg-3) transition-colors hover:bg-(--bg-3) hover:text-(--fg-2)"
            @click="goToProfile"
          >
            <User :size="16" />Profile
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>
