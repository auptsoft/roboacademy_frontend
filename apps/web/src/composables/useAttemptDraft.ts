import { onBeforeUnmount, onMounted, ref } from 'vue'

const SAVE_DELAY_MS = 1200

/**
 * Saves an attempt's answers as the learner works: a moment after they stop changing, straight
 * away when asked (moving between questions), and one last time as the tab is hidden or closed -
 * with keepalive, so it isn't cut off. The server keeps the latest, so saves never need ordering.
 */
export function useAttemptDraft(save: (options: { keepalive: boolean }) => Promise<unknown>) {
  const status = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false

  function schedule() {
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }

  async function flush(keepalive = false) {
    clearTimeout(timer)
    if (!dirty) return
    dirty = false
    status.value = 'saving'
    try {
      await save({ keepalive })
      status.value = 'saved'
    } catch {
      dirty = true
      status.value = 'error'
    }
  }

  /** Stop saving (the attempt was submitted). */
  function stop() {
    clearTimeout(timer)
    dirty = false
    status.value = 'idle'
  }

  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush(true)
  }
  const onPageHide = () => void flush(true)
  onMounted(() => {
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onPageHide)
    void flush(true)
  })

  return { status, schedule, flush, stop }
}
