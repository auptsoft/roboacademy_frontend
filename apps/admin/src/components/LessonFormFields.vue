<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { FileText, Play, Sparkles, Upload, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import SceneComboBox from '@/components/SceneComboBox.vue'
import { LESSON_TYPES, type LessonType, type ProgrammingLanguage } from '@/api/learning'
import { ApiError } from '@/api/client'
import { draftLessonSummary, type AITier } from '@/api/ai'
import { useAIAvailability } from '@/composables/useAIAvailability'

export interface LessonFormState {
  title: string
  type: LessonType
  isRequired: boolean
  allowUnenrolled: boolean
  order: number
  context: string
  /** Only meaningful when type === 'Simulation': the scene id to open for this lesson.
   * Unlike Video/Pdf, this has no upload step - it's a plain reference, saved with the rest of
   * the form instead of as a separate immediate action. */
  sceneReference: string
  /** Only meaningful when type === 'Simulation': the language learners program in. */
  programmingLanguage: ProgrammingLanguage
  /** Add mode only, for Video/Pdf: the file to upload once the lesson has been created. An
   * existing lesson uploads immediately instead (see the `upload` event). */
  contentFile: File | null
}

const LANGUAGE_OPTIONS: { value: ProgrammingLanguage; label: string; disabled?: boolean }[] = [
  { value: 'Blocks', label: 'Blocks' },
  { value: 'JavaScript', label: 'JavaScript' },
  { value: 'Python', label: 'Python' },
  { value: 'Lua', label: 'Lua' },
  { value: 'Any', label: "Learner's choice" },
]

const form = defineModel<LessonFormState>({ required: true })
const props = defineProps<{
  errors: Record<string, string[]>
  hasLesson: boolean
  // The saved lesson, for AI summaries (which read its saved notes).
  lessonId?: string | null
  savedContext?: string | null
  contentReference: string | null
  uploading: boolean
}>()
defineEmits<{ view: []; upload: [] }>()

// --- Add mode: pick the content file now, the parent uploads it after creating the lesson ---
const contentFileInput = ref<HTMLInputElement | null>(null)
const contentAccept = computed(() => (form.value.type === 'Pdf' ? 'application/pdf' : 'video/*'))

function fileMatchesType(file: File, type: LessonType) {
  if (type === 'Pdf') return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (type === 'Video') return file.type.startsWith('video/')
  return false
}

function onContentFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return
  if (!fileMatchesType(file, form.value.type)) {
    toast.error(form.value.type === 'Pdf' ? 'Choose a PDF file.' : 'Choose a video file.')
    return
  }
  form.value.contentFile = file
}

// A file chosen for one type is wrong for another (or for a type without content).
watch(() => form.value.type, (type) => {
  if (form.value.contentFile && !fileMatchesType(form.value.contentFile, type)) form.value.contentFile = null
})

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// --- AI summary of the saved notes; "Insert" only edits the form ---
const aiAvailability = useAIAvailability()
const authoring = computed(() => aiAvailability.feature('Authoring'))
const canSummarise = computed(() =>
  !!authoring.value?.available && !!props.lessonId && !!props.savedContext?.trim())
const summary = ref<{ summary: string; keyPoints: string[]; tier: AITier } | null>(null)
const summarising = ref(false)

async function summarise(tier?: AITier) {
  if (!props.lessonId) return
  summarising.value = true
  try {
    summary.value = await draftLessonSummary(props.lessonId, tier)
    await aiAvailability.load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to summarise the lesson.')
  } finally {
    summarising.value = false
  }
}

