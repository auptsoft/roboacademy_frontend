<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ArrowRight, Lock } from 'lucide-vue-next'
import { RaButton, RaQuizQuestion, isQuizResponseComplete, type QuizResponse } from '@roboacademy/ui'
import type { AssessmentQuestion } from '@/api/assessment'

/**
 * A quiz attempt's questions, in either layout. All on one page is the original form. One at a
 * time shows "Question 3 of 10" with Next/Back, a numbered navigator, and a review screen at the
 * end (index = questions.length) listing anything unanswered. Without back navigation there's no
 * Back or navigator, and answers before the furthest question reached are shown locked - the
 * server enforces that too. The parent saves the answers and position (`navigate`).
 */
const props = defineProps<{
  questions: AssessmentQuestion[]
  display: 'AllOnOnePage' | 'OneAtATime'
  allowBack: boolean
  disabled?: boolean
}>()
const answers = defineModel<QuizResponse[]>('answers', { required: true })
const current = defineModel<number>('current', { required: true })
const furthest = defineModel<number>('furthest', { required: true })
const emit = defineEmits<{ navigate: [] }>()

const oneAtATime = computed(() => props.display === 'OneAtATime')
const onReview = computed(() => current.value >= props.questions.length)
const question = computed(() => props.questions[current.value])

function answered(index: number): boolean {
  const q = props.questions[index]
  return !!q && isQuizResponseComplete(q.kind ?? 'choice', q.definition, answers.value[index] ?? null)
}

const unanswered = computed(() => props.questions.map((_, i) => i).filter(i => !answered(i)))

function go(index: number) {
  if (!props.allowBack && index < furthest.value) return
  current.value = Math.max(0, Math.min(index, props.questions.length))
  furthest.value = Math.max(furthest.value, current.value)
  emit('navigate')
}

function locked(index: number): boolean {
  return oneAtATime.value && !props.allowBack && index < furthest.value
}
</script>

<template>
  <!-- All on one page -->
  <div v-if="!oneAtATime" class="flex flex-col gap-5">
    <div v-for="(q, i) in questions" :key="q.id">
      <template v-if="q.kind && q.kind !== 'choice' && q.definition">
        <div class="mb-2 text-xs font-semibold text-(--fg-3)">Question {{ i + 1 }}</div>
        <RaQuizQuestion v-model="answers[i]!" :kind="q.kind" :definition="q.definition" :disabled="disabled" />
      </template>
      <template v-else>
        <div class="mb-2 text-sm font-semibold text-(--fg-1)">{{ i + 1 }}. {{ q.text }}</div>
        <div class="flex flex-col gap-1.5">
          <label v-for="(opt, oi) in q.options" :key="oi" class="flex cursor-pointer items-center gap-2 text-[13px] text-(--fg-2)">
            <input type="radio" :name="'q-' + q.id" :disabled="disabled" :checked="answers[i] === oi" @change="answers[i] = oi" />
            {{ opt }}
          </label>
        </div>
      </template>
    </div>
  </div>

  <!-- One at a time -->
  <div v-else class="flex flex-col gap-4">
    <nav v-if="allowBack" class="flex flex-wrap gap-1.5" aria-label="Questions">
      <button
        v-for="(q, i) in questions"
        :key="q.id"
        type="button"
        :disabled="disabled"
        :aria-current="i === current ? 'step' : undefined"
        :aria-label="`Question ${i + 1}${answered(i) ? ', answered' : ', not answered'}`"
        class="flex size-8 cursor-pointer items-center justify-center rounded-full border text-xs font-semibold"
        :class="i === current ? 'border-(--brand-blue) bg-(--brand-blue) text-white'
          : answered(i) ? 'border-(--brand-blue) bg-[rgba(59,130,246,0.08)] text-(--fg-1)'
          : 'border-(--line-2) bg-(--bg-2) text-(--fg-3)'"
        @click="go(i)"
      >
        {{ i + 1 }}
      </button>
      <button
        type="button"
        :disabled="disabled"
        :aria-current="onReview ? 'step' : undefined"
        class="h-8 cursor-pointer rounded-full border px-3 text-xs font-semibold"
        :class="onReview ? 'border-(--brand-blue) bg-(--brand-blue) text-white' : 'border-(--line-2) bg-(--bg-2) text-(--fg-3)'"
        @click="go(questions.length)"
      >
        Review
      </button>
    </nav>

    <template v-if="!onReview && question">
      <div class="flex items-center gap-2 text-xs font-semibold text-(--fg-3)">
        Question {{ current + 1 }} of {{ questions.length }}
        <span v-if="!allowBack" class="inline-flex items-center gap-1 font-normal"><Lock :size="11" /> You can't go back once you move on</span>
      </div>
      <div :key="question.id">
        <RaQuizQuestion
          v-if="question.kind && question.kind !== 'choice' && question.definition"
          v-model="answers[current]!"
          :kind="question.kind"
          :definition="question.definition"
          :disabled="disabled || locked(current)"
        />
        <template v-else>
          <div class="mb-2 text-sm font-semibold text-(--fg-1)">{{ question.text }}</div>
          <div class="flex flex-col gap-1.5">
            <label v-for="(opt, oi) in question.options" :key="oi" class="flex cursor-pointer items-center gap-2 text-[13px] text-(--fg-2)">
              <input type="radio" :name="'q-' + question.id" :disabled="disabled || locked(current)" :checked="answers[current] === oi" @change="answers[current] = oi" />
              {{ opt }}
            </label>
          </div>
        </template>
      </div>
      <div class="flex items-center gap-2">
        <RaButton v-if="allowBack && current > 0" variant="ghost" :disabled="disabled" @click="go(current - 1)">
          <template #icon><ArrowLeft :size="14" /></template>
          Back
        </RaButton>
        <RaButton variant="secondary" class="ml-auto" :disabled="disabled" @click="go(current + 1)">
          {{ current === questions.length - 1 ? 'Review answers' : 'Next' }}
          <template #icon-right><ArrowRight :size="14" /></template>
        </RaButton>
      </div>
    </template>

    <template v-else>
      <div class="text-sm font-semibold text-(--fg-1)">Review your answers</div>
      <p v-if="!unanswered.length" class="m-0 text-[13px] text-(--fg-2)">You've answered every question. Submit when you're ready.</p>
      <template v-else>
        <p class="m-0 text-[13px] text-(--fg-2)">
          {{ unanswered.length === 1 ? '1 question isn\'t' : `${unanswered.length} questions aren't` }} answered yet{{ allowBack ? ':' : '.' }}
        </p>
        <div v-if="allowBack" class="flex flex-wrap gap-1.5">
          <RaButton v-for="i in unanswered" :key="i" variant="ghost" :disabled="disabled" @click="go(i)">Question {{ i + 1 }}</RaButton>
        </div>
      </template>
    </template>
  </div>
</template>
