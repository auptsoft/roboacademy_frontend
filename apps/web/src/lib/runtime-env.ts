// Reads config injected at container startup (see entrypoint.sh, which writes
// window.__env__ into /env.js from the running container's environment) with a
// fallback to the value Vite baked in at build time, for local dev.
type RuntimeEnv = Partial<Record<keyof ImportMetaEnv, string>>

const runtimeEnv: RuntimeEnv = typeof window !== 'undefined' ? (window.__env__ ?? {}) : {}

export function getEnv(key: keyof ImportMetaEnv): string {
  return runtimeEnv[key] || import.meta.env[key] || ''
}
