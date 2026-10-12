/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_PLATFORM_TENANT_ID: string
  /**
   * Comma-separated hostnames the platform itself is served on. Any other hostname is a
   * tenant's own domain and picks its tenant by host - see lib/tenant-from-host.ts. Empty means
   * every hostname is a platform host.
   */
  readonly VITE_PLATFORM_HOSTS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** Set by /env.js, generated at container startup — see entrypoint.sh. */
  __env__?: Partial<Record<keyof ImportMetaEnv, string>>
}
