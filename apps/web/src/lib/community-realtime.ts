import { HttpTransportType, HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { ref } from 'vue'
import { getTenantId } from '@/api/client'
import { getUnread } from '@/api/community-chat'
import { getAccessToken } from '@/api/session'
import { getEnv } from '@/lib/runtime-env'

// The community chat hub. It only says "something changed": the app then fetches over REST, so
// nothing a learner may not see ever comes down the socket. One shared connection, opened while
// anything is listening. A browser can't set headers on a WebSocket, so the tenant goes in the
// query string (the token too - the SignalR client does that itself).

export interface ChatSignal {
  /** Null for "your channel list changed". */
  channelId: string | null
  kind: 'message' | 'read' | 'channels'
}

type Listener = (signal: ChatSignal) => void

const listeners = new Set<Listener>()
let connection: HubConnection | null = null
let stopping: Promise<void> | null = null

function emit(signal: ChatSignal) {
  listeners.forEach((listener) => listener(signal))
}

async function start() {
  if (connection || !getAccessToken()) return
  const url = `${getEnv('VITE_API_BASE_URL')}/api/community/hub?tenant=${encodeURIComponent(getTenantId())}`
  const hub = new HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => getAccessToken() ?? '',
      headers: { 'X-Tenant-Id': getTenantId() },
      withCredentials: false,
      transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()
  hub.on('chat', (signal: ChatSignal) => emit(signal))
  // Anything could have changed while the connection was down.
  hub.onreconnected(() => emit({ channelId: null, kind: 'channels' }))
  connection = hub

  await stopping
  try {
    await hub.start()
  } catch {
    // The app still works without the socket: pages poll as a fallback.
  }
}

async function stop() {
  const hub = connection
  connection = null
  if (hub && hub.state !== HubConnectionState.Disconnected) {
    stopping = hub.stop().catch(() => {})
    await stopping
    stopping = null
  }
}

/** Listen for chat signals; returns the unsubscribe function. Opens the hub on first use. */
export function onChatSignal(listener: Listener): () => void {
  listeners.add(listener)
  void start()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) void stop()
  }
}

// Unread messages, for the nav badge. Kept up to date by signals while something shows it, with
// a slow poll in case the socket is down.
export const unreadTotal = ref(0)
let unreadUsers = 0
let unreadTimer: ReturnType<typeof setInterval> | null = null
let unsubscribeUnread: (() => void) | null = null

export async function refreshUnread() {
  try {
    unreadTotal.value = (await getUnread()).total
  } catch {
    // Off at this school, or offline: leave the badge as it was.
  }
}

/** Keeps unreadTotal fresh while at least one caller is watching; returns the stop function. */
export function watchUnread(): () => void {
  unreadUsers++
  if (unreadUsers === 1) {
    void refreshUnread()
    unsubscribeUnread = onChatSignal(() => void refreshUnread())
    unreadTimer = setInterval(() => void refreshUnread(), 60_000)
  }

  return () => {
    unreadUsers--
    if (unreadUsers === 0) {
      unsubscribeUnread?.()
      if (unreadTimer) clearInterval(unreadTimer)
      unsubscribeUnread = null
      unreadTimer = null
    }
  }
}
