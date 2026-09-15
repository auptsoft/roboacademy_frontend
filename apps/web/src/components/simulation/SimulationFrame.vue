<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Maximize2, Minimize2, RefreshCw } from 'lucide-vue-next'
import { RaButton, RaChip } from '@roboacademy/ui'
import { joinLabSession, type LabSessionJoinInfo } from '@/api/robotics-lab'
import { useSimulationBridge } from '@/composables/useSimulationBridge'
import type { SessionMode } from '@/composables/simulation-protocol'
import { getEnv } from '@/lib/runtime-env'

const props = defineProps<{
  sessionId: string
  mode: SessionMode
  /** Rendered height when not full-screen. */
  height?: string
}>()

const emit = defineEmits<{
  graded: [result: { score: number; passed: boolean }]
  frameError: [error: { code: string; message: string; recoverable: boolean }]
}>()

const wrapper = ref<HTMLElement | null>(null)
const iframeEl = ref<HTMLIFrameElement | null>(null)
// shallowRef: this is inert API data and never needs deep reactivity.
const joinInfo = shallowRef<LabSessionJoinInfo | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const isFullscreen = ref(false)

const bridge = useSimulationBridge({
  onGraded: (result) => emit('graded', result),
  onError: (error) => emit('frameError', error),
  // The frame's token is short-lived. Re-joining mints a fresh one, which is cheaper and less
  // stateful than a dedicated refresh endpoint.
  onNeedsAuthRefresh: () => void refreshToken(),
})

const connectionLabel = computed(() => (bridge.connected.value ? 'Connected' : 'Connecting…'))

async function load() {
  loading.value = true
  loadError.value = null
  try {
    joinInfo.value = await joinLabSession(props.sessionId)
  } catch {
    loadError.value = 'This simulation could not be opened. Please try again.'
  } finally {
    loading.value = false
  }
}

async function refreshToken() {
  try {
    const refreshed = await joinLabSession(props.sessionId)
    bridge.refreshAuth(refreshed.accessToken)
  } catch {
    loadError.value = 'Your simulation session expired. Reload to continue.'
  }
}

// Arms the bridge once the iframe element exists. The frame is not messaged here - it speaks
// first with `ready`, and the bridge holds the init payload until then.
function onIframeLoad() {
  const frame = iframeEl.value
  const info = joinInfo.value
  if (!frame || !info) return

  bridge.attach(frame, {
    iframeUrl: info.iframeUrl,
    authToken: info.accessToken,
    sessionId: props.sessionId,
    apiBaseUrl: getEnv('VITE_BOTNOVA_API_BASE_URL'),
    ...(getEnv('VITE_BOTNOVA_WS_URL') ? { wsUrl: getEnv('VITE_BOTNOVA_WS_URL') } : {}),
    mode: props.mode,
  })
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

// Re-mounting the iframe from scratch is the reset: it frees the WebGL context, the physics
// WASM heap and the socket in one step, which in-place teardown does not reliably do.
async function reload() {
  bridge.detach()
  joinInfo.value = null
  await load()
}

watch(() => props.sessionId, load, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})

defineExpose({
  requestSubmit: () => bridge.requestSubmit(),
  syncTheme: () => bridge.syncTheme(),
  telemetry: bridge.telemetry,
  checkpoints: bridge.checkpoints,
  progressPercent: bridge.progressPercent,
  connected: bridge.connected,
})
</script>

<template>
  <div
    ref="wrapper"
    class="sim-frame"
    :style="{ height: isFullscreen ? '100%' : (height ?? '640px') }"
  >
    <div class="sim-frame__chrome">
      <RaChip tone="overlay">{{ connectionLabel }}</RaChip>
      <RaChip v-if="mode === 'graded'" tone="info">Graded</RaChip>
      <div class="sim-frame__spacer" />
      <RaButton variant="ghost" @click="reload">
        <template #icon><RefreshCw :size="14" /></template>
        Restart
      </RaButton>
      <RaButton variant="ghost" @click="toggleFullscreen">
        <template #icon>
          <Minimize2 v-if="isFullscreen" :size="14" />
          <Maximize2 v-else :size="14" />
        </template>
        {{ isFullscreen ? 'Exit full screen' : 'Full screen' }}
      </RaButton>
    </div>

    <div class="sim-frame__stage">
      <div v-if="loading" class="sim-frame__state">
        <div class="sim-frame__skeleton" />
        <p>Preparing your simulation…</p>
      </div>

      <div v-else-if="loadError" class="sim-frame__state">
        <p>{{ loadError }}</p>
        <RaButton variant="secondary" @click="reload">Try again</RaButton>
      </div>

      <iframe
        v-else-if="joinInfo"
        ref="iframeEl"
        :key="joinInfo.iframeUrl"
        :src="joinInfo.iframeUrl"
        class="sim-frame__iframe"
        title="Robot simulation"
        referrerpolicy="no-referrer"
        allow="xr-spatial-tracking"
        @load="onIframeLoad"
      />
    </div>
  </div>
</template>

<style scoped>
.sim-frame {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--line-1);
  border-radius: var(--ra-lg);
  background: var(--bg-2);
  overflow: hidden;
}

.sim-frame__chrome {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-1);
  background: var(--bg-3);
}

.sim-frame__spacer {
  flex: 1 1 auto;
}

.sim-frame__stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.sim-frame__iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.sim-frame__state {
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

.sim-frame__skeleton {
  width: 100%;
  max-width: 420px;
  height: 180px;
  border-radius: var(--ra-md);
  background: linear-gradient(90deg, var(--bg-3), var(--bg-4), var(--bg-3));
  background-size: 200% 100%;
  animation: sim-frame-shimmer 1.4s ease-in-out infinite;
}

@keyframes sim-frame-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sim-frame__skeleton {
    animation: none;
  }
}
</style>
