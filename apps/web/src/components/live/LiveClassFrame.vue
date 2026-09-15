<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Maximize2, Minimize2, RefreshCw } from 'lucide-vue-next'
import { RaButton, RaChip } from '@roboacademy/ui'
import { ApiError } from '@/api/client'
import { joinLiveClass } from '@/api/learning'

// Deliberately not built on SimulationFrame: a live class has no postMessage contract and its
// join reference carries no access token, so there is nothing for the simulation bridge to do.
const props = defineProps<{
  liveClassId: string
  /** Rendered height when not full-screen. */
  height?: string
}>()

const wrapper = ref<HTMLElement | null>(null)
// shallowRef: inert API data, no deep reactivity needed.
const joinInfo = shallowRef<{ iframeUrl: string; expiresAt: string } | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const isFullscreen = ref(false)

async function load() {
  loading.value = true
  loadError.value = null
  try {
    joinInfo.value = await joinLiveClass(props.liveClassId)
  } catch (err) {
    // The backend distinguishes "you have no booking" from "this class has no provisioned
    // session", and both are worth showing verbatim rather than flattening to one message.
    loadError.value = err instanceof ApiError
      ? err.message
      : 'This live class could not be joined. Please try again.'
    joinInfo.value = null
  } finally {
    loading.value = false
  }
}

// Fullscreen is requested on our own wrapper rather than the iframe, so the frame needs no
// `allow="fullscreen"` delegation and the host keeps its chrome on top.
async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  await wrapper.value?.requestFullscreen()
}

function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === wrapper.value
}
document.addEventListener('fullscreenchange', onFullscreenChange)

// The join reference is short-lived. Re-minting it and re-mounting the iframe is the whole
// recovery path for an expired or dropped call.
async function rejoin() {
  joinInfo.value = null
  await load()
}

watch(() => props.liveClassId, load, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<template>
  <div
    ref="wrapper"
    class="live-frame"
    :style="{ height: isFullscreen ? '100%' : (height ?? '640px') }"
  >
    <div class="live-frame__chrome">
      <RaChip tone="overlay">{{ joinInfo ? 'In session' : 'Connecting…' }}</RaChip>
      <div class="live-frame__spacer" />
      <RaButton variant="ghost" @click="rejoin">
        <template #icon><RefreshCw :size="14" /></template>
        Rejoin
      </RaButton>
      <RaButton variant="ghost" @click="toggleFullscreen">
        <template #icon>
          <Minimize2 v-if="isFullscreen" :size="14" />
          <Maximize2 v-else :size="14" />
        </template>
        {{ isFullscreen ? 'Exit full screen' : 'Full screen' }}
      </RaButton>
    </div>

    <div class="live-frame__stage">
      <div v-if="loading" class="live-frame__state">
        <div class="live-frame__skeleton" />
        <p>Connecting you to the session…</p>
      </div>

      <div v-else-if="loadError" class="live-frame__state">
        <p>{{ loadError }}</p>
        <RaButton variant="secondary" @click="rejoin">Try again</RaButton>
      </div>

      <iframe
        v-else-if="joinInfo"
        :key="joinInfo.iframeUrl"
        :src="joinInfo.iframeUrl"
        class="live-frame__iframe"
        title="Live class"
        referrerpolicy="no-referrer"
        allow="camera; microphone; autoplay; display-capture"
      />
    </div>
  </div>
</template>

<style scoped>
.live-frame {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--line-1);
  border-radius: var(--ra-lg);
  background: var(--bg-2);
  overflow: hidden;
}

.live-frame__chrome {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-1);
  background: var(--bg-3);
}

.live-frame__spacer {
  flex: 1 1 auto;
}

.live-frame__stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.live-frame__iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.live-frame__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  padding: 24px;
  text-align: center;
  color: var(--fg-3);
  font-size: 14px;
}

.live-frame__skeleton {
  width: 100%;
  max-width: 420px;
  height: 180px;
  border-radius: var(--ra-md);
  background: linear-gradient(90deg, var(--bg-3), var(--bg-4), var(--bg-3));
  background-size: 200% 100%;
  animation: live-frame-shimmer 1.4s ease-in-out infinite;
}

@keyframes live-frame-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-frame__skeleton {
    animation: none;
  }
}
</style>
