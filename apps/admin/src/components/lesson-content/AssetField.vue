<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Box, FileText, Film, Music, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/api/client'
import { ACCEPT, uploadLessonAsset, useLessonAssetContext, type AssetKind, type UploadedAsset } from './asset-context'

/** Upload or replace one file of a media block, with a preview of what's there now. */
const props = defineProps<{
  kind: AssetKind
  /** The block's current asset key ('' when nothing is uploaded yet). */
  assetKey: string | undefined
  label?: string
  invalid?: boolean
}>()
const emit = defineEmits<{ uploaded: [asset: UploadedAsset, file: File] }>()

const context = useLessonAssetContext()
const input = ref<HTMLInputElement | null>(null)
const progress = ref<number | null>(null)

const url = computed(() => (props.assetKey ? context.urls.value[props.assetKey] : undefined))
const icon = computed(() => ({ image: FileText, video: Film, audio: Music, file: FileText, model: Box })[props.kind])

async function onPicked(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  progress.value = 0
  try {
    const uploaded = await uploadLessonAsset(context, props.kind, file, p => (progress.value = p))
    emit('uploaded', uploaded, file)
  } catch (error) {
    toast.error(error instanceof ApiError || error instanceof Error ? error.message : 'Upload failed.')
  } finally {
    progress.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <span v-if="label" class="text-xs text-(--fg-3)">{{ label }}</span>
    <div
      class="flex items-center gap-3 rounded-(--ra-md) border border-dashed p-2.5"
      :class="invalid ? 'border-(--danger)' : 'border-(--line-2)'"
    >
      <img v-if="kind === 'image' && url" :src="url" alt="" class="h-14 w-20 shrink-0 rounded-(--ra-sm) object-cover">
      <component :is="icon" v-else :size="18" class="shrink-0 text-(--fg-3)" />
      <span class="min-w-0 flex-1 truncate text-[13px] text-(--fg-2)">
        <template v-if="progress !== null">Uploading… {{ Math.round(progress * 100) }}%</template>
        <template v-else-if="assetKey">{{ kind === 'image' ? 'Image uploaded' : 'File uploaded' }}</template>
        <template v-else>No file yet</template>
      </span>
      <Button variant="outline" size="sm" type="button" :disabled="progress !== null" @click="input?.click()">
        <Upload :size="12" /> {{ assetKey ? 'Replace' : 'Upload' }}
      </Button>
      <input ref="input" type="file" :accept="ACCEPT[kind]" class="hidden" @change="onPicked">
    </div>
    <video v-if="kind === 'video' && url" :src="url" controls preload="metadata" class="max-h-48 w-full rounded-(--ra-md) bg-black" />
    <audio v-else-if="kind === 'audio' && url" :src="url" controls preload="metadata" class="w-full" />
  </div>
</template>
