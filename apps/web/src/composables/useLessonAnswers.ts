import { ref } from 'vue'
import type { BlockResult } from '@roboacademy/ui'
import { listMyBlockResponses } from '@/api/learning'
import { getCurrentUser } from '@/store/auth'
import { enqueue, flushOutbox } from '@/lib/offline-sync'
import { kvGet, kvSet, outboxList } from '@/lib/offline-store'

type Answers = Record<string, BlockResult>

/**
 * A learner's answers to an Interactive lesson's checks: loads them to restore a lesson left
 * part-way, and records each one as it resolves. Answers go through the device's outbox
 * (lib/offline-sync), so one given offline is sent when the connection returns - even if the tab
 * was closed. A copy is kept on the device, so the lesson also restores without a connection.
 */
export function useLessonAnswers() {
  /** Null while loading. */
  const restored = ref<Answers | null>(null)
  let loadToken = 0

  const cacheKey = (lessonId: string) => `answers:${lessonId}`

  async function load(courseId: string, lessonId: string) {
    const token = ++loadToken
    restored.value = null
    const userId = getCurrentUser()?.userId
    let answers: Answers = {}
    try {
      const responses = await listMyBlockResponses(courseId, lessonId)
      answers = Object.fromEntries(responses.map(r => [
        r.blockId,
        { correct: r.correct && !r.revealedAnswer, attempts: r.attempts, answer: r.answer } satisfies BlockResult,
      ]))
      if (userId) void kvSet(userId, cacheKey(lessonId), answers)
    } catch {
      // Offline (or the server's unreachable): the device's copy, if there is one.
      answers = (userId && await kvGet<Answers>(userId, cacheKey(lessonId))) || {}
    }

    // Answers still waiting in the outbox are newer than anything the server has.
    if (userId) {
      for (const entry of await outboxList(userId)) {
        if (entry.kind !== 'answer' || entry.lessonId !== lessonId) continue
        const p = entry.payload as { blockId: string; correct: boolean; attempts: number; answer: BlockResult['answer'] }
        answers[p.blockId] = { correct: p.correct, attempts: p.attempts, answer: p.answer }
      }
    }
    if (token === loadToken) restored.value = answers
  }

  async function record(courseId: string, lessonId: string, blockId: string, result: BlockResult) {
    const userId = getCurrentUser()?.userId
    if (userId) {
      const cached = (await kvGet<Answers>(userId, cacheKey(lessonId))) ?? {}
      void kvSet(userId, cacheKey(lessonId), { ...cached, [blockId]: result })
    }
    await enqueue({
      kind: 'answer',
      courseId,
      lessonId,
      payload: {
        blockId,
        correct: result.correct,
        attempts: result.attempts,
        revealedAnswer: !result.correct,
        answer: result.answer ?? null,
      },
    })
  }

  /** Tries to send everything queued. True when nothing is left waiting. */
  function flush(): Promise<boolean> {
    return flushOutbox()
  }

  return { restored, load, record, flush }
}
