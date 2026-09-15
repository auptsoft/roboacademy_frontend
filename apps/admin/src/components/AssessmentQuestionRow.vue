<script setup lang="ts">
import { Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import QuestionOptionsEditor from '@/components/QuestionOptionsEditor.vue'
import type { QuestionBankItemSummary } from '@/api/assessment'
import type { QuestionRow } from '@/components/AssessmentFormFields.vue'

const row = defineModel<QuestionRow>({ required: true })
defineProps<{ questionBank: QuestionBankItemSummary[]; removable: boolean }>()
defineEmits<{ remove: [] }>()
</script>

<template>
  <div class="rounded-(--ra-md) border border-(--line-2) p-3">
    <div class="mb-2 flex items-center justify-between">
      <div class="flex gap-3 text-xs">
        <label class="flex items-center gap-1.5">
          <input v-model="row.source" type="radio" value="inline" class="accent-(--brand-blue)"> Inline
        </label>
        <label class="flex items-center gap-1.5">
          <input v-model="row.source" type="radio" value="bank" class="accent-(--brand-blue)"> From Question Bank
        </label>
      </div>
      <Button
        v-if="removable"
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Remove question"
        @click="$emit('remove')"
      >
        <Trash2 :size="14" />
      </Button>
    </div>

    <template v-if="row.source === 'bank'">
      <select
        v-model="row.bankItemId"
        required
        class="h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
      >
        <option value="" disabled>Select a question</option>
        <option v-for="qb in questionBank" :key="qb.id" :value="qb.id">{{ qb.text }}</option>
      </select>
    </template>
    <template v-else>
      <textarea
        v-model="row.text"
        rows="2"
        placeholder="Question text"
        required
        class="mb-2 w-full resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-sans text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)"
      />
      <QuestionOptionsEditor
        :options="row.options"
        :correct-option-index="row.correctOptionIndex"
        @update:options="(v) => (row.options = v)"
        @update:correct-option-index="(v) => (row.correctOptionIndex = v)"
      />
    </template>
  </div>
</template>
