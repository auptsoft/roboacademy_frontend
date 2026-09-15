<script setup lang="ts">
import { Play, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import SceneComboBox from '@/components/SceneComboBox.vue'
import { LESSON_TYPES, type LessonType } from '@/api/learning'

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
defineProps<{
  errors: Record<string, string[]>
  hasLesson: boolean
  contentReference: string | null
  uploading: boolean
}>()
defineEmits<{ view: []; upload: [] }>()
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

  <div class="flex flex-col gap-1.5">
    <Label>Context (optional notes shown alongside the lesson)</Label>
    <RichTextEditor v-model="form.context" placeholder="Notes or explanation for this lesson…" :rows="8" />
  </div>
</template>
