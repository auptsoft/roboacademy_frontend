import { ref } from 'vue'

// One app assistant for the whole learner app: the launcher shows it, and any page (a help article,
// the sidebar card) can open it, optionally with a question ready to send.
const open = ref(false)
const pendingQuestion = ref<string | null>(null)

export function useAssistant() {
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
