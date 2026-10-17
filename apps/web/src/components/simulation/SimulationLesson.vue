<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Lightbulb, Loader2 } from 'lucide-vue-next'
import { RaButton, RaCard } from '@roboacademy/ui'
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type ProgramLanguage } from '@roboacademy/sim'
import { SimulationPlayer, type RunEndPayload, type RunMode } from '@roboacademy/sim/vue'
import { ApiError } from '@/api/client'
import {
  getSimulationLesson,
  requestSimulationHint,
  saveSimulationProgram,
  startSimulationRun,
  submitSimulationRun,
  type SimulationHint,
  type SimulationLesson,
} from '@/api/simulation'
import { useAIAvailability } from '@/composables/useAIAvailability'
import { useAchievements } from '@/composables/useAchievements'
import { brandingKey, featureConfirmed } from '@/branding'
import ChallengeStars from '@/components/gamification/ChallengeStars.vue'

/**
 * A Simulation lesson in the in-house simulator. Loads the scene, saves the learner's program as
 * they edit, and records each run. Completion is never self-reported: a passing graded run is
 * scored on the server, which records lesson progress itself.
 *
 * Hints (when the school offers them) are worked out on the server from the learner's latest
 * recorded run, so a hint request carries nothing but the lesson.
 */
const props = defineProps<{ lessonId: string }>()

const emit = defineEmits<{
  /** A graded run was scored. Progress for a pass is recorded by the backend shortly after. */
  graded: [result: { score: number; passed: boolean }]
  /** The learner followed a hint's link to a related lesson. */
  openLesson: [lessonId: string]
}>()

const lesson = shallowRef<SimulationLesson | null>(null)
const loadState = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
const saveState = ref<'idle' | 'saving' | 'error'>('idle')
const submitting = ref(false)
const lastGraded = ref<{ score: number; passed: boolean; stars: number | null } | null>(null)
const submitError = ref('')

const { simHintsAvailable } = useAIAvailability()

// Challenge stars are worked out for every graded run, but shown only on plans with gamification.
const branding = inject(brandingKey, null)
const showStars = computed(() => featureConfirmed(branding?.value, 'gamification'))
const { checkSoon: checkAchievementsSoon } = useAchievements()
/** Best stars across visits, raised as runs in this visit earn more. */
const bestStars = computed(() => Math.max(lesson.value?.best?.stars ?? 0, lastGraded.value?.stars ?? 0))
const hint = shallowRef<SimulationHint | null>(null)
const hintState = ref<'idle' | 'loading' | 'error'>('idle')
const hintError = ref('')
/** Set after a run that didn't meet its objectives, to offer a hint. */
const offerHint = ref(false)

/** Languages the lesson allows that this simulator can run. */
const languages = computed(() => (lesson.value?.languages ?? []).filter((l) => SUPPORTED_LANGUAGES.includes(l)))
const language = ref<ProgramLanguage>('blocks')
/** Each language's program as last edited in this visit, so switching languages and back keeps work. */
const programs = ref<Partial<Record<ProgramLanguage, object>>>({})

let pendingProgram: { language: ProgramLanguage; program: object; code: string } | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
// The latest run's result upload. A hint waits for it, so the hint is about that run.
let recording: Promise<unknown> = Promise.resolve()

async function load() {
  loadState.value = 'loading'
  lesson.value = null
  lastGraded.value = null
  hint.value = null
  offerHint.value = false
  try {
    const loaded = await getSimulationLesson(props.lessonId)
    programs.value = { ...loaded.programs }
    const runnable = loaded.languages.filter((l) => SUPPORTED_LANGUAGES.includes(l))
    language.value = loaded.lastLanguage && runnable.includes(loaded.lastLanguage) ? loaded.lastLanguage : (runnable[0] ?? 'blocks')
    lesson.value = loaded
    loadState.value = 'ready'
  } catch (err) {
    loadState.value = 'error'
    loadError.value = err instanceof ApiError ? err.message : 'This simulation could not be opened.'
  }
}

