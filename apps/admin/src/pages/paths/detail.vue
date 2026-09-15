<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { ChevronDown } from 'lucide-vue-next'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import PathGeneralCard, { type PathGeneralFormState } from '@/components/PathGeneralCard.vue'
import {
  getPath,
  updatePath,
  publishPath,
  unpublishPath,
  addCourseToPath,
  listCourseCatalog,
  uploadPathThumbnail,
  setPathThumbnail,
  getPathIntroVideoUploadUrl,
  setPathIntroVideo,
  getPathIntroVideoUrl,
  type PathDetail,
  type CourseCatalogItem,
} from '@/api/learning'

const route = useRoute()
const pathId = computed(() => String(route.params.pathId))

const sections = [
  { id: 'general', label: 'General' },
  { id: 'courses', label: 'Courses in Path' },
  { id: 'publish', label: 'Publish' },
]

const path = ref<PathDetail | null>(null)
const loading = ref(true)
const notFound = ref(false)
const isDraft = computed(() => path.value?.state === 'Draft')

// Collapsed by default - each section owns its own collapse state.
const coursesOpen = ref(false)
const publishOpen = ref(false)

async function loadPath() {
  loading.value = true
  notFound.value = false
  try {
    path.value = await getPath(pathId.value)
    generalForm.value = {
      title: path.value.title, description: path.value.description ?? '',
      longDescription: path.value.longDescription ?? '',
    }
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load learning path.')
    }
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadPath)
watch(pathId, loadPath)

// --- General (title / description / long description) ---
const generalForm = ref<PathGeneralFormState>({ title: '', description: '', longDescription: '' })
const generalSubmitting = ref(false)
const generalErrors = ref<Record<string, string[]>>({})

async function submitGeneral() {
  generalErrors.value = {}
  generalSubmitting.value = true
  try {
    const updated = await updatePath(pathId.value, {
      title: generalForm.value.title,
      description: generalForm.value.description || undefined,
      longDescription: generalForm.value.longDescription || null,
    })
    if (path.value) {
      path.value = {
        ...path.value, title: updated.title, description: updated.description,
        longDescription: updated.longDescription,
      }
    }
    toast.success('Learning path updated.')
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      generalErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update learning path.')
    }
  } finally {
    generalSubmitting.value = false
  }
}

// --- Path thumbnail (local-disk storage, permanent public URL) ---
const thumbnailFileInputEl = ref<HTMLInputElement | null>(null)
const uploadingThumbnail = ref(false)

function openThumbnailUpload() {
  thumbnailFileInputEl.value?.click()
}

async function onThumbnailFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !path.value) return

  uploadingThumbnail.value = true
  try {
    const { thumbnailUrl } = await uploadPathThumbnail(pathId.value, file)
    await setPathThumbnail(pathId.value, thumbnailUrl)
    path.value.thumbnailUrl = thumbnailUrl
    toast.success('Thumbnail uploaded.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to upload thumbnail.')
  } finally {
    uploadingThumbnail.value = false
  }
}

// --- Path intro video (R2 presigned URLs, same shape as course intro video upload/playback) ---
const introVideoFileInputEl = ref<HTMLInputElement | null>(null)
const uploadingIntroVideo = ref(false)
const playingIntroVideo = ref(false)
const introVideoPlaybackUrl = ref<string | null>(null)
const introVideoPlaybackLoading = ref(false)

function openIntroVideoUpload() {
  introVideoFileInputEl.value?.click()
}

async function onIntroVideoFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !path.value) return

  uploadingIntroVideo.value = true
  try {
    const { uploadUrl, objectKey } = await getPathIntroVideoUploadUrl(
      pathId.value, { contentType: file.type, fileName: file.name },
    )
    // Direct to R2, not through apiFetch - this is R2's endpoint, not our API.
    const putResponse = await fetch(uploadUrl, { method: 'PUT', body: file })
    if (!putResponse.ok) throw new Error('Upload to storage failed.')

    await setPathIntroVideo(pathId.value, objectKey)
    path.value.introVideoReference = objectKey
    toast.success('Intro video uploaded.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to upload intro video.')
  } finally {
    uploadingIntroVideo.value = false
  }
}

