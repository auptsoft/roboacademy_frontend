import { onBeforeUnmount, ref } from 'vue'
import {
  currentAppearance,
  parseFrameMessage,
  postToFrame,
  readBrandTokens,
  type HostMessage,
  type InitPayload,
} from '@/composables/lab-protocol'

interface BridgeHandlers {
  onEnded?: (reason: string) => void
  onError?: (error: { code: string; message: string; recoverable: boolean }) => void
  onNeedsAuthRefresh?: () => void
}

/**
 * Host side of the lab-session iframe handshake. The frame speaks first (`ready`) and we answer
 * with `init`; that ordering lets the access token travel over postMessage instead of the iframe
 * URL, so it never reaches browser history, referrer headers or proxy logs. The frame repeats
 * `ready` until it gets `init`, so listening from the iframe's load event is early enough.
 */
export function useLabBridge(handlers: BridgeHandlers = {}) {
  const connected = ref(false)
  let frameWindow: Window | null = null
  let frameOrigin = ''
  let pendingInit: InitPayload | null = null
  let listening = false

  function send(message: HostMessage) {
    if (frameWindow && frameOrigin) postToFrame(frameWindow, frameOrigin, message)
  }

  function onMessage(event: MessageEvent) {
    const message = parseFrameMessage(event, frameWindow, frameOrigin)
    if (!message) return
    switch (message.type) {
      case 'ready':
        if (!connected.value && pendingInit) send({ type: 'init', payload: pendingInit })
        connected.value = true
        break
      case 'ended':
        handlers.onEnded?.(message.payload.reason)
        break
      case 'error':
        handlers.onError?.(message.payload)
        break
      case 'needsAuthRefresh':
        handlers.onNeedsAuthRefresh?.()
        break
    }
  }

  /** Arms the bridge for a frame. The init payload is held until the frame says it's ready. */
  function attach(frame: HTMLIFrameElement, options: { iframeUrl: string; authToken: string; externalSessionId: string }) {
    frameWindow = frame.contentWindow
    frameOrigin = new URL(options.iframeUrl).origin
    connected.value = false
    pendingInit = {
      authToken: options.authToken,
      sessionId: options.externalSessionId,
      // Appearance and tenant brand are independent: both cross the boundary.
      theme: { appearance: currentAppearance(), brandTokens: readBrandTokens() },
      locale: navigator.language,
    }
    if (!listening) {
      window.addEventListener('message', onMessage)
      listening = true
    }
  }

  function syncTheme() {
    send({ type: 'applyTheme', payload: { appearance: currentAppearance(), brandTokens: readBrandTokens() } })
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
  }

  onBeforeUnmount(detach)

  return { connected, attach, detach, syncTheme, refreshAuth }
}
