/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_PLATFORM_TENANT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** Set by /env.js, generated at container startup — see entrypoint.sh. */
  __env__?: Partial<Record<keyof ImportMetaEnv, string>>
}
