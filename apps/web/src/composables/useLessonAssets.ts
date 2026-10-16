import { onBeforeUnmount, ref } from 'vue'
import { assetKeys, type InteractiveLessonContent } from '@roboacademy/ui'
import { getLessonAssetUrls } from '@/api/learning'
import { MAX_CACHED_ASSET_BYTES, assetGet, assetPut } from '@/lib/offline-store'

// Refresh a little before the signed URLs expire, so media keeps working in a long session.
const REFRESH_MARGIN_MS = 5 * 60_000

/**
 * Signed URLs for the open Interactive lesson's files, kept fresh while it stays open. Files a
 * learner might need again offline (everything but video) are also saved on the device in the
 * background; without a connection, those saved copies stand in for the URLs.
 */
export function useLessonAssets() {
  const urls = ref<Record<string, string>>({})
  let timer: ReturnType<typeof setTimeout> | undefined
  let loadToken = 0
  let objectUrls: string[] = []

  async function load(courseId: string, lessonId: string, content: InteractiveLessonContent) {
    const token = ++loadToken
    clear(false)
    const keys = assetKeys(content)
    if (!keys.length) return
    try {
      const result = await getLessonAssetUrls(courseId, lessonId, keys)
      if (token !== loadToken) return
      urls.value = result.urls
      const refreshIn = new Date(result.expiresAt).getTime() - Date.now() - REFRESH_MARGIN_MS
      timer = setTimeout(() => void load(courseId, lessonId, content), Math.max(refreshIn, 60_000))
      void saveForOffline(result.urls, offlineKeys(content))
    } catch {
      // Offline: whatever this device saved before. Media without a copy shows a placeholder.
      const local: Record<string, string> = {}
      for (const key of keys) {
        const blob = await assetGet(key)
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        objectUrls.push(url)
        local[key] = url
      }
      if (token === loadToken) urls.value = local
    }
  }

  function clear(cancel = true) {
    if (cancel) loadToken++
    clearTimeout(timer)
    objectUrls.forEach(url => URL.revokeObjectURL(url))
    objectUrls = []
    urls.value = {}
  }

  onBeforeUnmount(() => clear())
  return { urls, load, clear }
}

/** Keys worth keeping on the device: not video, which is too big to cache sensibly. */
function offlineKeys(content: InteractiveLessonContent): Set<string> {
  const videos = new Set(content.blocks.flatMap(b => (b.type === 'video' ? [b.asset] : [])))
  return new Set(assetKeys(content).filter(key => !videos.has(key)))
}

/** Background, best-effort: needs the storage bucket to allow cross-origin GETs from the app. */
async function saveForOffline(urls: Record<string, string>, keys: Set<string>) {
  for (const [key, url] of Object.entries(urls)) {
    if (!keys.has(key) || (await assetGet(key))) continue
    try {
      const response = await fetch(url)
      const size = Number(response.headers.get('content-length') ?? 0)
      if (!response.ok || size > MAX_CACHED_ASSET_BYTES) continue
      await assetPut(key, await response.blob())
    } catch {
      return // Offline again, or the bucket doesn't allow it: stop quietly.
    }
  }
}
