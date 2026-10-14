<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Play, Sparkles, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import SceneComboBox from '@/components/SceneComboBox.vue'
import { LESSON_TYPES, type LessonType } from '@/api/learning'
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
  /** Only meaningful when type === 'Simulation': the botnova scene id to open for this lesson.
   * Unlike Video/Pdf, this has no upload step - it's a plain reference, saved with the rest of
   * the form instead of as a separate immediate action. */
  sceneReference: string
}

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

  <!-- Content upload/playback only applies once the lesson exists (Add mode has no
       lessonId yet) and only for content-bearing types. -->
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

  <!-- Simulation has no upload step - it's a reference to a scene authored separately in
       botnova, saved with the rest of this form rather than as its own immediate action. -->
  <div v-if="form.type === 'Simulation'" class="flex flex-col gap-1.5">
    <Label for="lesson-scene-reference">Simulation scene</Label>
    <SceneComboBox v-model="form.sceneReference" />
    <p class="m-0 text-xs text-(--fg-3)">
      Pick a scene from botnova's library, or paste a scene ID directly if you've just authored
      one and it isn't listed yet. Leave blank to leave this lesson without a scene for now.
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
