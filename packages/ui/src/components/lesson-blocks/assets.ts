import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'

/** Signed URLs for the lesson's files, keyed by asset key. Provided by InteractiveLesson. */
export const assetUrlsKey: InjectionKey<ComputedRef<Record<string, string>>> = Symbol('lesson-asset-urls')

/** Resolves an asset key to its URL, or undefined while URLs are loading (or if it can't be read). */
export function useAssetUrl() {
  const urls = inject(assetUrlsKey, computed<Record<string, string>>(() => ({})))
  return (key: string | undefined) => (key ? urls.value[key] : undefined)
}
