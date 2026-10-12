<script setup lang="ts">
import { RaCard } from '@roboacademy/ui'
import { Globe, RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import BrandMark from '@/components/BrandMark.vue'

// Mounted in place of the app when this hostname can't be tied to a tenant (see main.ts and
// lib/tenant-from-host.ts) - nothing else would work, and the platform tenant would be wrong.
defineProps<{ reason: 'unknown' | 'unreachable' }>()

const host = window.location.hostname

function reload(): void {
  window.location.reload()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-(--bg-0) px-4 py-12">
    <RaCard class="flex w-full max-w-lg flex-col gap-5 p-8 max-sm:p-6">
      <div class="flex items-center gap-2.5">
        <BrandMark />
        <span class="text-base font-bold tracking-[-0.01em] text-(--brand-blue)">RoboAcademy Admin</span>
      </div>

      <div class="flex size-11 items-center justify-center rounded-full bg-(--danger-soft) text-(--danger)">
        <Globe :size="20" />
      </div>

      <div v-if="reason === 'unknown'">
        <h1 class="m-0 text-2xl font-bold tracking-[-0.01em] text-(--fg-1)">This school isn't set up here</h1>
        <p class="mt-2 text-sm leading-relaxed text-(--fg-2)">
          No school is using <span class="font-mono text-(--fg-1)">{{ host }}</span>. Check the address, or contact
          your school for the right link.
        </p>
      </div>
      <div v-else>
        <h1 class="m-0 text-2xl font-bold tracking-[-0.01em] text-(--fg-1)">We couldn't load your school</h1>
        <p class="mt-2 text-sm leading-relaxed text-(--fg-2)">
          Something went wrong while looking up <span class="font-mono text-(--fg-1)">{{ host }}</span>. Please try
          again in a moment.
        </p>
      </div>

      <div v-if="reason === 'unreachable'" class="flex justify-end border-t border-(--line-1) pt-5">
        <Button @click="reload"><RefreshCw :size="14" /> Try again</Button>
      </div>
    </RaCard>
  </div>
</template>