async function flushSave() {
  clearTimeout(saveTimer)
  const pending = pendingProgram
  if (!pending) return
  pendingProgram = null
  saveState.value = 'saving'
  try {
    await saveSimulationProgram(props.lessonId, pending.language, pending.program, pending.code)
    saveState.value = 'idle'
  } catch {
    saveState.value = 'error'
  }
}

// Saving is debounced: the editor reports every change, and a draft only needs to survive a
// reload, not record each block drag.
function onProgramChange(program: object, code: string) {
  programs.value[language.value] = program
  pendingProgram = { language: language.value, program, code }
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flushSave(), 2000)
}

async function beginRun(mode: RunMode): Promise<string | null> {
  submitError.value = ''
  offerHint.value = false
  return startSimulationRun(props.lessonId, mode, language.value)
}

function onRunEnd(payload: RunEndPayload) {
  recording = record(payload)
}

async function record({ runId, mode, program, generatedCode, result }: RunEndPayload) {
  if (!runId || !program) return
  if (mode === 'graded') submitting.value = true
  try {
    const scored = await submitSimulationRun(runId, {
      program,
      generatedCode,
      outcome: result.outcome,
      objectiveResults: result.summary.objectives.map((o) => ({
        id: o.id,
        everSatisfied: o.everSatisfied,
        firstSatisfiedAtMs: o.firstSatisfiedAtMs,
      })),
      summary: result.summary,
    })
    if (mode === 'graded') {
      lastGraded.value = { score: scored.score, passed: scored.passed, stars: scored.stars }
      emit('graded', { score: scored.score, passed: scored.passed })
      if (scored.passed) checkAchievementsSoon()
    }
    offerHint.value = simHintsAvailable.value && result.outcome !== 'objectives_met' && result.outcome !== 'stopped'
  } catch (err) {
    // Practice runs are recorded for hints only; a failed save there is not worth interrupting.
    if (mode === 'graded') {
      submitError.value = err instanceof ApiError ? err.message : 'Your result could not be saved. Please submit again.'
    }
  } finally {
    submitting.value = false
  }
}

async function getHint() {
  hintState.value = 'loading'
  hintError.value = ''
  offerHint.value = false
  try {
    // Make sure the server has the latest run and program before asking about them.
    await recording
    await flushSave()
    hint.value = await requestSimulationHint(props.lessonId)
    hintState.value = 'idle'
  } catch (err) {
    hintState.value = 'error'
    hintError.value = err instanceof ApiError ? err.message : 'A hint could not be fetched. Please try again.'
  }
}

async function switchLanguage(next: ProgramLanguage) {
  if (next === language.value) return
  await flushSave()
  language.value = next
  hint.value = null
  offerHint.value = false
}

watch(() => props.lessonId, () => {
  void flushSave()
  void load()
}, { immediate: true })

onBeforeUnmount(() => void flushSave())
</script>

