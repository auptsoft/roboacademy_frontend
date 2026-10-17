<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bot, Code2, ImagePlus, Loader2, X } from 'lucide-vue-next'
import { listMyRuns, uploadImage, type CodeLanguage, type PickedAttachments, type SharedRun } from '@/api/community'

// Adds images, a code snippet or one of the learner's simulation runs to a post or reply. Images
// upload as soon as they're chosen; the parent sends only the ids. At most four things in all.

const props = defineProps<{
  imagesAllowed: boolean
  /** Offer simulation runs (Q&A with the plan feature on). */
  runsAllowed: boolean
  lessonId?: string | null
}>()
const model = defineModel<PickedAttachments>({ required: true })

const MAX = 4
const count = computed(() => model.value.images.length + model.value.code.length + model.value.runs.length)
const full = computed(() => count.value >= MAX)

const uploading = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const codeOpen = ref(false)
const codeLanguage = ref<CodeLanguage>('python')
const codeText = ref('')

const runsOpen = ref(false)
const runs = ref<SharedRun[]>([])
const runsLoading = ref(false)

async function onFiles(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  ;(event.target as HTMLInputElement).value = ''
  error.value = ''
  for (const file of files.slice(0, MAX - count.value)) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      error.value = 'Choose a PNG, JPEG, WebP or GIF image.'
      continue
    }
    if (file.size > 5 * 1024 * 1024) {
      error.value = 'Images can be at most 5 MB.'
      continue
    }
    uploading.value = true
    try {
      const id = await uploadImage(file)
      model.value = { ...model.value, images: [...model.value.images, { id, name: file.name, preview: URL.createObjectURL(file) }] }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Couldn't upload the image."
    } finally {
      uploading.value = false
    }
  }
}

function addCode() {
  if (!codeText.value.trim()) return
  model.value = { ...model.value, code: [...model.value.code, { language: codeLanguage.value, code: codeText.value }] }
  codeText.value = ''
  codeOpen.value = false
}

async function openRuns() {
  runsOpen.value = !runsOpen.value
  if (!runsOpen.value || runs.value.length) return
  runsLoading.value = true
  error.value = ''
  try {
    runs.value = await listMyRuns(props.lessonId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't load your runs."
  } finally {
    runsLoading.value = false
  }
}

function addRun(run: SharedRun) {
  if (!model.value.runs.some((r) => r.runId === run.runId)) {
    model.value = { ...model.value, runs: [...model.value.runs, run] }
  }
  runsOpen.value = false
}

function remove(kind: 'images' | 'code' | 'runs', index: number) {
  const next = [...model.value[kind]]
  next.splice(index, 1)
  model.value = { ...model.value, [kind]: next }
}

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-(--ra-md) border border-(--line-2) bg-transparent px-2.5 py-1.5 text-xs font-semibold text-(--fg-2) cursor-pointer hover:border-(--fg-3) hover:text-(--fg-1) disabled:cursor-not-allowed disabled:opacity-50'
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="count" class="flex flex-wrap gap-2">
      <span v-for="(image, i) in model.images" :key="image.id" class="relative">
        <img :src="image.preview" :alt="image.name" class="h-16 w-16 rounded-(--ra-md) border border-(--line-1) object-cover" />
        <button type="button" class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-0 bg-(--fg-1) text-(--bg-0) cursor-pointer" :aria-label="`Remove ${image.name}`" @click="remove('images', i)"><X :size="12" /></button>
      </span>
      <span v-for="(snippet, i) in model.code" :key="`code-${i}`" class="inline-flex items-center gap-1.5 rounded-(--ra-md) border border-(--line-1) bg-(--bg-2) px-2.5 py-1.5 text-xs text-(--fg-2)">
        <Code2 :size="13" /> {{ snippet.language }} code
        <button type="button" class="border-0 bg-transparent p-0 text-(--fg-3) hover:text-(--fg-1) cursor-pointer" aria-label="Remove code" @click="remove('code', i)"><X :size="12" /></button>
      </span>
      <span v-for="(run, i) in model.runs" :key="run.runId" class="inline-flex items-center gap-1.5 rounded-(--ra-md) border border-(--line-1) bg-(--bg-2) px-2.5 py-1.5 text-xs text-(--fg-2)">
        <Bot :size="13" /> {{ run.sceneName }}
        <button type="button" class="border-0 bg-transparent p-0 text-(--fg-3) hover:text-(--fg-1) cursor-pointer" aria-label="Remove run" @click="remove('runs', i)"><X :size="12" /></button>
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <template v-if="imagesAllowed">
        <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple class="hidden" @change="onFiles" />
        <button type="button" :class="buttonClass" :disabled="full || uploading" @click="fileInput?.click()">
          <Loader2 v-if="uploading" :size="13" class="animate-spin" /><ImagePlus v-else :size="13" /> Image
        </button>
      </template>
      <button type="button" :class="buttonClass" :disabled="full" @click="codeOpen = !codeOpen"><Code2 :size="13" /> Code</button>
      <button v-if="runsAllowed" type="button" :class="buttonClass" :disabled="full" @click="openRuns"><Bot :size="13" /> Simulation run</button>
      <span v-if="full" class="text-xs text-(--fg-3)">Up to {{ MAX }} attachments.</span>
    </div>

    <div v-if="codeOpen" class="flex flex-col gap-2 rounded-(--ra-md) border border-(--line-1) bg-(--bg-1) p-3">
      <select v-model="codeLanguage" class="self-start rounded-(--ra-md) border border-(--line-2) bg-(--bg-0) px-2 py-1 text-xs text-(--fg-1)">
        <option value="python">Python</option>
        <option value="javascript">JavaScript</option>
        <option value="lua">Lua</option>
        <option value="blocks">Blocks</option>
        <option value="text">Text</option>
      </select>
      <textarea
        v-model="codeText"
        rows="6"
        maxlength="32768"
        spellcheck="false"
        placeholder="Paste your code"
        class="resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-0) px-3 py-2 font-mono text-[12.5px] text-(--fg-1) outline-none focus:border-(--brand-blue)"
      />
      <div class="flex justify-end gap-2">
        <button type="button" :class="buttonClass" @click="codeOpen = false">Cancel</button>
        <button type="button" :class="buttonClass" :disabled="!codeText.trim()" @click="addCode">Add code</button>
      </div>
    </div>

    <div v-if="runsOpen" class="rounded-(--ra-md) border border-(--line-1) bg-(--bg-1) p-2">
      <p v-if="runsLoading" class="m-0 flex items-center gap-2 px-1 py-1 text-xs text-(--fg-3)"><Loader2 :size="13" class="animate-spin" /> Loading your runs…</p>
      <p v-else-if="!runs.length" class="m-0 px-1 py-1 text-xs text-(--fg-3)">You haven't run a program here yet.</p>
      <button
        v-for="run in runs"
        v-else
        :key="run.runId"
        type="button"
        class="flex w-full items-center justify-between gap-3 rounded-(--ra-md) border-0 bg-transparent px-2 py-1.5 text-left text-xs text-(--fg-1) cursor-pointer hover:bg-(--bg-3)"
        @click="addRun(run)"
      >
        <span class="font-semibold">{{ run.sceneName }}</span>
        <span class="text-(--fg-3)">{{ run.language }} · {{ new Date(run.submittedAt).toLocaleString() }}</span>
      </button>
    </div>

    <p v-if="error" class="m-0 text-xs text-(--danger)">{{ error }}</p>
  </div>
</template>
