<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaChip } from '@roboacademy/ui'
import { Sparkles, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import { draftQuizQuestions, type AIQuizCandidate, type AITier, type QuizDifficulty } from '@/api/ai'
import { createQuestionBankItem } from '@/api/assessment'
import { getCourse, listCourseCatalog, type CourseCatalogItem, type CourseDetail } from '@/api/learning'
import { useAIAvailability } from '@/composables/useAIAvailability'

// Drafts multiple-choice questions from chosen lessons' notes. Every candidate starts un-kept and
// has to be reviewed one by one - a wrong correct answer silently mis-grades learners - and only
// kept ones are saved, through the question bank's normal create endpoint.

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [count: number] }>()

const availability = useAIAvailability()
const canUseEnhanced = computed(() => availability.feature('Authoring')?.canUseEnhanced ?? false)

const MAX_LESSONS = 10

// --- Step 1: source ---
const courses = ref<CourseCatalogItem[]>([])
const courseId = ref('')
const course = ref<CourseDetail | null>(null)
const selectedLessons = ref<string[]>([])
const form = reactive({ count: 5, difficulty: 'Mixed' as QuizDifficulty })

watch(open, async (isOpen) => {
  if (!isOpen) return
  reset()
  try {
    courses.value = (await listCourseCatalog({}, 1, 100)).items
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load courses.')
  }
})

watch(courseId, async (id) => {
  course.value = null
  selectedLessons.value = []
  if (!id) return
  try {
    course.value = await getCourse(id)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load the course.')
  }
})

function hasNotes(context: string | null): boolean {
  return !!context && context.trim().length > 0
}

function toggleLesson(lessonId: string) {
  const index = selectedLessons.value.indexOf(lessonId)
  if (index >= 0) selectedLessons.value.splice(index, 1)
  else if (selectedLessons.value.length < MAX_LESSONS) selectedLessons.value.push(lessonId)
  else toast.error(`Choose at most ${MAX_LESSONS} lessons.`)
}

// --- Step 2: review ---
interface Candidate extends AIQuizCandidate {
  keep: boolean
}

const candidates = ref<Candidate[]>([])
const tier = ref<AITier | null>(null)
const generating = ref(false)
const saving = ref(false)

const lessonTitles = computed(() => {
  const map = new Map<string, string>()
  for (const module of course.value?.modules ?? []) {
    for (const lesson of module.lessons) map.set(lesson.id, lesson.title)
  }
  return map
})

const keptCount = computed(() => candidates.value.filter((c) => c.keep).length)

function reset() {
  courseId.value = ''
  course.value = null
  selectedLessons.value = []
  candidates.value = []
  tier.value = null
  form.count = 5
  form.difficulty = 'Mixed'
}

async function generate(requestTier?: AITier) {
  if (selectedLessons.value.length === 0) return
  generating.value = true
  try {
    const result = await draftQuizQuestions({
      lessonIds: selectedLessons.value,
      count: Number(form.count),
      difficulty: form.difficulty,
      tier: requestTier,
    })
    candidates.value = result.candidates.map((c) => ({ ...c, options: [...c.options], keep: false }))
    tier.value = result.tier
    if (result.candidates.length === 0) {
      toast.error('No usable questions came back. Try again, or choose lessons with more notes.')
    } else if (result.dropped > 0) {
      toast.message(`${result.dropped} question${result.dropped === 1 ? ' was' : 's were'} left out because ${result.dropped === 1 ? 'it was' : 'they were'} malformed.`)
    }
    await availability.load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to generate questions.')
  } finally {
    generating.value = false
  }
}

function removeOption(candidate: Candidate, index: number) {
  if (candidate.options.length <= 2) return
  candidate.options.splice(index, 1)
  if (candidate.correctOptionIndex >= candidate.options.length) candidate.correctOptionIndex = 0
  else if (index < candidate.correctOptionIndex) candidate.correctOptionIndex -= 1
}

async function saveKept() {
  const kept = candidates.value.filter((c) => c.keep)
  if (kept.some((c) => !c.text.trim() || c.options.some((o) => !o.trim()))) {
    toast.error('Every kept question needs text and non-empty options.')
    return
  }
  saving.value = true
  let saved = 0
  try {
    for (const candidate of kept) {
      await createQuestionBankItem({
        text: candidate.text.trim(),
        options: candidate.options.map((o) => o.trim()),
        correctOptionIndex: candidate.correctOptionIndex,
        tags: candidate.suggestedTags,
      })
      saved += 1
    }
    toast.success(`${saved} question${saved === 1 ? '' : 's'} added to the bank.`)
    emit('saved', saved)
    open.value = false
  } catch (error) {
    toast.error(`${saved} saved before an error: ${error instanceof ApiError ? error.message : 'failed to save.'}`)
    if (saved > 0) emit('saved', saved)
  } finally {
    saving.value = false
  }
}

