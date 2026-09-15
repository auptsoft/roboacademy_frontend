<script setup lang="ts">
import { useRouter } from 'vue-router'
import { User, BarChart3, Settings, LogOut } from 'lucide-vue-next'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'reka-ui'
import { RaAvatar, RaThemeToggle } from '@roboacademy/ui'
import { getCurrentUser, logout } from '@/store/auth'


const router = useRouter()

const user = getCurrentUser()

function handleLogout() {
  logout()
  router.push('/auth')
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      class="flex items-center gap-2.5 py-1 pr-1.5 pl-3 border-0 bg-transparent rounded-(--ra-pill) cursor-pointer outline-none transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--bg-3) data-[state=open]:bg-(--bg-3)"
      aria-label="Account menu"
    >
      <div class="text-right max-[480px]:hidden">
        <span class="block text-[13px] font-semibold text-(--fg-1) whitespace-nowrap">{{ user?.fullName || '...' }}</span>
        <span class="block text-xs text-(--fg-3) whitespace-nowrap">{{ user?.roles?.reduce ? user.roles.reduce((acc, role) => acc + ', ' + role, '').slice(2) : '...' }}</span>
      </div>
      <RaAvatar :name="user?.fullName || 'Alex Rivera'" :size="36" status="active" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="min-w-[220px] bg-(--bg-1) border border-(--line-1) rounded-(--ra-lg) shadow-(--elev-2) p-2 z-50"
        :side-offset="8"
        align="end"
      >
        <div class="flex items-center justify-between gap-3 px-1.5 pt-1 pb-2">
          <span class="text-xs font-semibold text-(--fg-3)">Theme</span>
          <RaThemeToggle />
        </div>
        <DropdownMenuSeparator class="h-px my-1 bg-(--line-1)" />
        <DropdownMenuItem
          class="flex items-center gap-2.5 px-2.5 py-2.5 rounded-(--ra-md) cursor-pointer text-sm font-medium text-(--fg-2) outline-none transition-colors duration-(--dur-1) ease-(--ease-out) data-[highlighted]:bg-(--bg-3) data-[highlighted]:text-(--fg-1)"
          @select="router.push('/app/profile')"
        >
          <User :size="16" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          class="flex items-center gap-2.5 px-2.5 py-2.5 rounded-(--ra-md) cursor-pointer text-sm font-medium text-(--fg-2) outline-none transition-colors duration-(--dur-1) ease-(--ease-out) data-[highlighted]:bg-(--bg-3) data-[highlighted]:text-(--fg-1)"
          @select="router.push('/app/progress')"
        >
          <BarChart3 :size="16" />
          Progress
        </DropdownMenuItem>
        <DropdownMenuItem
          class="flex items-center gap-2.5 px-2.5 py-2.5 rounded-(--ra-md) cursor-pointer text-sm font-medium text-(--fg-2) outline-none transition-colors duration-(--dur-1) ease-(--ease-out) data-[highlighted]:bg-(--bg-3) data-[highlighted]:text-(--fg-1)"
          @select="router.push('/app/settings')"
        >
          <Settings :size="16" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          class="flex items-center gap-2.5 px-2.5 py-2.5 rounded-(--ra-md) cursor-pointer text-sm font-medium text-(--fg-2) outline-none transition-colors duration-(--dur-1) ease-(--ease-out) data-[highlighted]:bg-[rgba(239,68,68,0.10)] data-[highlighted]:text-(--danger)"
          @select="handleLogout"
        >
          <LogOut :size="16" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
