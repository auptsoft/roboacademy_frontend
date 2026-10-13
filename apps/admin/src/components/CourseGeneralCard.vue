<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { ImageUp, Play, Upload, ChevronDown, Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import RichTextEditor from '@/components/RichTextEditor.vue'
import KeyValueEditor from '@/components/KeyValueEditor.vue'
import { COURSE_LEVELS, type CourseLevel } from '@/api/learning'
import { ApiError } from '@/api/client'
import { draftCourseCopy, type AITier, type CopyTone } from '@/api/ai'
import { useAIAvailability } from '@/composables/useAIAvailability'

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
const props = defineProps<{
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

// --- AI course copy: a draft from the saved course outline; it only fills the form ---
const aiAvailability = useAIAvailability()
const authoring = computed(() => aiAvailability.feature('Authoring'))
const aiTone = ref<CopyTone>('Friendly')
const aiDraft = ref<{ description: string; longDescription: string; tier: AITier } | null>(null)
const aiWorking = ref(false)

async function draftCopy(tier?: AITier) {
  aiWorking.value = true
  try {
    aiDraft.value = await draftCourseCopy(props.courseId, aiTone.value, tier)
    await aiAvailability.load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to draft course copy.')
  } finally {
    aiWorking.value = false
  }
}

function applyDraft(mode: 'replace' | 'append') {
  const draft = aiDraft.value
  if (!draft) return
  if (mode === 'replace' || !form.value.description.trim()) form.value.description = draft.description
  form.value.longDescription = mode === 'replace' || !form.value.longDescription.trim()
    ? draft.longDescription
    : `${form.value.longDescription.trim()}\n\n${draft.longDescription}`
  aiDraft.value = null
  toast.success('Draft added to the form. Review it, then save.')
}
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
            <div v-if="authoring?.available" class="flex flex-col gap-2.5 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) p-3.5">
              <div class="flex flex-wrap items-center gap-2">
                <Sparkles :size="14" class="text-(--primary)" />
                <span class="text-sm font-semibold text-(--fg-1)">Draft descriptions with AI</span>
                <select
                  v-model="aiTone"
                  aria-label="Tone"
                  class="h-8 rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) px-2 text-xs text-(--fg-2) outline-none"
                >
                  <option value="Friendly">Friendly</option>
                  <option value="Formal">Formal</option>
                </select>
                <Button size="sm" variant="outline" type="button" :disabled="aiWorking" @click="draftCopy()">
                  {{ aiWorking ? 'Drafting…' : 'Draft' }}
                </Button>
              </div>
              <p class="m-0 text-xs text-(--fg-3)">Uses the saved course outline. Save your changes first if you've just edited modules or lessons.</p>
              <template v-if="aiDraft">
                <div class="flex flex-col gap-1.5 text-sm">
                  <span class="text-xs text-(--fg-3)">
                    AI-generated draft
                    <RaChip v-if="aiDraft.tier === 'Enhanced'" tone="info" class="ml-1">Enhanced</RaChip>
                  </span>
                  <p class="m-0 font-semibold text-(--fg-1)">{{ aiDraft.description }}</p>
                  <p class="m-0 text-(--fg-2) whitespace-pre-wrap">{{ aiDraft.longDescription }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <Button size="sm" type="button" @click="applyDraft('replace')">Replace</Button>
                  <Button size="sm" variant="outline" type="button" @click="applyDraft('append')">Append</Button>
                  <Button
                    v-if="authoring?.canUseEnhanced && aiDraft.tier !== 'Enhanced'"
                    size="sm" variant="ghost" type="button" :disabled="aiWorking"
                    @click="draftCopy('Enhanced')"
                  >
                    Try a better version
                  </Button>
                  <Button size="sm" variant="ghost" type="button" @click="aiDraft = null">Cancel</Button>
                </div>
              </template>
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