const selectClass =
  'h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2"><Sparkles :size="16" /> Generate questions with AI</DialogTitle>
        <DialogDescription>
          Drafts multiple-choice questions from lesson notes. Nothing is saved until you keep it.
        </DialogDescription>
      </DialogHeader>

      <!-- Source -->
      <form v-if="candidates.length === 0" class="flex flex-col gap-4" @submit.prevent="generate()">
        <div class="flex flex-col gap-1.5">
          <Label for="ai-quiz-course">Course</Label>
          <select id="ai-quiz-course" v-model="courseId" :class="selectClass" required>
            <option value="" disabled>Choose a course…</option>
            <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
          </select>
        </div>

        <div v-if="course" class="flex flex-col gap-2">
          <Label>Lessons ({{ selectedLessons.length }}/{{ MAX_LESSONS }})</Label>
          <div class="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-(--ra-md) border border-(--line-2) p-3">
            <div v-for="module in course.modules" :key="module.id" class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-(--fg-3)">{{ module.title }}</span>
              <label
                v-for="lesson in module.lessons"
                :key="lesson.id"
                class="flex items-center gap-2 text-sm"
                :class="hasNotes(lesson.context) ? 'cursor-pointer text-(--fg-1)' : 'text-(--fg-4)'"
              >
                <input
                  type="checkbox"
                  class="size-4 accent-(--primary)"
                  :checked="selectedLessons.includes(lesson.id)"
                  :disabled="!hasNotes(lesson.context)"
                  @change="toggleLesson(lesson.id)"
                >
                {{ lesson.title }}
                <span v-if="!hasNotes(lesson.context)" class="text-xs">(no notes)</span>
              </label>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <Label for="ai-quiz-count">Questions</Label>
            <Input id="ai-quiz-count" v-model="form.count" type="number" min="1" max="20" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="ai-quiz-difficulty">Difficulty</Label>
            <select id="ai-quiz-difficulty" v-model="form.difficulty" :class="selectClass">
              <option value="Mixed">Mixed</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" @click="open = false">Cancel</Button>
          <Button type="submit" :disabled="generating || selectedLessons.length === 0">
            {{ generating ? 'Generating…' : 'Generate' }}
          </Button>
        </DialogFooter>
      </form>

      <!-- Review -->
      <div v-else class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="m-0 text-xs text-(--fg-3)">
            AI-generated. Check every answer before keeping it.
            <RaChip v-if="tier === 'Enhanced'" tone="info" class="ml-1">Enhanced</RaChip>
          </p>
          <div class="flex gap-2">
            <Button
              v-if="canUseEnhanced && tier !== 'Enhanced'"
              size="sm" variant="ghost" type="button" :disabled="generating"
              @click="generate('Enhanced')"
            >
              Try a better version
            </Button>
            <Button size="sm" variant="outline" type="button" :disabled="generating" @click="candidates = []">Start over</Button>
          </div>
        </div>

        <div
          v-for="(candidate, index) in candidates"
          :key="index"
          class="flex flex-col gap-2.5 rounded-(--ra-md) border p-3.5"
          :class="candidate.keep ? 'border-(--primary)' : 'border-(--line-2)'"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="text-xs text-(--fg-3)">From: {{ lessonTitles.get(candidate.sourceLessonId) ?? 'lesson' }}</span>
            <label class="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-(--fg-1)">
              <input v-model="candidate.keep" type="checkbox" class="size-4 accent-(--primary)"> Keep
            </label>
          </div>
          <textarea
            v-model="candidate.text"
            rows="2"
            :aria-label="`Question ${index + 1}`"
            class="w-full resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-sans text-sm text-(--fg-1) outline-none"
          />
          <div class="flex flex-col gap-1.5">
            <div v-for="(_, optionIndex) in candidate.options" :key="optionIndex" class="flex items-center gap-2">
              <input
                v-model="candidate.correctOptionIndex"
                type="radio"
                :name="`ai-correct-${index}`"
                :value="optionIndex"
                class="size-4 accent-(--success)"
                :aria-label="`Option ${optionIndex + 1} is correct`"
              >
              <Input v-model="candidate.options[optionIndex]" class="h-8 flex-1" :aria-label="`Option ${optionIndex + 1}`" />
              <Button
                size="icon-sm" variant="ghost" type="button"
                :disabled="candidate.options.length <= 2"
                :aria-label="`Remove option ${optionIndex + 1}`"
                @click="removeOption(candidate, optionIndex)"
              >
                <Trash2 :size="13" />
              </Button>
            </div>
          </div>
          <p v-if="candidate.explanation" class="m-0 text-xs text-(--fg-3)">Why: {{ candidate.explanation }}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" @click="open = false">Cancel</Button>
          <Button type="button" :disabled="saving || keptCount === 0" @click="saveKept">
            {{ saving ? 'Saving…' : `Save kept (${keptCount})` }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
