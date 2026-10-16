import { readonly, ref } from 'vue'

/**
 * How big a celebration is: `light` for a repeat pass, `standard` for a lesson, `major` for an
 * assessment, `grand` for finishing a course.
 */
export type CelebrationSize = 'light' | 'standard' | 'major' | 'grand'

export interface Celebration {
  id: number
  title: string
  subtitle?: string
  size: CelebrationSize
}

const RANK: Record<CelebrationSize, number> = { light: 0, standard: 1, major: 2, grand: 3 }

const current = ref<Celebration | null>(null)
let nextId = 1

/**
 * Show a celebration through the one <RaCelebration /> mounted in the app shell. A smaller one
 * arriving while a bigger one is still showing is dropped, so a lesson pass that also completes
 * the course doesn't cut the course finale short.
 */
export function celebrate(input: Omit<Celebration, 'id'>) {
  if (current.value && RANK[current.value.size] > RANK[input.size]) return
  current.value = { ...input, id: nextId++ }
  if (celebrationSoundEnabled()) playChime(input.size)
}

export function dismissCelebration() {
  current.value = null
}

export function useCelebration() {
  return { current: readonly(current), celebrate, dismiss: dismissCelebration }
}

// ── Opt-in chime ─────────────────────────────────────────────────────────────
// Off by default: learners are often in a classroom. A per-browser preference, not an account one.

export const CELEBRATION_SOUND_KEY = 'ra.celebrationSound'

export function celebrationSoundEnabled(): boolean {
  try {
    return localStorage.getItem(CELEBRATION_SOUND_KEY) === '1'
  } catch {
    return false
  }
}

export function setCelebrationSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(CELEBRATION_SOUND_KEY, enabled ? '1' : '0')
  } catch {
    // Storage unavailable (private mode etc.) - stays off.
  }
}

let audio: AudioContext | null = null

/** A short rising arpeggio, synthesised so there's no sound file to ship. */
export function playChime(size: CelebrationSize = 'standard') {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    // C5 E5 G5, with a high C on top for the bigger moments.
    const notes = size === 'light' ? [659.25, 783.99] : size === 'standard' ? [523.25, 659.25, 783.99] : [523.25, 659.25, 783.99, 1046.5]
    const start = audio.currentTime + 0.02
    notes.forEach((freq, i) => {
      const at = start + i * 0.09
      const osc = audio!.createOscillator()
      const gain = audio!.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.12, at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
      osc.connect(gain).connect(audio!.destination)
      osc.start(at)
      osc.stop(at + 0.55)
    })
  } catch {
    // No Web Audio, or the browser blocked it - the celebration is still visible.
  }
}
