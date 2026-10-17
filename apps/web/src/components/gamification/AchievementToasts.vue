<script setup lang="ts">
import { watch } from 'vue'
import { TrendingUp, X } from 'lucide-vue-next'
import { useAchievements } from '@/composables/useAchievements'
import { badgeIcon } from './badge-icons'

// New badges and levels, announced in the corner of the app for a few seconds each.
const { toasts, dismiss } = useAchievements()

const timers = new Map<number, ReturnType<typeof setTimeout>>()
watch(toasts, (list) => {
  for (const toast of list) {
    if (!timers.has(toast.id)) {
      timers.set(toast.id, setTimeout(() => { timers.delete(toast.id); dismiss(toast.id) }, 6000))
    }
  }
}, { deep: true })
</script>

<template>
  <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-[340px] max-sm:left-4 max-sm:right-4 max-sm:bottom-20 max-sm:w-auto" aria-live="polite">
    <TransitionGroup
      enter-from-class="opacity-0 translate-y-2"
      leave-to-class="opacity-0"
      enter-active-class="transition duration-(--dur-2) ease-(--ease-out)"
      leave-active-class="transition duration-(--dur-2) ease-(--ease-out)"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        role="status"
        class="flex items-start gap-3 bg-(--surface) rounded-(--ra-lg) shadow-(--surface-shadow) border border-(--line-1) p-4"
      >
        <span class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center"
          :class="toast.kind === 'level' ? 'bg-(--brand-violet-soft) text-(--brand-violet)' : 'bg-(--brand-blue-soft) text-(--brand-blue)'">
          <TrendingUp v-if="toast.kind === 'level'" :size="18" aria-hidden="true" />
          <component :is="badgeIcon(toast.icon)" v-else :size="18" aria-hidden="true" />
        </span>
        <div class="flex flex-col gap-0.5 min-w-0 flex-1">
          <span class="text-sm font-semibold text-(--heading)">{{ toast.title }}</span>
          <span class="text-[13px] text-(--fg-3)">{{ toast.body }}</span>
        </div>
        <button class="bg-transparent border-0 p-1 -m-1 cursor-pointer text-(--fg-4) hover:text-(--fg-2)" aria-label="Dismiss" @click="dismiss(toast.id)">
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
