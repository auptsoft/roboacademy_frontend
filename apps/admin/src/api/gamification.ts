import { apiFetch } from '@/api/client'

// Platform operations of the backend's Gamification module.

export interface BackfillTenantResult {
  tenantId: string
  /** Learners with any history that counts. */
  learners: number
  /** Learners who got XP or badges they didn't already have. */
  newlyRewarded: number
}

/**
 * Writes XP and badges for history that predates gamification: one tenant, or every tenant
 * when `tenantId` is omitted. Safe to rerun; never notifies learners. Runs in the request, so
 * every tenant at once can take a while on a large platform.
 */
export function runGamificationBackfill(tenantId?: string): Promise<{ tenants: BackfillTenantResult[] }> {
  return apiFetch<{ tenants: BackfillTenantResult[] }>('/api/admin/gamification/platform/backfill', {
    method: 'POST',
    body: JSON.stringify({ tenantId: tenantId ?? null }),
  })
}

// A school's own gamification (Phase G2), for its staff.

export type LeaderboardMode = 'Off' | 'Anonymised' | 'Named'

export interface GamificationSettings {
  enabled: boolean
  streaksEnabled: boolean
  weeklyGoal: number
  leaderboardMode: LeaderboardMode
  /** The plan includes leaderboards. */
  leaderboardsIncluded: boolean
  /** The plan includes the school's own badges and manual awards. */
  customBadgesIncluded: boolean
  customBadgeCount: number
  /** The plan's cap on badges the school can make, or null for none. */
  customBadgeLimit: number | null
}

export function getGamificationSettings(): Promise<GamificationSettings> {
  return apiFetch<GamificationSettings>('/api/admin/gamification/settings')
}

export function saveGamificationSettings(settings: {
  enabled: boolean; streaksEnabled: boolean; weeklyGoal: number; leaderboardMode: LeaderboardMode
}): Promise<GamificationSettings> {
  return apiFetch<GamificationSettings>('/api/admin/gamification/settings', { method: 'PUT', body: JSON.stringify(settings) })
}

export type BadgeMetric =
  | 'LessonsCompleted' | 'ChallengesPassed' | 'Stars' | 'AssessmentsPassed' | 'CoursesCompleted'
  | 'LabSessionsAttended' | 'Level' | 'WeekStreak'

export const BADGE_METRICS: { value: BadgeMetric; label: string }[] = [
  { value: 'LessonsCompleted', label: 'Lessons completed' },
  { value: 'ChallengesPassed', label: 'Simulation challenges passed' },
  { value: 'Stars', label: 'Challenge stars' },
  { value: 'AssessmentsPassed', label: 'Assessments passed' },
  { value: 'CoursesCompleted', label: 'Courses completed' },
  { value: 'LabSessionsAttended', label: 'Robot lab sessions attended' },
  { value: 'Level', label: 'Level reached' },
  { value: 'WeekStreak', label: 'Weekly streak (weeks)' },
]

/** The icons a badge can use (the backend's BadgeIcons). */
export const BADGE_ICONS = [
  'award', 'trophy', 'medal', 'star', 'sparkles', 'rocket', 'bot', 'cpu', 'zap', 'target',
  'heart', 'flag', 'lightbulb', 'flame', 'footprints', 'repeat', 'languages', 'hand', 'graduation-cap', 'route',
] as const

export interface CustomBadge {
  id: string
  key: string
  name: string
  description: string
  icon: string
  /** Null for a badge given only by hand. */
  metric: BadgeMetric | null
  threshold: number | null
  isActive: boolean
  /** Learners holding it. */
  earnedCount: number
}

export interface SaveBadgeRequest {
  name: string
  description: string
  icon: string
  metric: BadgeMetric | null
  threshold: number | null
  isActive?: boolean
}

export function listCustomBadges(): Promise<CustomBadge[]> {
  return apiFetch<CustomBadge[]>('/api/admin/gamification/badges')
}

export function createCustomBadge(request: SaveBadgeRequest): Promise<CustomBadge> {
  return apiFetch<CustomBadge>('/api/admin/gamification/badges', { method: 'POST', body: JSON.stringify(request) })
}

export function updateCustomBadge(id: string, request: SaveBadgeRequest): Promise<CustomBadge> {
  return apiFetch<CustomBadge>(`/api/admin/gamification/badges/${id}`, { method: 'PUT', body: JSON.stringify(request) })
}

export interface ClassLearnerAchievements {
  userId: string
  fullName: string
  totalXp: number
  level: number
  /** XP since Monday 00:00 UTC. */
  weekXp: number
  /** Null when the school has streaks off. */
  streak: number | null
  badges: number
}

export function getClassAchievements(classId: string): Promise<ClassLearnerAchievements[]> {
  return apiFetch<ClassLearnerAchievements[]>(`/api/admin/gamification/classes/${classId}/achievements`)
}

/** Gives a learner one of the school's badges and/or 5-50 bonus XP, with a note saying why. */
export function giveAward(userId: string, award: { badgeId: string | null; points: number | null; note: string }): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/admin/gamification/users/${userId}/awards`, { method: 'POST', body: JSON.stringify(award) })
}
