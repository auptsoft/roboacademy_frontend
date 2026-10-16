/**
 * Host side of the botnova lab-session iframe protocol, version 2 (Robotics Lab Phase P1 §6.2).
 * Botnova's embed has a mirror of this file; PROTOCOL_VERSION makes both sides change together.
 *
 * Rules carried over from v1: the frame speaks first (`ready`, repeated until `init`), the access
 * token travels over postMessage and never in the URL, and both sides post only to one exact
 * origin - never '*'.
 */

export const PROTOCOL_VERSION = 2

export const HOST_SOURCE = 'roboacademy-host'
export const FRAME_SOURCE = 'botnova-embed'

export interface ThemePayload {
  appearance: 'light' | 'dark'
  /** Tenant brand CSS custom properties, so the frame matches white-label branding. */
  brandTokens: Record<string, string>
}

export interface InitPayload {
  authToken: string
  /** Botnova's id for the session, the one the access token is scoped to. */
  sessionId: string
  theme: ThemePayload
  locale?: string
}

export type HostMessage =
  | { type: 'init'; payload: InitPayload }
  | { type: 'applyTheme'; payload: ThemePayload }
  | { type: 'authRefresh'; payload: { authToken: string } }

export type FrameMessage =
  | { type: 'ready'; payload: Record<string, unknown> }
  | { type: 'ended'; payload: { reason: string } }
  | { type: 'error'; payload: { code: string; message: string; recoverable: boolean } }
  | { type: 'needsAuthRefresh'; payload: Record<string, never> }

interface Envelope {
  source?: string
  protocolVersion?: number
  type?: string
  payload?: unknown
}

/**
 * Validates an inbound message: from our own frame's window, at its origin, in our protocol.
 * The page's message channel is shared with anything else that can reach it, so anything else
 * is dropped silently.
 */
export function parseFrameMessage(event: MessageEvent, frameWindow: Window | null, frameOrigin: string): FrameMessage | null {
  if (!frameWindow || event.source !== frameWindow || event.origin !== frameOrigin) return null
  const data = event.data as Envelope | undefined
  if (!data || typeof data !== 'object') return null
  if (data.source !== FRAME_SOURCE || data.protocolVersion !== PROTOCOL_VERSION || typeof data.type !== 'string') return null
  return { type: data.type, payload: data.payload ?? {} } as FrameMessage
}

/** Posts to one explicit origin. Never '*': init carries an access token. */
export function postToFrame(frame: Window, origin: string, message: HostMessage): void {
  frame.postMessage({ source: HOST_SOURCE, protocolVersion: PROTOCOL_VERSION, type: message.type, payload: message.payload }, origin)
}

/** Reads the brand tokens the tenant branding wrote onto :root, to forward into the frame. */
export function readBrandTokens(): Record<string, string> {
  const styles = getComputedStyle(document.documentElement)
  const tokens: Record<string, string> = {}
  for (const name of ['--brand-blue', '--brand-blue-hover', '--brand-blue-foreground']) {
    const value = styles.getPropertyValue(name).trim()
    if (value) tokens[name] = value
  }
  return tokens
}

export function currentAppearance(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}
