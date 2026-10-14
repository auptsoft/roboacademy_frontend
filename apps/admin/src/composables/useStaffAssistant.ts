import { ref } from 'vue'

// One staff assistant for the whole admin app: the launcher shows it, and any page (a help guide)
// can open it, optionally with a question ready to send.
const open = ref(false)
const pendingQuestion = ref<string | null>(null)

export function useStaffAssistant() {
  function openAssistant(question?: string) {
    pendingQuestion.value = question ?? null
    open.value = true
  }

  function takePendingQuestion(): string | null {
    const question = pendingQuestion.value
    pendingQuestion.value = null
    return question
  }

  return { open, openAssistant, takePendingQuestion }
}
