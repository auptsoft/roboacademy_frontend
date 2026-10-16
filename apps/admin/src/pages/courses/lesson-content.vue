<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  RaCard, RaChip, RaInteractiveLesson,
  assetKeys, parseInteractiveContent, validateInteractiveContent,
  type InteractiveLessonContent,
} from '@roboacademy/ui'
import { ArrowLeft, Plus, RotateCcw, Sparkles } from 'lucide-vue-next'
import { lessonBlockRenderers } from '@roboacademy/sim/lesson'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import BlockEditorCard from '@/components/lesson-content/BlockEditorCard.vue'
import { lessonAssetContextKey } from '@/components/lesson-content/asset-context'
import AIDraftLessonDialog from '@/components/lesson-content/AIDraftLessonDialog.vue'
import { useAIAvailability } from '@/composables/useAIAvailability'
import { ApiError } from '@/api/client'
import {
  getCourse, getLessonAssetUrls, getLessonBlockInsights, setLessonInteractiveContent,
  type CourseDetail, type LessonBlockInsight, type LessonItem,
} from '@/api/learning'
import { BLOCK_TYPES, duplicateBlock, newBlock, type BlockType } from '@/lib/lesson-blocks'
import { renderRichText } from '@/lib/rich-text'

/**
 * Full-page editor for an Interactive lesson's blocks, with a live learner preview. Lesson
 * settings (title, type, Context) stay in the course page's Edit Lesson dialog. Blocks are only
 * editable on a draft course - the backend enforces the same rule.
 */
const route = useRoute()
const courseId = computed(() => String(route.params.courseId))
const moduleId = computed(() => String(route.params.moduleId))
const lessonId = computed(() => String(route.params.lessonId))

const course = ref<CourseDetail | null>(null)
const lesson = ref<LessonItem | null>(null)
const status = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading')
const draft = ref<InteractiveLessonContent>({ version: 1, blocks: [] })
const savedJson = ref('')
const saving = ref(false)
// Errors only show after a save attempt, so a freshly added (empty) block isn't flagged at once.
const showErrors = ref(false)
const serverErrors = ref<Record<string, string[]>>({})
const tab = ref<'edit' | 'preview'>('edit')
// How learners did on each check so far; empty until loaded, and simply hidden if that fails.
const insights = ref<Record<string, LessonBlockInsight>>({})
// Preview URLs for media: signed URLs for saved files, local object URLs for new uploads.
const assetUrls = ref<Record<string, string>>({})
provide(lessonAssetContextKey, {
  get courseId() { return courseId.value },
  get moduleId() { return moduleId.value },
  get lessonId() { return lessonId.value },
  urls: assetUrls,
})
// "Draft with AI", when the school's plan and settings include authoring help.
const aiAvailability = useAIAvailability()
const canDraftWithAI = computed(() => !!aiAvailability.feature('Authoring')?.available)
const draftDialogOpen = ref(false)

function insertDraft(blocks: InteractiveLessonContent['blocks'], mode: 'append' | 'replace') {
  draft.value.blocks = mode === 'replace' ? blocks : [...draft.value.blocks, ...blocks]
  toast.success('Draft added. Review each block, then save.')
}

const blockGroups = computed(() =>
  [...new Set(BLOCK_TYPES.map(t => t.group))].map(group => ({ group, types: BLOCK_TYPES.filter(t => t.group === group) })))
const previewKey = ref(0)

const isDraft = computed(() => course.value?.state === 'Draft')
const dirty = computed(() => status.value === 'ready' && JSON.stringify(draft.value) !== savedJson.value)
const clientErrors = computed(() => (draft.value.blocks.length ? validateInteractiveContent(draft.value) : {}))
const errors = computed(() => (showErrors.value ? { ...clientErrors.value, ...serverErrors.value } : {}))
const errorCount = computed(() => Object.keys(errors.value).length)
const preview = computed(() => parseInteractiveContent(JSON.parse(JSON.stringify(draft.value))))

/** This block's errors, re-keyed relative to it ("blocks[2].options" -> "options"). */
function blockErrors(index: number): Record<string, string[]> {
  const prefix = `blocks[${index}].`
  return Object.fromEntries(
    Object.entries(errors.value)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, messages]) => [key.slice(prefix.length), messages]),
  )
}