<template>
  <div class="mt-6">
    <RaCard v-if="loadState !== 'ready' || !lesson" :padding="28" class="text-center">
      <div class="text-sm font-semibold text-(--fg-1) mb-2">
        {{ loadState === 'error' ? 'This simulation could not be opened' : 'Preparing your simulation…' }}
      </div>
      <p v-if="loadState === 'error'" class="m-0 text-[13px] text-(--fg-3) max-w-120 mx-auto">{{ loadError }}</p>
      <RaButton v-if="loadState === 'error'" variant="secondary" class="mt-3" @click="load">Try again</RaButton>
    </RaCard>

    <RaCard v-else-if="languages.length === 0" :padding="28" class="text-center">
      <div class="text-sm font-semibold text-(--fg-1) mb-2">This lesson isn't available yet</div>
      <p class="m-0 text-[13px] text-(--fg-3) max-w-120 mx-auto">
        It's set up for {{ lesson.languageSetting }}, which the simulator doesn't support yet.
      </p>
    </RaCard>

    <template v-else>
      <div v-if="languages.length > 1" class="mb-3 flex flex-wrap items-center gap-2 text-xs text-(--fg-3)">
        <span>Program in</span>
        <div class="sim-lesson__languages" role="radiogroup" aria-label="Programming language">
          <button
            v-for="option in languages"
            :key="option"
            role="radio"
            :aria-checked="option === language"
            @click="switchLanguage(option)"
          >
            {{ LANGUAGE_LABELS[option] }}
          </button>
        </div>
        <span>Each language keeps its own program.</span>
      </div>

      <SimulationPlayer
        :key="`${lesson.scene.id}:${language}`"
        :scene="lesson.scene.definition"
        :objectives="lesson.scene.objectives"
        :language="language"
        :program="programs[language] ?? null"
        :graded="lesson.scene.objectives.objectives.length > 0"
        :begin-run="beginRun"
        :submit-disabled="submitting"
        height="min(75vh, 680px)"
        @program-change="onProgramChange"
        @run-end="onRunEnd"
      />

      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-(--fg-3)">
        <span v-if="submitting">Saving your result…</span>
        <span v-else-if="lastGraded" :class="lastGraded.passed ? 'text-(--success)' : 'text-(--danger)'">
          Scored {{ lastGraded.score }}% &mdash; {{ lastGraded.passed ? 'passed' : 'not passed yet, try again' }}.
        </span>
        <span v-if="showStars && !submitting && lastGraded?.passed && lastGraded.stars" class="inline-flex items-center gap-1.5">
          <ChallengeStars :stars="lastGraded.stars" :size="14" />
          <template v-if="lastGraded.stars < 3">
            {{ lastGraded.stars === 1 ? 'Meet every objective for another star.' : 'Beat the target for the third star.' }}
          </template>
        </span>
        <span v-else-if="showStars && !lastGraded && bestStars > 0" class="inline-flex items-center gap-1.5">
          <ChallengeStars :stars="bestStars" :size="14" /> best so far
        </span>
        <span v-else-if="lesson.best">
          Best so far: {{ lesson.best.score }}%{{ lesson.best.passed ? ' (passed)' : '' }}.
        </span>
        <span v-if="submitError" class="text-(--danger)">{{ submitError }}</span>
        <span v-if="saveState === 'error'" class="text-(--danger)">Your program couldn't be saved.</span>

        <span v-if="offerHint && hintState !== 'loading'" class="text-(--fg-2)">Not quite. Want a hint?</span>
        <RaButton
          v-if="simHintsAvailable"
          variant="secondary"
          class="ml-auto"
          :disabled="hintState === 'loading'"
          @click="getHint"
        >
          <template #icon>
            <Loader2 v-if="hintState === 'loading'" :size="14" class="animate-spin" />
            <Lightbulb v-else :size="14" />
          </template>
          {{ hint ? 'Another hint' : 'Get a hint' }}
        </RaButton>
      </div>

      <p v-if="hintState === 'error'" class="mt-2 mb-0 text-xs text-(--danger)">{{ hintError }}</p>

      <RaCard v-if="hint" :padding="16" class="mt-3" role="status" aria-live="polite">
        <div class="flex items-center gap-2 text-xs font-semibold text-(--fg-3) uppercase tracking-wide">
          <Lightbulb :size="14" />
          Hint {{ hint.level }} of {{ hint.maxLevel }}
        </div>
        <p class="mt-2 mb-0 text-sm text-(--fg-1) leading-relaxed whitespace-pre-line">{{ hint.hint }}</p>
        <div v-if="hint.relatedLessons.length" class="mt-3 flex flex-wrap items-center gap-2 text-xs text-(--fg-3)">
          <span>Read more:</span>
          <button
            v-for="related in hint.relatedLessons"
            :key="related.lessonId"
            class="border-0 bg-transparent p-0 text-xs text-(--brand-blue) underline cursor-pointer"
            @click="emit('openLesson', related.lessonId)"
          >
            {{ related.title }}
          </button>
        </div>
      </RaCard>
    </template>
  </div>
</template>

<style scoped>
.sim-lesson__languages {
  display: inline-flex;
  border: 1px solid var(--line-2);
  border-radius: var(--ra-md);
  overflow: hidden;
}

.sim-lesson__languages button {
  border: 0;
  padding: 6px 12px;
  background: transparent;
  color: var(--fg-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.sim-lesson__languages button[aria-checked='true'] {
  background: var(--bg-4);
  color: var(--fg-1);
}
</style>
