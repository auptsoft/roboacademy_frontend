/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_PLATFORM_TENANT_ID: string
  /** botnova_go's REST base, handed to the cross-origin simulation frame in `init`. */
  readonly VITE_BOTNOVA_API_BASE_URL: string
  /** botnova_go's WebSocket origin. Must be wss:// wherever the page is served over HTTPS. */
  readonly VITE_BOTNOVA_WS_URL: string
  /** Origin serving the embed bundle; inbound postMessage traffic is checked against it. */
  readonly VITE_BOTNOVA_EMBED_ORIGIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
