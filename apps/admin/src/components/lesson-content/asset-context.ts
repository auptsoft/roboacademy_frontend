import { inject, type InjectionKey, type Ref } from 'vue'

/**
 * Shared by media fields wherever questions and blocks are edited: how to get an upload URL, and
 * the URLs to preview files with - signed URLs for saved files, local object URLs for ones just
 * uploaded. The lesson content editor uploads into the lesson; quiz and question bank pages into
 * the assessment store (see provideAssessmentAssets).
 */
export interface LessonAssetContext {
  requestUpload(request: { contentType: string; fileName: string; sizeBytes: number }): Promise<{ uploadUrl: string; objectKey: string }>
  urls: Ref<Record<string, string>>
}

export const lessonAssetContextKey: InjectionKey<LessonAssetContext> = Symbol('lesson-asset-context')

export function useLessonAssetContext(): LessonAssetContext {
  const context = inject(lessonAssetContextKey)
  if (!context) throw new Error('Media fields need an asset context (the lesson editor, or a quiz or question bank page).')
  return context
}

/** For editors that only sometimes need media (QuestionFields): null when there's no context. */
export function useOptionalAssetContext(): LessonAssetContext | null {
  return inject(lessonAssetContextKey, null)
}

const LARGE_WIDTH = 1600
const SMALL_WIDTH = 800

export type AssetKind = 'image' | 'video' | 'audio' | 'file' | 'model'

export const ACCEPT: Record<AssetKind, string> = {
  image: 'image/png,image/jpeg,image/webp,image/gif',
  video: 'video/mp4,video/webm',
  audio: 'audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm',
  file: '.pdf,.zip,.txt,.csv,.ino,.py,.js,application/pdf,application/zip,text/plain,text/csv',
  model: '.glb,model/gltf-binary',
}

const MB = 1024 * 1024
const MAX_BYTES: Record<AssetKind, number> = { image: 10 * MB, video: 500 * MB, audio: 50 * MB, file: 50 * MB, model: 25 * MB }

export interface UploadedAsset {
  key: string
  /** Images only: the ~800px copy for phones, when the original is wider than that. */
  smallKey?: string
}

/**
 * Uploads a file for a media block. Images are resized in the browser first (to 1600px, plus an
 * 800px copy for phones), which keeps lessons light on slow connections and strips photo
 * metadata such as location. Animated GIFs are uploaded as they are.
 */
export async function uploadLessonAsset(
  context: LessonAssetContext, kind: AssetKind, file: File, onProgress: (fraction: number) => void,
): Promise<UploadedAsset> {
  if (file.size > MAX_BYTES[kind]) {
    throw new Error(`This file is too big. The limit is ${MAX_BYTES[kind] / MB} MB.`)
  }

  if (kind === 'model') {
    // Browsers rarely know the .glb type, so name it, or it would go up as a generic file.
    if (!file.name.toLowerCase().endsWith('.glb')) throw new Error('Upload a .glb file. Export it from your 3D tool as glTF binary.')
    const model = new Blob([file], { type: 'model/gltf-binary' })
    const key = await uploadBlob(context, model, file.name, onProgress)
    context.urls.value = { ...context.urls.value, [key]: URL.createObjectURL(model) }
    return { key }
  }

  if (kind !== 'image' || file.type === 'image/gif') {
    const key = await uploadBlob(context, file, file.name, onProgress)
    context.urls.value = { ...context.urls.value, [key]: URL.createObjectURL(file) }
    return { key }
  }

  const bitmap = await createImageBitmap(file)
  const large = await resize(bitmap, LARGE_WIDTH, file.type)
  const small = bitmap.width > SMALL_WIDTH ? await resize(bitmap, SMALL_WIDTH, file.type) : null
  bitmap.close()

  const key = await uploadBlob(context, large, withExtension(file.name, large.type), p => onProgress(small ? p * 0.8 : p))
  const smallKey = small
    ? await uploadBlob(context, small, withExtension(file.name, small.type), p => onProgress(0.8 + p * 0.2))
    : undefined
  const local: Record<string, string> = { [key]: URL.createObjectURL(large) }
  if (smallKey && small) local[smallKey] = URL.createObjectURL(small)
  context.urls.value = { ...context.urls.value, ...local }
  return { key, smallKey }
}

async function uploadBlob(
  context: LessonAssetContext, blob: Blob, fileName: string, onProgress: (fraction: number) => void,
): Promise<string> {
  const contentType = blob.type || 'application/octet-stream'
  const { uploadUrl, objectKey } = await context.requestUpload({ contentType, fileName, sizeBytes: blob.size })
  // Straight to R2, not through apiFetch. XHR rather than fetch for upload progress.
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', uploadUrl)
    request.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total)
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Upload to storage failed.')))
    request.onerror = () => reject(new Error('Upload to storage failed. Check your connection.'))
    request.send(blob)
  })
  onProgress(1)
  return objectKey
}

/** WebP where the browser can encode it (Safari can't, so JPEG); PNG stays PNG to keep transparency. */
async function resize(bitmap: ImageBitmap, maxWidth: number, sourceType: string): Promise<Blob> {
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const encode = (type: string) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.85))
  const preferred = sourceType === 'image/png' ? 'image/png' : 'image/webp'
  const blob = await encode(preferred)
  if (blob && blob.type === preferred) return blob
  return (await encode('image/jpeg'))!
}

function withExtension(name: string, type: string): string {
  const extension = { 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/png': '.png' }[type] ?? ''
  return name.replace(/\.[^.]+$/, '') + extension
}
