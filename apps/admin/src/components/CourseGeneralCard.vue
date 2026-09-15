<script setup lang="ts">
import { ref } from 'vue'
import { RaCard } from '@roboacademy/ui'
import { ImageUp, Play, Upload, ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import RichTextEditor from '@/components/RichTextEditor.vue'
import KeyValueEditor from '@/components/KeyValueEditor.vue'
import { COURSE_LEVELS, type CourseLevel } from '@/api/learning'

export interface CourseGeneralFormState {
  title: string
  description: string
  longDescription: string
  level: CourseLevel | ''
  category: string
  // String-only for now, see KeyValueEditor.
  extraProperties: Record<string, string>
}

const form = defineModel<CourseGeneralFormState>({ required: true })
defineProps<{
  courseId: string
  submitting: boolean
  errors: Record<string, string[]>
  thumbnailUrl: string | null
  introVideoReference: string | null
  uploadingThumbnail: boolean
  uploadingIntroVideo: boolean
}>()
defineEmits<{ submit: []; 'upload-thumbnail': []; 'upload-intro-video': []; 'view-intro-video': [] }>()

const open = ref(false)
</script>

<template>
  <RaCard id="general" :padding="0" class="scroll-mt-6 overflow-hidden">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
        <div>
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">General</h3>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">Title and description can be changed at any time, even after publishing.</p>
        </div>
        <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="open && 'rotate-180'" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="py-5 px-6">
          <form class="flex flex-col gap-4" @submit.prevent="$emit('submit')">
            <div class="flex flex-col gap-1.5">
              <Label>Course Id</Label>
              <p class="m-0 font-mono text-[13px] text-(--fg-3)">{{ courseId }}</p>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="general-title">Title</Label>
              <Input id="general-title" v-model="form.title" required />
              <p v-for="msg in errors.Title" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="general-description">Description (optional)</Label>
              <Input id="general-description" v-model="form.description" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Long Description (optional, shown on the course's own detail page)</Label>
              <RichTextEditor v-model="form.longDescription" placeholder="Full course overview…" :rows="8" />
            </div>

            <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <div class="flex flex-col gap-1.5">
                <Label for="general-level">Level (optional)</Label>
                <select
                  id="general-level"
                  v-model="form.level"
                  class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
                >
                  <option value="">Unset</option>
                  <option v-for="level in COURSE_LEVELS" :key="level" :value="level">{{ level }}</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="general-category">Category (optional)</Label>
                <Input id="general-category" v-model="form.category" placeholder="e.g. Robotics" />
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Extra Properties (optional)</Label>
              <KeyValueEditor v-model="form.extraProperties" />
              <p v-for="msg in errors.ExtraProperties" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Thumbnail</Label>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) p-0"
                  @click="$emit('upload-thumbnail')"
                >
                  <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Course thumbnail" class="size-full object-cover">
                  <ImageUp v-else :size="20" class="text-(--fg-4)" />
                </button>
                <Button size="sm" variant="outline" type="button" :disabled="uploadingThumbnail" @click="$emit('upload-thumbnail')">
                  <Upload :size="12" />
                  {{ uploadingThumbnail ? 'Uploading…' : (thumbnailUrl ? 'Replace' : 'Upload') }}
                </Button>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Intro Video</Label>
              <div class="flex items-center gap-2">
                <Button v-if="introVideoReference" size="sm" variant="outline" type="button" @click="$emit('view-intro-video')">
                  <Play :size="12" /> Play
                </Button>
                <Button size="sm" variant="outline" type="button" :disabled="uploadingIntroVideo" @click="$emit('upload-intro-video')">
                  <Upload :size="12" />
                  {{ uploadingIntroVideo ? 'Uploading…' : (introVideoReference ? 'Replace' : 'Upload') }}
                </Button>
              </div>
            </div>

            <div class="flex justify-end">
              <Button type="submit" :disabled="submitting">
                {{ submitting ? 'Saving…' : 'Save Changes' }}
              </Button>
            </div>
          </form>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </RaCard>
</template>