function insertSummary() {
  if (!summary.value) return
  const points = summary.value.keyPoints.map((p) => `- ${p}`).join('\n')
  const block = `**Summary:** ${summary.value.summary}${points ? `\n\n${points}` : ''}`
  form.value.context = form.value.context.trim() ? `${block}\n\n${form.value.context}` : block
  summary.value = null
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Label for="lesson-title">Title</Label>
    <Input id="lesson-title" v-model="form.title" required />
    <p v-for="msg in errors.Title" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
  </div>

  <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
    <div class="flex flex-col gap-1.5">
      <Label for="lesson-type">Type</Label>
      <select
        id="lesson-type"
        v-model="form.type"
        class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
      >
        <option v-for="type in LESSON_TYPES" :key="type" :value="type">{{ type }}</option>
      </select>
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="lesson-order">Order</Label>
      <Input id="lesson-order" v-model="form.order" type="number" min="1" required />
    </div>
  </div>

  <label class="flex items-center gap-1.5 text-sm text-(--fg-2)">
    <input v-model="form.isRequired" type="checkbox" class="size-4 accent-(--brand-blue)"> Required to proceed
  </label>

  <label class="flex items-center gap-1.5 text-sm text-(--fg-2)">
    <input v-model="form.allowUnenrolled" type="checkbox" class="size-4 accent-(--brand-blue)"> Allow un-enrolled learners
  </label>

  <!-- Add mode has no lessonId to upload against yet, so the file is only chosen here and the
       parent uploads it straight after creating the lesson. -->
  <div v-if="!hasLesson && (form.type === 'Video' || form.type === 'Pdf')" class="flex flex-col gap-1.5">
    <Label>Content</Label>
    <div v-if="form.contentFile" class="flex items-center gap-2 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-2 text-sm">
      <component :is="form.type === 'Pdf' ? FileText : Play" :size="14" class="shrink-0 text-(--fg-3)" />
      <span class="min-w-0 flex-1 truncate text-(--fg-1)" :title="form.contentFile.name">{{ form.contentFile.name }}</span>
      <span class="shrink-0 text-xs text-(--fg-3)">{{ formatSize(form.contentFile.size) }}</span>
      <Button size="sm" variant="ghost" type="button" class="h-7 px-2" @click="contentFileInput?.click()">Change</Button>
      <Button size="icon" variant="ghost" type="button" class="size-7" aria-label="Remove file" @click="form.contentFile = null">
        <X :size="14" />
      </Button>
    </div>
    <div v-else>
      <Button size="sm" variant="outline" type="button" @click="contentFileInput?.click()">
        <Upload :size="12" /> Choose {{ form.type === 'Pdf' ? 'PDF' : 'video' }}
      </Button>
    </div>
    <p class="m-0 text-xs text-(--fg-3)">
      Optional. It's uploaded when you add the lesson. You can also upload it later from Edit Lesson.
    </p>
    <input ref="contentFileInput" type="file" :accept="contentAccept" class="hidden" @change="onContentFilePicked">
  </div>

  <!-- An existing lesson uploads (or replaces) its content immediately. -->
  <div v-if="hasLesson && (form.type === 'Video' || form.type === 'Pdf')" class="flex flex-col gap-1.5">
    <Label>Content</Label>
    <div class="flex items-center gap-2">
      <Button
        v-if="contentReference"
        size="sm" variant="outline" type="button"
        @click="$emit('view')"
      >
        <Play :size="12" /> {{ form.type === 'Pdf' ? 'View' : 'Play' }}
      </Button>
      <Button
        size="sm" variant="outline" type="button"
        :disabled="uploading"
        @click="$emit('upload')"
      >
        <Upload :size="12" />
        {{ uploading ? 'Uploading…' : (contentReference ? 'Replace' : 'Upload') }}
      </Button>
    </div>
  </div>

  <!-- Simulation has no upload step - it's a reference to a scene authored separately under
       Robotics Lab -> Simulation Scenes, saved with the rest of this form. -->
  <div v-if="form.type === 'Simulation'" class="flex flex-col gap-1.5">
    <Label for="lesson-scene-reference">Simulation scene</Label>
    <SceneComboBox v-model="form.sceneReference" />
    <p class="m-0 text-xs text-(--fg-3)">
      Pick a published scene from the library. Leave blank to leave this lesson without a scene for now.
    </p>
  </div>

  <div v-if="form.type === 'Simulation'" class="flex flex-col gap-1.5">
    <Label for="lesson-programming-language">Programming language</Label>
    <select
      id="lesson-programming-language"
      v-model="form.programmingLanguage"
      class="h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
    >
      <option v-for="option in LANGUAGE_OPTIONS" :key="option.value" :value="option.value" :disabled="option.disabled">
        {{ option.label }}
      </option>
    </select>
    <p class="m-0 text-xs text-(--fg-3)">
      Require one language, or let learners choose. With "Learner's choice", each language keeps its own program.
    </p>
  </div>

  <div v-if="canSummarise" class="flex flex-col gap-2 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) p-3">
    <div class="flex items-center justify-between gap-2">
      <span class="flex items-center gap-1.5 text-sm font-semibold text-(--fg-1)">
        <Sparkles :size="14" class="text-(--primary)" /> Summarise with AI
      </span>
      <Button size="sm" variant="outline" type="button" :disabled="summarising" @click="summarise()">
        {{ summarising ? 'Summarising…' : summary ? 'Again' : 'Summarise' }}
      </Button>
    </div>
    <template v-if="summary">
      <p class="m-0 text-sm text-(--fg-1)">{{ summary.summary }}</p>
      <ul v-if="summary.keyPoints.length" class="m-0 pl-5 text-sm text-(--fg-2)">
        <li v-for="point in summary.keyPoints" :key="point">{{ point }}</li>
      </ul>
      <div class="flex flex-wrap gap-2">
        <Button size="sm" type="button" @click="insertSummary">Insert at top of notes</Button>
        <Button
          v-if="authoring?.canUseEnhanced && summary.tier !== 'Enhanced'"
          size="sm" variant="ghost" type="button" :disabled="summarising"
          @click="summarise('Enhanced')"
        >
          Try a better version
        </Button>
        <Button size="sm" variant="ghost" type="button" @click="summary = null">Cancel</Button>
      </div>
      <p class="m-0 text-xs text-(--fg-4)">AI-generated from the saved notes. Check it before saving.</p>
    </template>
  </div>

  <div class="flex flex-col gap-1.5">
    <Label>Context (optional notes shown alongside the lesson)</Label>
    <RichTextEditor v-model="form.context" placeholder="Notes or explanation for this lesson…" :rows="8" />
  </div>
</template>
