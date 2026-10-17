import { provide, ref } from 'vue'
import { getAssessmentAssetUploadUrl, getAssessmentAssetUrls } from '@/api/assessment'
import { lessonAssetContextKey } from '@/components/lesson-content/asset-context'

/**
 * Makes media fields (the diagram in label-the-diagram questions) work on a quiz or question bank
 * page: uploads go to the assessment store. Call loadUrls with the questions shown, to preview
 * images saved earlier.
 */
export function provideAssessmentAssets() {
  const urls = ref<Record<string, string>>({})
  provide(lessonAssetContextKey, { requestUpload: getAssessmentAssetUploadUrl, urls })

  async function loadUrls(definitions: ({ asset?: string; assetSmall?: string } | null | undefined)[]) {
    const keys = [...new Set(definitions.flatMap(d => [d?.asset, d?.assetSmall]).filter((k): k is string => !!k && !urls.value[k]))]
    if (!keys.length) return
    try {
      const result = await getAssessmentAssetUrls(keys)
      urls.value = { ...urls.value, ...result.urls }
    } catch {
      // Previews show placeholders; editing still works.
    }
  }

  return { loadUrls }
}