async function viewIntroVideo() {
  playingIntroVideo.value = true
  introVideoPlaybackUrl.value = null
  introVideoPlaybackLoading.value = true
  try {
    const { url } = await getPathIntroVideoUrl(pathId.value)
    introVideoPlaybackUrl.value = url
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load intro video.')
    playingIntroVideo.value = false
  } finally {
    introVideoPlaybackLoading.value = false
  }
}

function closeIntroVideoPlayback() {
  playingIntroVideo.value = false
  introVideoPlaybackUrl.value = null
}

// --- Add course step ---
const courseQuery = ref('')
const courseResults = ref<CourseCatalogItem[]>([])
const selectedCourse = ref<CourseCatalogItem | null>(null)
const addingCourse = ref(false)
let courseSearchDebounce: ReturnType<typeof setTimeout> | undefined

watch(courseQuery, (value) => {
  if (selectedCourse.value && value === selectedCourse.value.title) return
  clearTimeout(courseSearchDebounce)
  selectedCourse.value = null
  if (value.trim().length < 2) {
    courseResults.value = []
    return
  }
  courseSearchDebounce = setTimeout(async () => {
    const result = await listCourseCatalog({ state: 'Published' }, 1, 20)
    courseResults.value = result.items.filter((c) => c.title.toLowerCase().includes(value.toLowerCase()))
  }, 300)
})

function pickCourse(course: CourseCatalogItem) {
  selectedCourse.value = course
  courseQuery.value = course.title
  courseResults.value = []
}

async function submitAddCourse() {
  if (!selectedCourse.value) return
  addingCourse.value = true
  try {
    await addCourseToPath(pathId.value, selectedCourse.value.id)
    courseQuery.value = ''
    selectedCourse.value = null
    await loadPath()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to add course to path.')
  } finally {
    addingCourse.value = false
  }
}

// --- Publish ---
const publishing = ref(false)
const canPublish = computed(() => (path.value?.steps.length ?? 0) > 0)

async function submitPublish() {
  publishing.value = true
  try {
    await publishPath(pathId.value)
    toast.success('Learning path published.')
    await loadPath()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to publish learning path.')
  } finally {
    publishing.value = false
  }
}

const unpublishing = ref(false)

