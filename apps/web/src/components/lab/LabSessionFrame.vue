<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Maximize2, Minimize2, RefreshCw } from 'lucide-vue-next'
import { RaButton, RaChip } from '@roboacademy/ui'
import { joinLabSession, type LabSessionJoinInfo } from '@/api/robotics-lab'
import { ApiError } from '@/api/client'
import { useLabBridge } from '@/composables/useLabBridge'

/**
 * Botnova's control screen for a physical lab session, in an iframe. RoboAcademy only frames it:
 * robot control, safety and the session's end all belong to botnova.
 */
const props = defineProps<{ labSessionId: string; height?: string }>()

const emit = defineEmits<{ ended: [reason: string] }>()

const wrapper = ref<HTMLElement | null>(null)
const iframeEl = ref<HTMLIFrameElement | null>(null)
const joinInfo = shallowRef<LabSessionJoinInfo | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const isFullscreen = ref(false)

const bridge = useLabBridge({
  onEnded: (reason) => emit('ended', reason),
  onError: (error) => {
    if (!error.recoverable) loadError.value = error.message
  },
  // The frame's token is short-lived; joining again mints a fresh one.
  onNeedsAuthRefresh: () => void refreshToken(),
})

async function load() {
  loading.value = true
  loadError.value = null
  joinInfo.value = null
  try {
    joinInfo.value = await joinLabSession(props.labSessionId)
  } catch (err) {
    loadError.value = err instanceof ApiError ? err.message : 'The robot lab could not be opened. Please try again.'
  } finally {
    loading.value = false
  }
}

async function refreshToken() {
  try {
    bridge.refreshAuth((await joinLabSession(props.labSessionId)).accessToken)
  } catch {
    loadError.value = 'Your robot lab access has expired. Reload to continue.'
  }
}

// Armed once the iframe exists; the frame speaks first, so nothing is sent until it's ready.
function onIframeLoad() {
  const frame = iframeEl.value
  const info = joinInfo.value
  if (!frame || !info) return
  bridge.attach(frame, { iframeUrl: info.iframeUrl, authToken: info.accessToken, externalSessionId: info.externalSessionId })
}

async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen()
  else await wrapper.value?.requestFullscreen()
}

function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === wrapper.value
}
document.addEventListener('fullscreenchange', onFullscreenChange)

// A fresh iframe is the reset: it closes the robot connection and starts clean.
async function reload() {
  bridge.detach()
  await load()
}

watch(() => props.labSessionId, load, { immediate: true })

onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFullscreenChange))
</script>

<template>
  <div ref="wrapper" class="lab-frame" :style="{ height: isFullscreen ? '100%' : (height ?? '680px') }">
    <div class="lab-frame__chrome">
      <RaChip tone="overlay">{{ bridge.connected.value ? 'Connected' : 'Connecting…' }}</RaChip>
      <div class="flex-1" />
      <RaButton variant="ghost" @click="reload">
        <template #icon><RefreshCw :size="14" /></template>
        Reconnect
      </RaButton>
      <RaButton variant="ghost" @click="toggleFullscreen">
        <template #icon>
          <Minimize2 v-if="isFullscreen" :size="14" />
          <Maximize2 v-else :size="14" />
        </template>
        {{ isFullscreen ? 'Exit full screen' : 'Full screen' }}
      </RaButton>
    </div>
    <div class="lab-frame__stage">
      <div v-if="loading" class="lab-frame__state">Connecting to the robot lab…</div>
      <div v-else-if="loadError" class="lab-frame__state">
        <p class="m-0">{{ loadError }}</p>
        <RaButton variant="secondary" @click="reload">Try again</RaButton>
      </div>
      <iframe
        v-else-if="joinInfo"
        ref="iframeEl"
        :key="joinInfo.iframeUrl"
        :src="joinInfo.iframeUrl"
        class="lab-frame__iframe"
        title="Robot lab"
        referrerpolicy="no-referrer"
        allow="camera; microphone; gamepad"
        @load="onIframeLoad"
      />
    </div>
  </div>
</template>

<style scoped>
.lab-frame {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--line-1);
  border-radius: var(--ra-lg);
  background: var(--bg-2);
  overflow: hidden;
}

.lab-frame__chrome {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-1);
  background: var(--bg-3);
}

.lab-frame__stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.lab-frame__iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.lab-frame__state {
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
</style>
