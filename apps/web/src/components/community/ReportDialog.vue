<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2, X } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { reportContent, REPORT_REASONS, type ReportReason } from '@/api/community'
import { reportMessage } from '@/api/community-chat'

// Tell staff about a post, reply or chat message. The reporter's name goes to staff only, never to
// the author.

const props = defineProps<{ contentType: 'Post' | 'Reply' | 'Message'; contentId: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ reported: [message: string] }>()

const reason = ref<ReportReason>('Unkind')
const note = ref('')
const sending = ref(false)
const error = ref('')

watch(open, (value) => {
  if (value) {
    reason.value = 'Unkind'
    note.value = ''
    error.value = ''
  }
})

async function send() {
  sending.value = true
  error.value = ''
  try {
    const text = note.value.trim() || null
    await (props.contentType === 'Message'
      ? reportMessage(props.contentId, reason.value, text)
      : reportContent(props.contentType, props.contentId, reason.value, text))
    open.value = false
    emit('reported', 'Thanks for telling us. Staff will take a look.')
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't send the report."
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="open = false">
    <div role="dialog" aria-modal="true" aria-labelledby="report-title" class="w-full max-w-[420px] rounded-(--ra-xl) bg-(--bg-0) p-6 shadow-xl flex flex-col gap-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 id="report-title" class="m-0 text-lg font-semibold text-(--heading)">Report this {{ contentType === 'Post' ? 'post' : contentType === 'Reply' ? 'reply' : 'message' }}</h2>
          <p class="m-0 mt-1 text-[13px] text-(--fg-3)">Staff will see your report. The person who wrote it won't know it was you.</p>
        </div>
        <button type="button" class="border-0 bg-transparent p-1 text-(--fg-3) hover:text-(--fg-1) cursor-pointer" aria-label="Close" @click="open = false">
          <X :size="18" />
        </button>
      </div>

      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend class="mb-2 text-[13px] font-semibold text-(--fg-2)">What's wrong?</legend>
        <label v-for="option in REPORT_REASONS" :key="option.value" class="flex items-center gap-2.5 text-sm text-(--fg-1) cursor-pointer">
          <input v-model="reason" type="radio" name="report-reason" :value="option.value" class="accent-(--brand-blue)" />
          {{ option.label }}
        </label>
      </fieldset>

      <label class="flex flex-col gap-1.5 text-[13px] font-semibold text-(--fg-2)">
        Anything else staff should know? <span class="font-normal text-(--fg-3)">(optional)</span>
        <textarea
          v-model="note"
          rows="3"
          maxlength="500"
          class="resize-y rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-3 py-2 text-sm font-normal text-(--fg-1) outline-none focus:border-(--brand-blue)"
        />
      </label>

      <p v-if="error" class="m-0 text-[13px] text-(--danger)">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <RaButton variant="ghost" @click="open = false">Cancel</RaButton>
        <RaButton :disabled="sending" @click="send">
          <template v-if="sending" #icon><Loader2 :size="16" class="animate-spin" /></template>
          Send report
        </RaButton>
      </div>
    </div>
  </div>
</template>