async function load() {
  status.value = 'loading'
  try {
    course.value = await getCourse(courseId.value)
    lesson.value = course.value.modules.find(m => m.id === moduleId.value)?.lessons.find(l => l.id === lessonId.value) ?? null
    if (!lesson.value) {
      status.value = 'not-found'
      return
    }
    draft.value = lesson.value.content ?? { version: 1, blocks: [] }
    savedJson.value = JSON.stringify(draft.value)
    status.value = 'ready'
    void loadInsights()
    void loadAssetUrls()
  } catch (error) {
    status.value = error instanceof ApiError && error.status === 404 ? 'not-found' : 'error'
  }
}

async function loadAssetUrls() {
  const keys = assetKeys(draft.value).filter(k => !assetUrls.value[k])
  if (!keys.length) return
  try {
    const { urls } = await getLessonAssetUrls(courseId.value, lessonId.value, keys)
    assetUrls.value = { ...assetUrls.value, ...urls }
  } catch {
    // Media previews show placeholders; editing still works.
  }
}

async function loadInsights() {
  try {
    const list = await getLessonBlockInsights(courseId.value, moduleId.value, lessonId.value)
    insights.value = Object.fromEntries(list.map(i => [i.blockId, i]))
  } catch {
    insights.value = {}
  }
}

function addBlock(type: BlockType) {
  draft.value.blocks.push(newBlock(type))
}

function moveBlock(index: number, delta: -1 | 1) {
  const blocks = draft.value.blocks
  const target = index + delta
  ;[blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!]
}

function removeBlock(index: number) {
  if (!confirm('Delete this block?')) return
  draft.value.blocks.splice(index, 1)
}

async function save() {
  showErrors.value = true
  serverErrors.value = {}
  if (Object.keys(clientErrors.value).length) {
    toast.error('Fix the highlighted blocks before saving.')
    return
  }
  saving.value = true
  try {
    // No blocks left means "this lesson has no interactive content", so it's cleared, not rejected.
    const content = draft.value.blocks.length ? draft.value : null
    await setLessonInteractiveContent(courseId.value, moduleId.value, lessonId.value, content)
    savedJson.value = JSON.stringify(draft.value)
    showErrors.value = false
    toast.success('Lesson content saved.')
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      serverErrors.value = Object.fromEntries(
        Object.entries(error.fieldErrors).map(([key, messages]) => [key.replace(/^Content\.?/, '') || 'blocks', messages]),
      )
    }
    toast.error(error instanceof ApiError ? error.message : 'Failed to save the lesson content.')
  } finally {
    saving.value = false
  }
}

function discard() {
  if (!confirm('Discard your unsaved changes?')) return
  draft.value = JSON.parse(savedJson.value)
  void loadAssetUrls()
  showErrors.value = false
  serverErrors.value = {}
}

onBeforeRouteLeave(() => !dirty.value || confirm('You have unsaved changes. Leave without saving?'))

function warnOnUnload(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault()
}