async function submitUnpublish() {
  if (!window.confirm('Unpublish this path? It will return to Draft and steps can be added again.')) return
  unpublishing.value = true
  try {
    await unpublishPath(pathId.value)
    toast.success('Learning path unpublished.')
    await loadPath()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to unpublish learning path.')
  } finally {
    unpublishing.value = false
  }
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-6 pt-8 px-8 pb-16 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading learning path…</p>

    <template v-else-if="notFound">
      <RaCard class="p-10 text-center">
        <p class="m-0 text-sm text-(--fg-3)">Learning path not found.</p>
      </RaCard>
    </template>

    <template v-else-if="path">
      <div class="flex items-start justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">{{ path.title }}</h1>
            <RaChip :tone="path.state === 'Published' ? 'info' : 'neutral'">{{ path.state }}</RaChip>
          </div>
          <p v-if="path.description" class="mt-1.5 text-sm text-(--fg-3)">{{ path.description }}</p>
        </div>
      </div>

      <div class="grid grid-cols-[180px_1fr] gap-8 max-xl:grid-cols-1 max-xl:gap-6">
        <nav class="sticky top-0 flex h-fit flex-col gap-1 max-xl:hidden">
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="rounded-(--ra-md) px-3 py-2 text-sm text-(--fg-3) transition-colors hover:bg-(--bg-3) hover:text-(--fg-1)"
          >
            {{ section.label }}
          </a>
        </nav>

        <div class="flex flex-col gap-6">
          <PathGeneralCard
            v-model="generalForm"
            :path-id="path.id"
            :submitting="generalSubmitting"
            :errors="generalErrors"
            :thumbnail-url="path.thumbnailUrl"
            :intro-video-reference="path.introVideoReference"
            :uploading-thumbnail="uploadingThumbnail"
            :uploading-intro-video="uploadingIntroVideo"
            @submit="submitGeneral"
            @upload-thumbnail="openThumbnailUpload"
            @upload-intro-video="openIntroVideoUpload"
            @view-intro-video="viewIntroVideo"
          />

          <!-- Courses in Path -->
          <RaCard id="courses" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="coursesOpen">
              <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
                <div>
                  <h3 class="m-0 text-lg font-bold text-(--fg-1)">Courses in Path</h3>
                  <p class="m-0 mt-1 text-xs text-(--fg-3)">
                    Steps can't be reordered or removed once added — plan the sequence before adding.
                  </p>
                </div>
                <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="coursesOpen && 'rotate-180'" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="py-5 px-6">
                  <p v-if="path.steps.length === 0" class="m-0 mb-4 text-[13px] text-(--fg-3)">No steps yet.</p>
                  <ol class="m-0 mb-4 flex list-none flex-col gap-2 p-0">
                    <li
                      v-for="step in path.steps"
                      :key="step.courseId"
                      class="flex items-center gap-3 border-b border-(--line-1) py-2 last:border-b-0"
                    >
                      <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--bg-3) text-xs font-semibold text-(--fg-2)">{{ step.order }}</span>
                      <span class="text-sm text-(--fg-1)">{{ step.courseTitle }}</span>
                    </li>
                  </ol>

                  <div v-if="isDraft" class="relative flex items-center gap-2">
                    <div class="relative flex-1">
                      <Input v-model="courseQuery" placeholder="Search published courses by title…" class="h-9" />
                      <div
                        v-if="courseResults.length > 0"
                        class="absolute top-full right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) shadow-md"
                      >
                        <button
                          v-for="c in courseResults"
                          :key="c.id"
                          type="button"
                          class="block w-full px-2.5 py-1.5 text-left text-[13px] text-(--fg-2) hover:bg-(--bg-3)"
                          @click="pickCourse(c)"
                        >
                          {{ c.title }}
                        </button>
                      </div>
                    </div>
                    <Button size="sm" :disabled="!selectedCourse || addingCourse" @click="submitAddCourse">Add Step</Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </RaCard>

          <!-- Publish -->
          <RaCard id="publish" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="publishOpen">
              <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
                <div>
                  <h3 class="m-0 text-lg font-bold text-(--fg-1)">Publish</h3>
                  <p class="m-0 mt-1 text-xs text-(--fg-3)">Unpublishing returns the path to Draft so steps can be added again.</p>
                </div>
                <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="publishOpen && 'rotate-180'" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="py-5 px-6">
                  <div class="flex items-center justify-between">
                    <RaChip :tone="path.state === 'Published' ? 'info' : 'neutral'">{{ path.state }}</RaChip>
                    <Button v-if="isDraft" :disabled="!canPublish || publishing" @click="submitPublish">
                      {{ publishing ? 'Publishing…' : 'Publish Path' }}
                    </Button>
                    <Button v-else variant="outline" :disabled="unpublishing" @click="submitUnpublish">
                      {{ unpublishing ? 'Unpublishing…' : 'Unpublish Path' }}
                    </Button>
                  </div>
                  <p v-if="isDraft && !canPublish" class="m-0 mt-2 text-xs text-(--fg-4)">Add at least one course before publishing.</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </RaCard>
        </div>
      </div>
    </template>

    <input ref="thumbnailFileInputEl" type="file" accept="image/*" class="hidden" @change="onThumbnailFileSelected">
    <input ref="introVideoFileInputEl" type="file" accept="video/*" class="hidden" @change="onIntroVideoFileSelected">

    <!-- Path intro video playback -->
    <Dialog :open="playingIntroVideo" @update:open="(v) => !v && closeIntroVideoPlayback()">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Intro Video</DialogTitle>
        </DialogHeader>
        <p v-if="introVideoPlaybackLoading" class="m-0 py-8 text-center text-[13px] text-(--fg-3)">Loading video…</p>
        <video v-else-if="introVideoPlaybackUrl" :src="introVideoPlaybackUrl" controls autoplay class="w-full rounded-(--ra-md)" />
      </DialogContent>
    </Dialog>
  </div>
</template>
