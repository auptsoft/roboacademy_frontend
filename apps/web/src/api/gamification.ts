import { apiFetch, apiFetchPaged, ApiError, type PageMeta } from '@/api/client'

// XP, levels and badges (backend Gamification module). Every endpoint answers 403 when the
// school's plan doesn't include the `gamification` feature, so callers check hasFeature first.

export interface Badge {
  key: string
  name: string
  description: string
  /** An icon name from the badge icon set (see components/gamification/badge-icons.ts). */
  icon: string
  earned: boolean
  earnedAt: string | null
  /** Made by the school rather than built in. */
  custom: boolean
  /** A teacher gave it by hand, with this note. */
  awardedByHand: boolean
  note: string | null
}

export interface GamificationStreak {
  /** Monday of the current week (UTC), as yyyy-mm-dd. */
  weekStart: string
  /** XP-earning activities so far this week; the week counts once it reaches `goal`. */
  thisWeek: number
  goal: number
  /** Weeks in a row the goal was met, including this one once met. */
  streak: number
  longest: number
  /** Missed weeks that won't break the streak (one earned every 4 active weeks, at most 2). */
  freezes: number
}

export interface GamificationSummary {
  totalXp: number
  level: number
  levelTitle: string
  /** Total XP at which the current level starts. */
  levelXp: number
  /** Total XP at which the next level starts. */
  nextLevelXp: number
  stars: number
  challengesPassed: number
  badgesEarned: number
  badgesTotal: number
  /** The latest three badges, newest first. */
  recentBadges: Badge[]
  /** Null when the school has streaks off. */
  streak: GamificationStreak | null
  /** The school shows leaderboards. */
  leaderboardsOn: boolean
  hideFromLeaderboards: boolean
}

export type XpSource =
  | 'LessonCompleted'
  | 'ChallengeStar'
  | 'AssessmentPassed'
  | 'CourseCompleted'
  | 'PathCompleted'
  | 'LabSessionAttended'
  | 'ManualAward'

export interface XpEntry {
  id: string
  source: XpSource
  points: number
  occurredAt: string
  courseId: string | null
  courseTitle: string | null
  lessonId: string | null
  /** For a ChallengeStar entry, the star level it was for (1-3). */
  stars: number | null
}

export function getMyGamificationSummary(): Promise<GamificationSummary> {
  return apiFetch<GamificationSummary>('/api/gamification/me/summary')
}

export function getMyBadges(): Promise<Badge[]> {
  return apiFetch<Badge[]>('/api/gamification/me/badges')
}

export function getMyXpHistory(params: { page?: number; pageSize?: number } = {}): Promise<{ data: XpEntry[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 20))
  return apiFetchPaged<XpEntry>(`/api/gamification/me/xp?${query.toString()}`)
}

/** How far through the current level the learner is, 0-1. */
export function levelProgress(summary: GamificationSummary): number {
  const span = summary.nextLevelXp - summary.levelXp
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (summary.totalXp - summary.levelXp) / span))
}

export function setHideFromLeaderboards(hide: boolean): Promise<void> {
  return apiFetch<void>('/api/gamification/me/preferences', {
    method: 'PUT',
    body: JSON.stringify({ hideFromLeaderboards: hide }),
  })
}

export interface LeaderboardScope {
  id: string
  name: string
}

export interface LeaderboardScopes {
  /** Anonymised or Named: how the school shows other learners. */
  mode: 'Anonymised' | 'Named'
  classes: LeaderboardScope[]
  courses: LeaderboardScope[]
}

export interface LeaderboardRow {
  rank: number
  /** A name, or "Learner 4" when the viewer doesn't get to see who it is. */
  displayName: string
  xp: number
  isMe: boolean
  userId: string | null
}

export interface Leaderboard {
  scope: 'Class' | 'Course'
  scopeId: string
  name: string
  period: 'Week' | 'All'
  mode: string
  top: LeaderboardRow[]
  /** The viewer's own row; null when they have no XP here yet. */
  me: LeaderboardRow | null
  learners: number
}

export type LeaderboardPeriod = 'week' | 'all'

export function getLeaderboardScopes(): Promise<LeaderboardScopes> {
  return apiFetch<LeaderboardScopes>('/api/gamification/leaderboards')
}

export function getLeaderboard(scope: 'class' | 'course', id: string, period: LeaderboardPeriod): Promise<Leaderboard> {
  const kind = scope === 'class' ? 'classes' : 'courses'
  return apiFetch<Leaderboard>(`/api/gamification/leaderboards/${kind}/${id}?period=${period}`)
}

/** The school switched gamification off (as opposed to its plan not including it). */
export function isGamificationDisabled(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'gamification_disabled'
}
