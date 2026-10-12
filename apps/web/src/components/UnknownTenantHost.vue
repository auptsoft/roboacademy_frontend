<script setup lang="ts">
import { RaButton } from '@roboacademy/ui'
import { Globe, RefreshCw } from 'lucide-vue-next'

// Mounted in place of the app when this hostname can't be tied to a school (see main.ts and
// lib/tenant-from-host.ts) - nothing else would work, and the platform tenant would be wrong.
defineProps<{ reason: 'unknown' | 'unreachable' }>()

const host = window.location.hostname

function reload(): void {
  window.location.reload()
}
</script>

<template>
  <div class="min-h-screen bg-(--bg-2) flex items-center justify-center px-4 py-12 max-sm:py-8">
    <main class="w-full max-w-[480px] bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) flex flex-col gap-5 p-8 max-sm:p-5">
      <div class="flex size-11 items-center justify-center rounded-full bg-(--danger-soft) text-(--danger)">
        <Globe :size="20" />
      </div>

      <div v-if="reason === 'unknown'">
        <h1 class="m-0 text-xl font-semibold text-(--heading)">This school isn't set up here</h1>
        <p class="mt-2 text-sm leading-relaxed text-(--fg-2)">
          No school is using <span class="font-mono text-(--heading)">{{ host }}</span>. Check the address, or ask
          your school for the right link.
        </p>
      </div>
      <div v-else>
        <h1 class="m-0 text-xl font-semibold text-(--heading)">We couldn't load your school</h1>
        <p class="mt-2 text-sm leading-relaxed text-(--fg-2)">
          Something went wrong while looking up <span class="font-mono text-(--heading)">{{ host }}</span>. Please try
          again in a moment.
        </p>
      </div>

      <div v-if="reason === 'unreachable'" class="flex justify-end">
        <RaButton @click="reload">
          <template #icon><RefreshCw :size="14" /></template>
          Try again
        </RaButton>
      </div>
    </main>
  </div>
</template>
