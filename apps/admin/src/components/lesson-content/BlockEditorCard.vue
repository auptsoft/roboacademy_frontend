<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Copy, Library, Plus, Trash2, X } from 'lucide-vue-next'
import { isAllowedEmbed, isCheckBlock, toEmbedUrl, type LessonBlock } from '@roboacademy/ui'
import type { LessonBlockInsight } from '@/api/learning'
import { Button } from '@/components/ui/button'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { blockTypeMeta, newId } from '@/lib/lesson-blocks'
import AssetField from './AssetField.vue'
import QuestionFields from '@/components/questions/QuestionFields.vue'
import { isGradedKind, type GradedQuestion } from '@/components/questions/question-kinds'
import { ACCEPT, uploadLessonAsset, useLessonAssetContext, type UploadedAsset } from './asset-context'
import { toast } from 'vue-sonner'
import { ApiError } from '@/api/client'
import { createQuestionBankItem, type UpsertQuestionBankItemRequest } from '@/api/assessment'
import { hasPermission } from '@/store/auth'
import { useRouter } from 'vue-router'

/** Edits one block of an interactive lesson. Errors arrive already scoped to this block, keyed
 * relative to it ("prompt", "options", "items[1].text"). */
const block = defineModel<LessonBlock>('block', { required: true })
const props = defineProps<{
  index: number
  total: number
  errors: Record<string, string[]>
  /** Learner results for this block (check blocks with answers only). */
  insight: LessonBlockInsight | null
  /** The lesson shows cards, so blocks can be kept on the same card as the next one. */
  cards: boolean
}>()
defineEmits<{ move: [delta: -1 | 1]; duplicate: []; remove: [] }>()

const field = 'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4) aria-invalid:border-(--danger)'
const iconButton = 'size-7 shrink-0'
const codeArea = 'w-full resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-2 font-mono text-[13px] text-(--fg-2) outline-none aria-invalid:border-(--danger)'

const CODE_LANGUAGES = { cpp: 'Arduino / C++', python: 'Python', javascript: 'JavaScript', lua: 'Lua', text: 'Plain text' }

function percent(count: number, of: number): string {
  return `${Math.round((count / of) * 100)}%`
}

function err(key: string): string[] {
  return props.errors[key] ?? []
}

function invalid(key: string): boolean {
  return err(key).length > 0
}

function move<T>(list: T[], index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= list.length) return
  ;[list[index], list[target]] = [list[target]!, list[index]!]
}

const assets = useLessonAssetContext()
const router = useRouter()

// Questions can be reused in graded quizzes through the bank. Multiple choice maps onto the bank's
// original fields (its feedback has no place there yet); order, fill in the blanks, match and
// number go as they are - the bank and quizzes share their definition with lessons.
const canSaveToBank = hasPermission('assessment:assessments:author')
const savingToBank = ref(false)

async function saveToQuestionBank() {
  if (isGradedKind(block.value.type)) {
    await saveRequest({ kind: block.value.type, definition: block.value as GradedQuestion })
    return
  }
  if (block.value.type !== 'choice') return
  const options = block.value.options
  const correct = options.findIndex(o => o.correct)
  if (!block.value.prompt.trim() || options.length < 2 || correct === -1 || options.some(o => !o.text.trim())) {
    toast.error('Finish the question first: a question, at least 2 options and the correct one marked.')
    return
  }
  await saveRequest({ text: block.value.prompt.trim(), options: options.map(o => o.text.trim()), correctOptionIndex: correct })
}

async function saveRequest(request: UpsertQuestionBankItemRequest) {
  savingToBank.value = true
  try {
    await createQuestionBankItem(request)
    toast.success('Saved to the question bank.', {
      action: { label: 'Open', onClick: () => void router.push('/assessment/question-bank') },
    })
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : "Couldn't save to the question bank.")
  } finally {
    savingToBank.value = false
  }
}



// Images (and diagrams) keep the phone-sized copy alongside; a replaced image drops the old one.
function setImage(uploaded: UploadedAsset) {
  if (block.value.type !== 'image') return
  block.value.asset = uploaded.key
  block.value.assetSmall = uploaded.smallKey
}

function setModel(uploaded: UploadedAsset) {
  if (block.value.type === 'model3d') block.value.asset = uploaded.key
}

// Gallery: several photos at once, uploaded one after another (each resized like an image block).
const galleryInput = ref<HTMLInputElement | null>(null)
const galleryProgress = ref<string | null>(null)

