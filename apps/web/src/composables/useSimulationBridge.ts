import { onBeforeUnmount, ref, type Ref } from 'vue'
import {
  currentAppearance,
  parseFrameMessage,
  postToFrame,
  readBrandTokens,
  type Checkpoint,
  type FrameMessage,
  type InitPayload,
  type SessionMode,
  type TelemetryPayload,
} from '@/composables/simulation-protocol'

interface BridgeHandlers {
  onGraded?: (result: { score: number; passed: boolean }) => void
  onError?: (error: { code: string; message: string; recoverable: boolean }) => void
  onNeedsAuthRefresh?: () => void
}

/**
 * Host side of the simulation iframe handshake.
 *
 * The frame speaks first (`ready`) and we answer with `init`. That ordering is what lets the
 * session token travel over postMessage instead of the iframe URL, so it never reaches browser
 * history, referrer headers, or the proxy access log.
 */
export function useSimulationBridge(handlers: BridgeHandlers = {}) {
  const connected = ref(false)
  const telemetry: Ref<TelemetryPayload | null> = ref(null)
  const checkpoints: Ref<Checkpoint[]> = ref([])
  const progressPercent = ref(0)

  let frameWindow: Window | null = null
  let frameOrigin = ''
  let pendingInit: InitPayload | null = null
  let listening = false

  function onMessage(event: MessageEvent) {
    const message = parseFrameMessage(event, frameOrigin)
    if (!message) return

    switch (message.type) {
      case 'ready':
        connected.value = true
        // The frame only becomes reachable once it announces itself, so init is deferred
        // until now rather than fired at load and lost.
        if (pendingInit) send({ type: 'init', payload: pendingInit })
        break
      case 'progress':
        progressPercent.value = message.payload.percent
        checkpoints.value = message.payload.checkpoints
        break
      case 'telemetry':
        telemetry.value = message.payload
        break
      case 'graded':
        handlers.onGraded?.({ score: message.payload.score, passed: message.payload.passed })
        break
      case 'error':
        handlers.onError?.(message.payload)
        break
      case 'needsAuthRefresh':
        handlers.onNeedsAuthRefresh?.()
        break
      default:
        break
    }
  }

  function send(message: Parameters<typeof postToFrame>[2]) {
    if (!frameWindow || !frameOrigin) return
    postToFrame(frameWindow, frameOrigin, message)
  }

  /**
   * Arms the bridge for a specific frame. Call once the iframe element exists; the init payload
   * is held until the frame says it is ready.
   */
  function attach(
    frame: HTMLIFrameElement,
    options: {
      iframeUrl: string
      authToken: string
      sessionId: string
      apiBaseUrl: string
      wsUrl?: string
      mode: SessionMode
    },
  ) {
    frameWindow = frame.contentWindow
    frameOrigin = new URL(options.iframeUrl).origin

    pendingInit = {
      authToken: options.authToken,
      sessionId: options.sessionId,
      apiBaseUrl: options.apiBaseUrl,
      ...(options.wsUrl ? { wsUrl: options.wsUrl } : {}),
      mode: options.mode,
      // Appearance and tenant brand are independent axes and both must cross the boundary,
      // or the frame renders in the default brand inside a white-labelled page.
      theme: { appearance: currentAppearance(), brandTokens: readBrandTokens() },
      locale: navigator.language,
    }

    if (!listening) {
      window.addEventListener('message', onMessage)
      listening = true
    }
  }

  /** Pushes a live theme or tenant-brand change into an already-running frame. */
  function syncTheme() {
    send({
      type: 'applyTheme',
      payload: { appearance: currentAppearance(), brandTokens: readBrandTokens() },
    })
  }

  function requestSubmit() {
    send({ type: 'command', payload: { action: 'requestSubmit' } })
  }

  function refreshAuth(authToken: string) {
    send({ type: 'authRefresh', payload: { authToken } })
  }

  function detach() {
    if (listening) {
      window.removeEventListener('message', onMessage)
      listening = false
    }
    frameWindow = null
    frameOrigin = ''
    pendingInit = null
    connected.value = false
    telemetry.value = null
    checkpoints.value = []
    progressPercent.value = 0
  }

  onBeforeUnmount(detach)

  return { connected, telemetry, checkpoints, progressPercent, attach, detach, syncTheme, requestSubmit, refreshAuth }
}

export type { Checkpoint, FrameMessage, TelemetryPayload }
