<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaChip } from '@roboacademy/ui'
import { ChevronDown, Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { ApiError } from '@/api/client'
import {
  getFeedbackDraft,
  markFeedbackDraftUsed,
  regenerateFeedbackDraft,
  type AIFeedbackDraft,
  type AITier,
} from '@/api/ai'
import { useAIAvailability } from '@/composables/useAIAvailability'

// The AI-suggested verdict and feedback for one Written attempt, shown above the grade form.
// "Use draft" only fills the form - the teacher still reviews, edits and saves the grade.
// Renders nothing when AI isn't available to the school and no draft exists.

const props = defineProps<{ attemptId: string }>()
const emit = defineEmits<{ use: [draft: { passed: boolean; score: number | null; feedback: string }] }>()

const availability = useAIAvailability()
const draftsFeature = computed(() => availability.feature('FeedbackDrafts'))

const draft = ref<AIFeedbackDraft | null>(null)
const loading = ref(true)
const working = ref(false)
const whyOpen = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | undefined
let polls = 0

async function load() {
  clearTimeout(pollTimer)
  try {
    draft.value = await getFeedbackDraft(props.attemptId)
  } catch (error) {
    if (!(error instanceof ApiError && (error.status === 404 || error.status === 403))) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load the AI draft.')
    }
    draft.value = null
  } finally {
    loading.value = false
  }

  // Drafts are written in the background right after submission; check back briefly.
  if (draft.value?.status === 'Pending' && polls < 10) {
    polls += 1
    pollTimer = setTimeout(load, 3000)
  }
}

onMounted(load)
onBeforeUnmount(() => clearTimeout(pollTimer))
watch(() => props.attemptId, () => {
  polls = 0
  loading.value = true
  void load()
})

async function regenerate(tier?: AITier) {
  working.value = true
  try {
    draft.value = await regenerateFeedbackDraft(props.attemptId, tier)
    whyOpen.value = false
    await availability.load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to draft feedback.')
  } finally {
    working.value = false
  }
}

async function useDraft() {
  if (!draft.value || draft.value.status !== 'Ready') return
  emit('use', {
    passed: draft.value.suggestedPassed ?? false,
    score: draft.value.suggestedScore,
    feedback: draft.value.feedback ?? '',
  })
  try {
    draft.value = await markFeedbackDraftUsed(props.attemptId)
  } catch {
    // Recording use is a quality signal only; the form is already filled.
  }
}

const canDraft = computed(() => draftsFeature.value?.available ?? false)
const canUseEnhanced = computed(() => draftsFeature.value?.canUseEnhanced ?? false)
const visible = computed(() => !loading.value && (draft.value !== null || canDraft.value))
const stuck = computed(() => draft.value?.status === 'Pending' && polls >= 10)
</script>

<template>
  <div v-if="visible" class="flex flex-col gap-2.5 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) p-3.5">
    <div class="flex items-center justify-between gap-2">
      <span class="flex items-center gap-1.5 text-sm font-semibold text-(--fg-1)">
        <Sparkles :size="14" class="text-(--primary)" />
        AI suggestion
        <RaChip v-if="draft?.status === 'Ready' && draft.tier === 'Enhanced'" tone="info">Enhanced</RaChip>
      </span>
      <span class="text-xs text-(--fg-4)">AI-generated draft. Check before grading.</span>
    </div>

    <!-- Ready -->
    <template v-if="draft?.status === 'Ready'">
      <div class="flex items-center gap-3 text-sm">
        <RaChip :tone="draft.suggestedPassed ? 'info' : 'neutral'">{{ draft.suggestedPassed ? 'Pass' : 'Fail' }}</RaChip>
        <span v-if="draft.suggestedScore !== null" class="text-(--fg-2)">Score {{ draft.suggestedScore }}</span>
      </div>
      <p class="m-0 text-sm text-(--fg-1) whitespace-pre-wrap">{{ draft.feedback }}</p>
      <Collapsible v-if="draft.rationale" v-model:open="whyOpen">
        <CollapsibleTrigger class="flex items-center gap-1 bg-transparent p-0 text-xs font-semibold text-(--fg-3)">
          Why
          <ChevronDown :size="12" class="transition-transform" :class="whyOpen && 'rotate-180'" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p class="m-0 mt-1.5 text-xs text-(--fg-2) whitespace-pre-wrap">{{ draft.rationale }}</p>
        </CollapsibleContent>
      </Collapsible>
      <div class="flex flex-wrap gap-2">
        <Button type="button" size="sm" :disabled="working" @click="useDraft">Use draft</Button>
        <Button v-if="canDraft" type="button" size="sm" variant="outline" :disabled="working" @click="regenerate()">
          {{ working ? 'Drafting…' : 'Regenerate' }}
        </Button>
        <Button
          v-if="canUseEnhanced && draft.tier !== 'Enhanced'"
          type="button"
          size="sm"
          variant="ghost"
          :disabled="working"
          @click="regenerate('Enhanced')"
        >
          Try a better draft
        </Button>
      </div>
    </template>

    <!-- Pending -->
    <p v-else-if="draft?.status === 'Pending' && !stuck" class="m-0 text-sm text-(--fg-3)">Drafting…</p>

    <!-- Failed, stuck, skipped or none yet -->
    <div v-else-if="canDraft" class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-sm text-(--fg-3)">
        {{ draft?.status === 'Failed' || stuck ? "Couldn't draft feedback." : 'No AI draft yet.' }}
      </span>
      <Button type="button" size="sm" variant="outline" :disabled="working" @click="regenerate()">
        {{ working ? 'Drafting…' : draft?.status === 'Failed' || stuck ? 'Try again' : 'Draft with AI' }}
      </Button>
    </div>
  </div>
</template>