async function addGalleryPhotos(event: Event) {
  const target = event.target as HTMLInputElement
  const files = [...(target.files ?? [])]
  target.value = ''
  for (const [i, file] of files.entries()) {
    if (block.value.type !== 'gallery') return
    galleryProgress.value = `${i + 1} of ${files.length}`
    try {
      const uploaded = await uploadLessonAsset(assets, 'image', file, () => {})
      block.value.images.push({ id: newId(), asset: uploaded.key, assetSmall: uploaded.smallKey, alt: '' })
    } catch (error) {
      toast.error(`${file.name}: ${error instanceof ApiError || error instanceof Error ? error.message : 'Upload failed.'}`)
    }
  }
  galleryProgress.value = null
}

function setMedia(uploaded: UploadedAsset) {
  if (block.value.type === 'video' || block.value.type === 'audio') block.value.asset = uploaded.key
}

function setFile(uploaded: UploadedAsset, file: File) {
  if (block.value.type !== 'file') return
  block.value.asset = uploaded.key
  if (!block.value.name?.trim()) block.value.name = file.name
}

// Paste any YouTube/Wokwi link; YouTube watch links become embed links.
function setEmbedUrl(value: string) {
  if (block.value.type === 'embed') block.value.url = toEmbedUrl(value)
}
const embedUrlProblem = computed(() =>
  block.value.type === 'embed' && block.value.url && !isAllowedEmbed(block.value.url)
    ? 'Only Wokwi, Tinkercad, YouTube and H5P links can be embedded.'
    : '')

function markCorrect(optionId: string) {
  if (block.value.type !== 'choice') return
  for (const option of block.value.options) option.correct = option.id === optionId || undefined
}
</script>

