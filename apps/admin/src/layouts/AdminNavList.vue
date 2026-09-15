<script setup lang="ts">
import { reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cn } from '@roboacademy/ui'
import { ChevronDown } from 'lucide-vue-next'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { hasPermission, isImpersonating } from '@/store/auth'
import { adminNav, isNavGroup, type AdminNavGroup, type AdminNavLeaf } from './nav-items'

const route = useRoute()
const router = useRouter()
const emit = defineEmits<{ navigate: [] }>()

function resolvePath(path: AdminNavLeaf['path']): string {
  return typeof path === 'function' ? path() : path
}

function isActive(path: AdminNavLeaf['path']) {
  const resolved = resolvePath(path)
  if (resolved === '/') return route.path === '/'
  return route.path.startsWith(resolved)
}

function isVisible(item: AdminNavLeaf): boolean {
  if (item.hiddenWhileImpersonating && isImpersonating()) return false
  return !item.permission || hasPermission(item.permission)
}

function visibleItems(group: AdminNavGroup) {
  return group.items.filter(isVisible)
}

const openGroups = reactive<Record<string, boolean>>(
  Object.fromEntries(
    adminNav.filter(isNavGroup).map((group) => [group.id, visibleItems(group).some((item) => isActive(item.path))]),
  ),
)

function go(path: AdminNavLeaf['path']) {
  router.push(resolvePath(path))
  emit('navigate')
}

function leafClass(active: boolean) {
  return cn(
    'relative flex w-full items-center gap-2.5 rounded-(--ra-md) px-2.5 py-2.5 text-left font-sans text-sm font-medium text-(--fg-3) transition-colors hover:bg-(--bg-3) hover:text-(--fg-2)',
    active && 'bg-(--brand-blue-soft) font-semibold text-(--fg-1) hover:bg-(--brand-blue-soft)',
  )
}
</script>

<template>
  <nav class="flex flex-col gap-0.5">
    <template v-for="entry in adminNav" :key="entry.id">
      <button
        v-if="!isNavGroup(entry) && isVisible(entry)"
        :class="leafClass(isActive(entry.path))"
        @click="go(entry.path)"
      >
        <span v-if="isActive(entry.path)" class="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-(--brand-blue)" />
        <component :is="entry.icon" :size="16" />
        {{ entry.label }}
      </button>

      <Collapsible v-else-if="isNavGroup(entry) && visibleItems(entry).length > 0" v-model:open="openGroups[entry.id]">
        <CollapsibleTrigger
          class="flex w-full items-center gap-2.5 rounded-(--ra-md) px-2.5 py-2.5 text-left font-sans text-sm font-medium text-(--fg-3) transition-colors hover:bg-(--bg-3) hover:text-(--fg-2)"
        >
          <component :is="entry.icon" :size="16" />
          <span class="flex-1">{{ entry.label }}</span>
          <ChevronDown :size="14" :class="cn('transition-transform duration-200', openGroups[entry.id] && 'rotate-180')" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div class="flex flex-col gap-0.5 py-0.5 pl-7">
            <button
              v-for="item in visibleItems(entry)"
              :key="item.id"
              :class="leafClass(isActive(item.path))"
              @click="go(item.path)"
            >
              <component :is="item.icon" :size="14" />
              {{ item.label }}
            </button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </template>
  </nav>
</template>