onMounted(() => {
  window.addEventListener('beforeunload', warnOnUnload)
  void load()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnOnUnload))
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-6 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <RouterLink :to="`/courses/${courseId}`" class="inline-flex items-center gap-1 text-xs text-(--fg-3) no-underline">
          <ArrowLeft :size="14" /> {{ course?.title ?? 'Course' }}
        </RouterLink>
        <h1 class="m-0 mt-1 text-[28px] font-bold tracking-[-0.01em] text-(--fg-1)">{{ lesson?.title ?? 'Lesson content' }}</h1>
        <div class="mt-2 flex items-center gap-2">
          <RaChip tone="neutral">Interactive</RaChip>
          <RaChip v-if="dirty" tone="info">Unsaved changes</RaChip>
        </div>
      </div>
      <div v-if="status === 'ready' && isDraft && lesson?.type === 'Interactive'" class="flex gap-2">
        <Button v-if="canDraftWithAI" variant="ghost" @click="draftDialogOpen = true"><Sparkles :size="14" /> Draft with AI</Button>
        <Button variant="outline" :disabled="!dirty || saving" @click="discard">Discard</Button>
        <Button :disabled="!dirty || saving" @click="save">{{ saving ? 'Saving…' : 'Save' }}</Button>
      </div>
    </div>

    <p v-if="status === 'loading'" class="m-0 text-[13px] text-(--fg-3)">Loading lesson…</p>
    <RaCard v-else-if="status === 'not-found'" :padding="24">
      <p class="m-0 text-sm text-(--fg-2)">This lesson doesn't exist any more. It may have been deleted or moved to another module.</p>
    </RaCard>
    <RaCard v-else-if="status === 'error'" :padding="24" class="flex items-center justify-between gap-4">
      <p class="m-0 text-sm text-(--fg-2)">The lesson couldn't be loaded.</p>
      <Button variant="outline" size="sm" @click="load">Try again</Button>
    </RaCard>
    <RaCard v-else-if="lesson?.type !== 'Interactive'" :padding="24">
      <p class="m-0 text-sm text-(--fg-2)">
        Only Interactive lessons have block content. Change this lesson's type to Interactive in its Edit Lesson dialog first.
      </p>
    </RaCard>

    <template v-else>
      <p v-if="!isDraft" class="m-0 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-3.5 py-2.5 text-[13px] text-(--fg-2)">
        This course is published, so its lessons can't be edited. Unpublish the course to change this content.
      </p>
      <p v-else-if="errorCount" class="m-0 text-[13px] text-(--danger)" aria-live="polite">
        {{ errorCount === 1 ? '1 problem' : `${errorCount} problems` }} to fix before this can be saved.
      </p>

      <!-- Below lg the two columns become tabs. -->
      <div class="hidden gap-1 rounded-(--ra-md) bg-(--bg-3) p-1 max-lg:flex" role="tablist">
        <button
          v-for="option in (['edit', 'preview'] as const)"
          :key="option"
          type="button"
          role="tab"
          :aria-selected="tab === option"
          class="flex-1 cursor-pointer rounded-(--ra-sm) border-0 py-1.5 text-[13px] font-semibold capitalize"
          :class="tab === option ? 'bg-(--bg-1) text-(--fg-1)' : 'bg-transparent text-(--fg-3)'"
          @click="tab = option"
        >
          {{ option === 'edit' ? 'Blocks' : 'Preview' }}
        </button>
      </div>

      <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 max-lg:grid-cols-1">
        <fieldset :disabled="!isDraft" class="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" :class="tab === 'preview' && 'max-lg:hidden'">
          <p v-if="!draft.blocks.length" class="m-0 rounded-(--ra-lg) border border-dashed border-(--line-2) px-4 py-8 text-center text-[13px] text-(--fg-3)">
            No blocks yet. Add text, questions and activities to build the lesson.
          </p>
          <BlockEditorCard
            v-for="(block, index) in draft.blocks"
            :key="block.id"
            v-model:block="draft.blocks[index]!"
            :index="index"
            :total="draft.blocks.length"
            :errors="blockErrors(index)"
            :insight="insights[block.id] ?? null"
            @move="moveBlock(index, $event)"
            @duplicate="draft.blocks.splice(index + 1, 0, duplicateBlock(block))"
            @remove="removeBlock(index)"
          />
          <p v-for="msg in errors.blocks ?? []" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>

          <DropdownMenu v-if="isDraft">
            <DropdownMenuTrigger as-child>
              <Button variant="outline" class="self-start"><Plus :size="14" /> Add block</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="max-h-[70vh] w-72 overflow-y-auto">
              <template v-for="{ group, types } in blockGroups" :key="group">
                <div class="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-(--fg-4)">{{ group }}</div>
                <DropdownMenuItem v-for="option in types" :key="option.type" class="items-start" @select="addBlock(option.type)">
                  <component :is="option.icon" class="mt-0.5" />
                  <span class="flex flex-col">
                    <span class="font-semibold text-(--fg-1)">{{ option.label }}</span>
                    <span class="text-xs text-(--fg-3)">{{ option.description }}</span>
                  </span>
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </fieldset>

        <div class="min-w-0" :class="tab === 'edit' && 'max-lg:hidden'">
          <div class="sticky top-4 flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.06em] text-(--fg-3)">Learner preview</span>
              <Button variant="ghost" size="sm" @click="previewKey++"><RotateCcw :size="14" /> Reset answers</Button>
            </div>
            <RaCard :padding="24" class="max-h-[calc(100vh-140px)] overflow-y-auto">
              <div v-if="lesson.context" class="rich-text mb-8 leading-[1.7] text-(--fg-2)" v-html="renderRichText(lesson.context)" />
              <RaInteractiveLesson v-if="preview" :key="previewKey" :content="preview" :asset-urls="assetUrls" :renderers="lessonBlockRenderers" reveal-all />
              <p v-else class="m-0 text-[13px] text-(--fg-3)">Add a block to see the preview. Blocks show here once they have content.</p>
            </RaCard>
            <p class="m-0 text-xs text-(--fg-4)">
              The preview shows every step at once. Learners see one step at a time and must answer each required check to continue.
            </p>
          </div>
        </div>
      </div>
    </template>

    <AIDraftLessonDialog
      v-if="lesson"
      v-model:open="draftDialogOpen"
      :lesson-id="lesson.id"
      :has-notes="!!lesson.context?.trim()"
      :has-blocks="draft.blocks.length > 0"
      @insert="insertDraft"
    />
  </div>
</template>
