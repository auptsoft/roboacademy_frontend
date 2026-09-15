/**
 * Host side of seam C in documentation/botnova-embed-contract.md.
 *
 * The embedded engine (botnova_ui `apps/embed`) has a mirror of this file in TypeScript/React.
 * Both sides must change together, which is what PROTOCOL_VERSION exists to enforce.
 */

export const PROTOCOL_VERSION = 1

export const HOST_SOURCE = 'roboacademy-host'
export const FRAME_SOURCE = 'botnova-embed'

export type SessionMode = 'practice' | 'graded'

export interface ThemePayload {
  appearance: 'light' | 'dark'
  /** Tenant brand CSS custom properties, so the frame matches white-label branding. */
  brandTokens: Record<string, string>
}

export interface InitPayload {
  authToken: string
  sessionId: string
  apiBaseUrl: string
  wsUrl?: string
  sceneRef?: string
  mode: SessionMode
  theme: ThemePayload
  locale?: string
  traceContext?: string
}

export type HostMessage =
  | { type: 'init'; payload: InitPayload }
  | { type: 'applyTheme'; payload: ThemePayload }
  | { type: 'command'; payload: { action: 'start' | 'pause' | 'reset' | 'requestSubmit' | 'loadScene'; sceneId?: string } }
  | { type: 'authRefresh'; payload: { authToken: string } }

export interface Checkpoint {
  id: string
  label: string
  satisfied: boolean
}

export interface TelemetryPayload {
  joints: Record<string, number>
  latencyMs: number
  fps: number
  connection: string
  robotState: Record<string, unknown>
}

export type FrameMessage =
  | { type: 'ready'; payload: { capabilities: string[] } }
  | { type: 'progress'; payload: { percent: number; checkpoints: Checkpoint[] } }
  | { type: 'telemetry'; payload: TelemetryPayload }
  | { type: 'graded'; payload: { score: number; passed: boolean; replayId: string | null } }
  | { type: 'error'; payload: { code: string; message: string; recoverable: boolean } }
  | { type: 'resize'; payload: { desiredHeight: number } }
  | { type: 'needsAuthRefresh'; payload: Record<string, never> }

interface Envelope {
  source?: string
  protocolVersion?: number
  type?: string
  payload?: unknown
}

/**
 * Validates an inbound frame message. The page's message channel is shared with anything else
 * that can reach it, so unrecognised traffic is dropped silently rather than treated as an error.
 */
export function parseFrameMessage(event: MessageEvent, frameOrigin: string): FrameMessage | null {
  if (event.origin !== frameOrigin) return null

  const data = event.data as Envelope | undefined
  if (!data || typeof data !== 'object') return null
  if (data.source !== FRAME_SOURCE) return null
  if (data.protocolVersion !== PROTOCOL_VERSION) return null
  if (typeof data.type !== 'string') return null

  return { type: data.type, payload: data.payload } as FrameMessage
}

/** Posts to one explicit origin. Never '*' — the init message carries an access token. */
export function postToFrame(frame: Window, origin: string, message: HostMessage): void {
  frame.postMessage(
    { source: HOST_SOURCE, protocolVersion: PROTOCOL_VERSION, type: message.type, payload: message.payload },
    origin,
  )
}

/** Reads the brand tokens the tenant branding wrote onto :root, to forward into the frame. */
export function readBrandTokens(): Record<string, string> {
  const styles = getComputedStyle(document.documentElement)
  const names = ['--brand-blue', '--brand-blue-hover', '--brand-blue-foreground']
  const tokens: Record<string, string> = {}
  for (const name of names) {
    const value = styles.getPropertyValue(name).trim()
    if (value) tokens[name] = value
  }
  return tokens
}

export function currentAppearance(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}