<template>
  <div
    class="rounded-(--ra-lg) border bg-(--bg-2)"
    :class="Object.keys(errors).length ? 'border-(--danger)' : 'border-(--line-1)'"
  >
    <div class="flex items-center gap-2 border-b border-(--line-1) px-3 py-2">
      <component :is="blockTypeMeta(block.type).icon" :size="14" class="shrink-0 text-(--fg-3)" />
      <span class="text-[13px] font-semibold text-(--fg-1)">{{ index + 1 }}. {{ blockTypeMeta(block.type).label }}</span>
      <label
        v-if="isCheckBlock(block)"
        class="ml-2 inline-flex items-center gap-1.5 text-xs text-(--fg-3)"
        title="Learners must answer a required check before they can continue"
      >
        <input
          type="checkbox"
          class="size-3.5 accent-(--brand-blue)"
          :checked="block.required !== false"
          @change="block.required = ($event.target as HTMLInputElement).checked ? undefined : false"
        >
        Required
      </label>
      <label
        v-if="cards && index < total - 1"
        class="ml-2 inline-flex items-center gap-1.5 text-xs text-(--fg-3)"
        title="Show this block on the same card as the next one, e.g. a diagram and its question"
      >
        <input
          type="checkbox"
          class="size-3.5 accent-(--brand-blue)"
          :checked="block.keepWithNext === true"
          @change="block.keepWithNext = ($event.target as HTMLInputElement).checked || undefined"
        >
        Show with next
      </label>
      <div class="ml-auto flex items-center gap-0.5">
        <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="index === 0" aria-label="Move block up" @click="$emit('move', -1)"><ArrowUp :size="14" /></Button>
        <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="index === total - 1" aria-label="Move block down" @click="$emit('move', 1)"><ArrowDown :size="14" /></Button>
        <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" aria-label="Duplicate block" @click="$emit('duplicate')"><Copy :size="14" /></Button>
        <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" aria-label="Delete block" @click="$emit('remove')"><Trash2 :size="14" /></Button>
      </div>
    </div>

    <!-- How learners have done on this check so far; a low first-try rate points at a confusing question. -->
    <div
      v-if="insight && insight.learners > 0"
      class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-(--line-1) bg-(--bg-3) px-3 py-2 text-xs text-(--fg-3)"
    >
      <span><strong class="text-(--fg-1)">{{ insight.learners }}</strong> {{ insight.learners === 1 ? 'learner' : 'learners' }}</span>
      <span><strong class="text-(--fg-1)">{{ percent(insight.firstTryCorrect, insight.learners) }}</strong> right first time</span>
      <span><strong class="text-(--fg-1)">{{ percent(insight.revealedAnswer, insight.learners) }}</strong> asked for the answer</span>
      <span v-if="insight.wrongPicks.length" class="basis-full">
        Most picked wrong answer: <strong class="text-(--fg-1)">"{{ insight.wrongPicks[0]!.optionText }}"</strong>
        ({{ insight.wrongPicks[0]!.count }})
      </span>
    </div>

    <div class="flex flex-col gap-3 p-3">
      <!-- Text -->
      <template v-if="block.type === 'text'">
        <RichTextEditor v-model="block.body" placeholder="Explain the idea…" :rows="5" />
        <p v-for="msg in err('body')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
      </template>

      <!-- Multiple choice -->
      <template v-else-if="block.type === 'choice'">
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Question
          <input v-model="block.prompt" :class="field" :aria-invalid="invalid('prompt')" placeholder="e.g. Why does the LED need a resistor?">
        </label>
        <p v-for="msg in err('prompt')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>

        <div class="flex flex-col gap-2">
          <span class="text-xs text-(--fg-3)">Options: select the correct one, and add feedback for wrong answers</span>
          <div v-for="(option, j) in block.options" :key="option.id" class="grid grid-cols-[20px_1fr_1fr_auto] items-center gap-2 max-md:grid-cols-[20px_1fr_auto]">
            <input
              type="radio"
              :name="`correct-${block.id}`"
              class="size-4 accent-(--success)"
              :checked="!!option.correct"
              :aria-label="`Mark option ${j + 1} correct`"
              @change="markCorrect(option.id)"
            >
            <input v-model="option.text" :class="field" :aria-invalid="invalid(`options[${j}].text`)" :placeholder="`Option ${j + 1}`">
            <input
              v-model="option.feedback"
              :class="[field, 'max-md:col-start-2']"
              :placeholder="option.correct ? 'Feedback (optional)' : 'Why this is wrong (optional)'"
            >
            <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="block.options.length <= 2" aria-label="Remove option" @click="block.options.splice(j, 1)"><X :size="14" /></Button>
          </div>
          <Button variant="ghost" size="sm" type="button" class="self-start" @click="block.options.push({ id: newId(), text: '' })"><Plus :size="14" /> Add option</Button>
          <p v-for="msg in err('options')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        </div>

        <label class="grid gap-1 text-xs text-(--fg-3)">
          Explanation (shown once answered)
          <input v-model="block.explanation" :class="field" placeholder="Optional">
        </label>
        <div v-if="canSaveToBank" class="flex items-center gap-2">
          <Button variant="outline" size="sm" type="button" :disabled="savingToBank" @click="saveToQuestionBank">
            <Library :size="12" /> {{ savingToBank ? 'Saving…' : 'Save to question bank' }}
          </Button>
          <span class="text-xs text-(--fg-4)">For graded quizzes. Saves the question and options; feedback and explanation stay here.</span>
        </div>
      </template>

      <!-- Order, fill in the blanks, match, number: shared with quizzes and the question bank -->
      <template v-else-if="isGradedKind(block.type)">
        <QuestionFields v-model:question="block" :errors="errors" />
        <div v-if="canSaveToBank" class="flex items-center gap-2">
          <Button variant="outline" size="sm" type="button" :disabled="savingToBank" @click="saveToQuestionBank">
            <Library :size="12" /> {{ savingToBank ? 'Saving…' : 'Save to question bank' }}
          </Button>
          <span class="text-xs text-(--fg-4)">For graded quizzes, where the server marks it.</span>
        </div>
      </template>

      <!-- Reveal -->
      <template v-else-if="block.type === 'reveal'">
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Prompt
          <input v-model="block.prompt" :class="field" placeholder="Optional, e.g. Tap each part to see what it does.">
        </label>

        <div class="flex flex-col gap-3">
          <div v-for="(item, j) in block.items" :key="item.id" class="flex flex-col gap-2 rounded-(--ra-md) border border-(--line-1) p-2.5">
            <div class="flex items-center gap-2">
              <input v-model="item.label" :class="field" :aria-invalid="invalid(`items[${j}].label`)" :placeholder="`Card ${j + 1} label`">
              <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="block.items.length <= 1" aria-label="Remove card" @click="block.items.splice(j, 1)"><X :size="14" /></Button>
            </div>
            <RichTextEditor v-model="item.body" placeholder="What learners see when they open it…" :rows="2" />
            <p v-if="invalid(`items[${j}].label`) || invalid(`items[${j}].body`)" class="m-0 text-xs text-(--danger)">Each card needs a label and some text.</p>
          </div>
          <Button variant="ghost" size="sm" type="button" class="self-start" @click="block.items.push({ id: newId(), label: '', body: '' })"><Plus :size="14" /> Add card</Button>
          <p v-for="msg in err('items')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        </div>
      </template>

      <!-- Image -->
      <template v-else-if="block.type === 'image'">
        <AssetField kind="image" :asset-key="block.asset" :invalid="invalid('asset')" @uploaded="setImage" />
        <p v-for="msg in err('asset')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Description (alt text)
          <input v-model="block.alt" :class="field" :aria-invalid="invalid('alt')" placeholder="e.g. An Arduino Uno with an LED on pin 13">
        </label>
        <p v-for="msg in err('alt')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Caption
          <input v-model="block.caption" :class="field" placeholder="Optional">
        </label>
      </template>

      <!-- Video / Audio -->
      <template v-else-if="block.type === 'video' || block.type === 'audio'">
        <AssetField :kind="block.type" :asset-key="block.asset" :invalid="invalid('asset')" @uploaded="setMedia" />
        <p v-for="msg in err('asset')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <AssetField
          v-if="block.type === 'video'"
          kind="image"
          label="Poster image (shown before it plays; optional)"
          :asset-key="block.poster"
          @uploaded="(u) => block.type === 'video' && (block.poster = u.key)"
        />
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Caption
          <input v-model="block.caption" :class="field" placeholder="Optional">
        </label>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Transcript{{ block.type === 'video' ? ' (recommended)' : '' }}
          <textarea
            v-model="block.transcript"
            rows="4"
            :aria-invalid="invalid('transcript')"
            class="w-full resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-2 text-sm text-(--fg-2) outline-none aria-invalid:border-(--danger)"
            placeholder="What's said, for learners who can't listen. The AI tutor reads it too."
          />
        </label>
        <p v-for="msg in err('transcript')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
      </template>

      <!-- Download -->
      <template v-else-if="block.type === 'file'">
        <AssetField kind="file" :asset-key="block.asset" :invalid="invalid('asset')" @uploaded="setFile" />
        <p v-for="msg in err('asset')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Name
          <input v-model="block.name" :class="field" :aria-invalid="invalid('name')" placeholder="e.g. Arduino Uno pinout (PDF)">
        </label>
        <p v-for="msg in err('name')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Description
          <input v-model="block.description" :class="field" placeholder="Optional">
        </label>
      </template>

      <!-- Embedded activity -->
      <template v-else-if="block.type === 'embed'">
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Link
          <input
            :value="block.url"
            :class="field"
            :aria-invalid="invalid('url') || !!embedUrlProblem"
            placeholder="https://wokwi.com/projects/… or a YouTube link"
            @change="setEmbedUrl(($event.target as HTMLInputElement).value)"
          >
        </label>
        <p v-if="embedUrlProblem" class="m-0 text-xs text-(--danger)">{{ embedUrlProblem }}</p>
        <p v-for="msg in err('url')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <div class="grid grid-cols-[1fr_120px] gap-2">
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Title
            <input v-model="block.title" :class="field" :aria-invalid="invalid('title')" placeholder="e.g. Blink an LED in the simulator">
          </label>
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Shape
            <select v-model="block.aspect" :class="field">
              <option value="16:9">Wide (16:9)</option>
              <option value="4:3">Standard (4:3)</option>
              <option value="1:1">Square</option>
            </select>
          </label>
        </div>
        <p v-for="msg in err('title')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
      </template>

      <!-- Photo gallery -->
      <template v-else-if="block.type === 'gallery'">
        <div v-for="(image, j) in block.images" :key="image.id" class="flex gap-3 rounded-(--ra-md) border border-(--line-1) p-2.5">
          <img v-if="assets.urls.value[image.asset]" :src="assets.urls.value[image.asset]" alt="" class="h-16 w-20 shrink-0 rounded-(--ra-sm) object-cover">
          <div v-else class="h-16 w-20 shrink-0 rounded-(--ra-sm) bg-(--bg-3)" />
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <input v-model="image.alt" :class="field" :aria-invalid="invalid(`images[${j}].alt`)" :placeholder="`Photo ${j + 1}: what it shows (alt text)`">
            <input v-model="image.caption" :class="field" placeholder="Caption (optional)">
          </div>
          <div class="flex flex-col gap-0.5">
            <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="j === 0" aria-label="Move photo up" @click="move(block.images, j, -1)"><ArrowUp :size="14" /></Button>
            <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" :disabled="j === block.images.length - 1" aria-label="Move photo down" @click="move(block.images, j, 1)"><ArrowDown :size="14" /></Button>
            <Button variant="ghost" size="icon-sm" :class="iconButton" type="button" aria-label="Remove photo" @click="block.images.splice(j, 1)"><X :size="14" /></Button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Button variant="outline" size="sm" type="button" :disabled="galleryProgress !== null" @click="galleryInput?.click()">
            <Plus :size="12" /> Add photos
          </Button>
          <span v-if="galleryProgress" class="text-xs text-(--fg-3)">Uploading {{ galleryProgress }}…</span>
          <input ref="galleryInput" type="file" multiple :accept="ACCEPT.image" class="hidden" @change="addGalleryPhotos">
        </div>
        <p v-for="msg in err('images')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <p v-if="block.images.some((_, j) => invalid(`images[${j}].alt`))" class="m-0 text-xs text-(--danger)">Describe every photo.</p>
      </template>

      <!-- Code snippet -->
      <template v-else-if="block.type === 'code'">
        <label class="grid w-48 gap-1 text-xs text-(--fg-3)">
          Language
          <select v-model="block.language" :class="field">
            <option v-for="(label, value) in CODE_LANGUAGES" :key="value" :value="value">{{ label }}</option>
          </select>
        </label>
        <textarea
          v-model="block.code"
          rows="8"
          spellcheck="false"
          :aria-invalid="invalid('code')"
          :class="codeArea"
          placeholder="void setup() {&#10;  pinMode(13, OUTPUT);&#10;}"
        />
        <p v-for="msg in err('code')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Caption
          <input v-model="block.caption" :class="field" placeholder="Optional, e.g. The Blink sketch">
        </label>
      </template>

      <!-- 3D model -->
      <template v-else-if="block.type === 'model3d'">
        <AssetField kind="model" :asset-key="block.asset" :invalid="invalid('asset')" @uploaded="setModel" />
        <p class="m-0 text-xs text-(--fg-4)">A .glb file up to 25 MB. Smaller loads faster on phones; export with compressed textures if you can.</p>
        <p v-for="msg in err('asset')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Description (alt text)
          <input v-model="block.alt" :class="field" :aria-invalid="invalid('alt')" placeholder="e.g. A two-wheeled robot chassis with a caster at the back">
        </label>
        <p v-for="msg in err('alt')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Caption
          <input v-model="block.caption" :class="field" placeholder="Optional">
        </label>
      </template>

      <!-- Coding task -->
      <template v-else-if="block.type === 'program'">
        <div class="grid grid-cols-[1fr_160px] gap-2 max-md:grid-cols-1">
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Task
            <input v-model="block.prompt" :class="field" :aria-invalid="invalid('prompt')" placeholder="e.g. Print the numbers 1 to 5, one per line.">
          </label>
          <label class="grid gap-1 text-xs text-(--fg-3)">
            Language
            <select v-model="block.language" :class="field">
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="lua">Lua</option>
              <option value="blocks">Blocks</option>
            </select>
          </label>
        </div>
        <p v-for="msg in err('prompt')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <p v-if="block.language === 'blocks'" class="m-0 text-xs text-(--fg-4)">
          Learners build the program from logic, loop, maths, text and variable blocks, starting from an empty workspace. Use a "print" block to show output.
        </p>
        <label v-if="block.language !== 'blocks'" class="grid gap-1 text-xs text-(--fg-3)">
          Starter code (what learners begin with)
          <textarea v-model="block.starter" rows="5" spellcheck="false" :class="codeArea" placeholder="# Write your code here" />
        </label>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Expected output (what a correct program prints)
          <textarea v-model="block.expectedOutput" rows="4" spellcheck="false" :aria-invalid="invalid('expectedOutput')" :class="codeArea" placeholder="1&#10;2&#10;3&#10;4&#10;5" />
        </label>
        <p v-for="msg in err('expectedOutput')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
        <label v-if="block.language !== 'blocks'" class="grid gap-1 text-xs text-(--fg-3)">
          Solution (shown if a learner asks for the answer; optional)
          <textarea v-model="block.solution" rows="5" spellcheck="false" :class="codeArea" />
        </label>
        <label class="grid gap-1 text-xs text-(--fg-3)">
          Explanation (shown once answered)
          <input v-model="block.explanation" :class="field" placeholder="Optional">
        </label>
        <p class="m-0 text-xs text-(--fg-4)">Output is compared line by line, ignoring spaces at the end of lines. Run your solution in the preview to check it.</p>
      </template>

      <p v-for="msg in err('id')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
      <p v-for="msg in err('type')" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
    </div>
  </div>
</template>
