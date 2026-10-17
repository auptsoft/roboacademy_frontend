<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import {
  createPost, emptyAttachments, toAttachmentDraft,
  type Audience, type PickedAttachments, type PostDetail, type PostKind, type SafetyRules, type Space,
} from '@/api/community'
import AttachmentPicker from './AttachmentPicker.vue'

// Starts a thread: a question or discussion in a course's Q&A, or a staff post on a board. The
// caller's safety rules decide what's offered (audience, images); the server enforces them too.

const props = defineProps<{
  space: Space
  rules: SafetyRules
  isStaff: boolean
  simRunsOn: boolean
  /** Q&A: the lesson (and lab scene) being asked about. */
  lessonId?: string | null
  sceneId?: string | null
}>()
const emit = defineEmits<{ created: [detail: PostDetail, message: string]; cancel: [] }>()

const isQA = computed(() => props.space.kind === 'CourseQA')
const isGroup = computed(() => props.space.kind === 'StudyGroup')
const kinds = computed<{ value: PostKind; label: string }[]>(() =>
  isQA.value
    ? [{ value: 'Question', label: 'Question' }, { value: 'Discussion', label: 'Discussion' }]
    : isGroup.value
      ? [{ value: 'Discussion', label: 'Discussion' }]
      : [{ value: 'Announcement', label: 'Announcement' }, { value: 'Discussion', label: 'Discussion' }])

const kind = ref<PostKind>(kinds.value[0].value)
const title = ref('')
const body = ref('')
const audience = ref<Audience>(props.rules.defaultAudience)
const audienceClassId = ref<string | null>(props.space.audienceClasses[0]?.id ?? null)
const sendEmail = ref(false)
const attachments = ref<PickedAttachments>(emptyAttachments())
const saving = ref(false)
const error = ref('')

watch(() => props.space.id, () => { kind.value = kinds.value[0].value })

// A learner in no class can only ask the whole course.
const canChooseAudience = computed(() =>
  isQA.value && !props.rules.audienceFixed && props.space.audienceClasses.length > 0)
const canSubmit = computed(() => title.value.trim().length > 0 && body.value.trim().length > 0 && !saving.value)

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  error.value = ''
  try {
    const detail = await createPost(props.space.id, {
      kind: kind.value,
      title: title.value.trim(),
      body: body.value.trim(),
      audience: isQA.value ? audience.value : null,
      audienceClassId: isQA.value && audience.value === 'Class' ? audienceClassId.value : null,
      anchorLessonId: isQA.value ? props.lessonId ?? null : null,
      anchorSceneId: isQA.value ? props.sceneId ?? null : null,
      sendEmail: !isQA.value && !isGroup.value && sendEmail.value,
      ...toAttachmentDraft(attachments.value),
    })
    const message = detail.post.status === 'PendingApproval'
      ? 'Sent to your teacher to approve.'
      : detail.post.status === 'Held' ? 'Your post is being checked before others can see it.' : 'Posted.'
    title.value = ''
    body.value = ''
    attachments.value = emptyAttachments()
    emit('created', detail, message)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't post that."
  } finally {
    saving.value = false
  }
}

const fieldClass =
  'rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm text-(--fg-1) outline-none focus:border-(--brand-blue)'
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="submit">
    <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Post type">
      <button
        v-for="option in kinds.length > 1 ? kinds : []"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="kind === option.value"
        :class="[
          'rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer',
          kind === option.value ? 'border-(--brand-blue) bg-(--brand-blue-soft) text-(--brand-blue)' : 'border-(--line-2) bg-transparent text-(--fg-3)',
        ]"
        @click="kind = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <input
      v-model="title"
      type="text"
      maxlength="150"
      :placeholder="kind === 'Question' ? 'What do you want to know?' : 'Title'"
      :class="fieldClass"
      aria-label="Title"
    />
    <textarea
      v-model="body"
      rows="5"
      maxlength="10000"
      :placeholder="kind === 'Question' ? 'Say what you tried and what happened.' : 'Write your post'"
      :class="[fieldClass, 'resize-y leading-relaxed']"
      aria-label="Post"
    />
    <p class="m-0 -mt-1 text-xs text-(--fg-3)">
      You can use **bold**, *italics*, lists and `code`.
      <template v-if="!rules.linksAllowed"> Links can't be shared in your class.</template>
    </p>

    <div v-if="canChooseAudience" class="flex flex-wrap items-center gap-2 text-[13px] text-(--fg-2)">
      <span class="font-semibold">Who can see it:</span>
      <select v-model="audience" :class="[fieldClass, 'py-1! text-[13px]!']" aria-label="Who can see it">
        <option value="Class">My class</option>
        <option value="Course">Everyone on this course</option>
      </select>
      <select
        v-if="audience === 'Class' && space.audienceClasses.length > 1"
        v-model="audienceClassId"
        :class="[fieldClass, 'py-1! text-[13px]!']"
        aria-label="Class"
      >
        <option v-for="c in space.audienceClasses" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </div>
    <p v-else-if="isQA && rules.audienceFixed" class="m-0 text-xs text-(--fg-3)">Only your class and teachers will see this.</p>
    <p v-if="rules.requiresApproval" class="m-0 text-xs text-(--fg-3)">Your teacher will check this before others can see it.</p>

    <AttachmentPicker
      v-model="attachments"
      :images-allowed="rules.imagesAllowed"
      :runs-allowed="isQA && simRunsOn"
      :lesson-id="lessonId"
    />

    <label v-if="!isQA && !isGroup && isStaff" class="flex items-center gap-2 text-[13px] text-(--fg-2) cursor-pointer">
      <input v-model="sendEmail" type="checkbox" class="accent-(--brand-blue)" /> Also email everyone on this board
    </label>

    <p v-if="error" class="m-0 text-[13px] text-(--danger)">{{ error }}</p>

    <div class="flex justify-end gap-2">
      <RaButton type="button" variant="ghost" @click="emit('cancel')">Cancel</RaButton>
      <RaButton type="submit" :disabled="!canSubmit">
        <template v-if="saving" #icon><Loader2 :size="16" class="animate-spin" /></template>
        {{ kind === 'Question' ? 'Ask' : 'Post' }}
      </RaButton>
    </div>
  </form>
</template>
