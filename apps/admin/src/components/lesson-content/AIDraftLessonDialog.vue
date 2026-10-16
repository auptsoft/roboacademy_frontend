<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaInteractiveLesson, type LessonBlock } from '@roboacademy/ui'
import { lessonBlockRenderers } from '@roboacademy/sim/lesson'
import { Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import { draftLessonBlocks, type AITier } from '@/api/ai'
import { useAIAvailability } from '@/composables/useAIAvailability'

/**
 * "Draft with AI": turns the lesson's notes (or pasted text, e.g. from a PDF) into blocks. The
 * draft is only previewed here; "Add" puts it into the editor, where the author reviews and
 * saves it like any other edit.
 */
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ lessonId: string; hasNotes: boolean; hasBlocks: boolean }>()
const emit = defineEmits<{ insert: [blocks: LessonBlock[], mode: 'append' | 'replace'] }>()

const availability = useAIAvailability()
const authoring = computed(() => availability.feature('Authoring'))

const source = ref<'notes' | 'pasted'>(props.hasNotes ? 'notes' : 'pasted')
const pasted = ref('')
const drafting = ref(false)
const draft = ref<{ blocks: LessonBlock[]; dropped: number; tier: AITier } | null>(null)

watch(open, (isOpen) => {
  if (isOpen) {
    draft.value = null
    source.value = props.hasNotes ? 'notes' : 'pasted'
  }
})

const canDraft = computed(() => !drafting.value && (source.value === 'notes' ? props.hasNotes : pasted.value.trim().length > 0))

async function run(tier?: AITier) {
  drafting.value = true
  try {
    draft.value = await draftLessonBlocks(props.lessonId, source.value === 'pasted' ? pasted.value : undefined, tier)
    await availability.load()
    if (!draft.value.blocks.length) toast.error('No usable blocks were drafted. Try again.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to draft the lesson.')
  } finally {
    drafting.value = false
  }
}

function insert(mode: 'append' | 'replace') {
  if (!draft.value) return
  if (mode === 'replace' && props.hasBlocks && !confirm('Replace all the blocks in this lesson with the draft?')) return
  emit('insert', draft.value.blocks, mode)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2"><Sparkles :size="16" class="text-(--primary)" /> Draft with AI</DialogTitle>
        <DialogDescription>
          Turns your material into short explanations with a quick question after each idea. It's a draft: check every block before you save.
        </DialogDescription>
      </DialogHeader>

      <template v-if="!draft">
        <div class="flex flex-col gap-2 text-sm text-(--fg-2)">
          <label class="flex items-center gap-2" :class="!hasNotes && 'opacity-50'">
            <input v-model="source" type="radio" value="notes" :disabled="!hasNotes" class="accent-(--brand-blue)">
            From this lesson's notes {{ hasNotes ? '' : '(this lesson has none yet)' }}
          </label>
          <label class="flex items-center gap-2">
            <input v-model="source" type="radio" value="pasted" class="accent-(--brand-blue)">
            From text I paste (for example, copied from a PDF or worksheet)
          </label>
          <textarea
            v-if="source === 'pasted'"
            v-model="pasted"
            rows="8"
            maxlength="50000"
            class="w-full resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-2 text-sm text-(--fg-2) outline-none"
            placeholder="Paste the material to teach…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" @click="open = false">Cancel</Button>
          <Button type="button" :disabled="!canDraft" @click="run()">{{ drafting ? 'Drafting…' : 'Draft lesson' }}</Button>
        </DialogFooter>
      </template>

      <template v-else>
        <p class="m-0 text-[13px] text-(--fg-3)">
          {{ draft.blocks.length }} blocks drafted{{ draft.dropped ? `; ${draft.dropped} unusable ones were left out` : '' }}. Preview:
        </p>
        <div class="max-h-[50vh] overflow-y-auto rounded-(--ra-lg) border border-(--line-1) p-4">
          <RaInteractiveLesson
            v-if="draft.blocks.length"
            :content="{ version: 1, blocks: draft.blocks }"
            :renderers="lessonBlockRenderers"
            reveal-all
          />
        </div>
        <DialogFooter class="flex-wrap gap-2">
          <Button
            v-if="authoring?.canUseEnhanced && draft.tier !== 'Enhanced'"
            variant="ghost"
            type="button"
            :disabled="drafting"
            @click="run('Enhanced')"
          >
            {{ drafting ? 'Drafting…' : 'Try a better version' }}
          </Button>
          <Button variant="outline" type="button" :disabled="drafting" @click="draft = null">Start over</Button>
          <Button v-if="hasBlocks" variant="outline" type="button" :disabled="!draft.blocks.length" @click="insert('replace')">Replace all blocks</Button>
          <Button type="button" :disabled="!draft.blocks.length" @click="insert('append')">{{ hasBlocks ? 'Add to the end' : 'Use this draft' }}</Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
