import { ref } from 'vue'
import { getMyGamificationSummary, type GamificationSummary } from '@/api/gamification'

export interface AchievementToast {
  id: number
  kind: 'badge' | 'level'
  title: string
  body: string
  icon: string
}

// Shared across the app: the dashboard card, the achievements page and the toasts read the same
// summary, and a new badge or level is announced once however many places refresh it.
const summary = ref<GamificationSummary | null>(null)
const toasts = ref<AchievementToast[]>([])
let seen: { level: number; badges: Set<string> } | null = null
let nextId = 1
// Set by the app layout from the school's plan, so pages can call checkSoon() unconditionally.
let enabled = false

function announce(next: GamificationSummary) {
  if (!seen) return
  if (next.level > seen.level) {
    toasts.value.push({
      id: nextId++, kind: 'level', icon: 'level',
      title: `Level ${next.level} reached`, body: `You're now a ${next.levelTitle}.`,
    })
  }
  for (const badge of next.recentBadges) {
    if (!seen.badges.has(badge.key)) {
      toasts.value.push({ id: nextId++, kind: 'badge', icon: badge.icon, title: `Badge earned: ${badge.name}`, body: badge.description })
    }
  }
}

/** Reloads the summary, announcing anything new since the last load. Null when unavailable. */
async function refresh(): Promise<GamificationSummary | null> {
  try {
    const next = await getMyGamificationSummary()
    announce(next)
    seen = { level: next.level, badges: new Set([...(seen?.badges ?? []), ...next.recentBadges.map((b) => b.key)]) }
    summary.value = next
    return next
  } catch {
    // Not on the plan (403), or offline: the rest of the page works without it.
    return null
  }
}

let pending: ReturnType<typeof setTimeout>[] = []

/**
 * Checks for new XP after something that earns it (a completed lesson, a graded run). Rewards are
 * worked out in the background a moment after, so this looks again shortly and once more later.
 */
function checkSoon() {
  if (!enabled) return
  pending.forEach(clearTimeout)
  pending = [2500, 8000].map((ms) => setTimeout(() => void refresh(), ms))
}

/** Called once branding loads. Loading the summary here sets the baseline toasts compare against. */
function setEnabled(on: boolean) {
  enabled = on
  if (on && !seen) void refresh()
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function useAchievements() {
  return { summary, toasts, refresh, checkSoon, setEnabled, dismiss }
}
