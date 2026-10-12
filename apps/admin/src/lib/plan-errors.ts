// Plan-entitlement errors from the API (see the backend's EntitlementExceptionHandler): a hard
// limit reached (409, code limit_exceeded) or a feature outside the tenant's plan (403, code
// feature_unavailable). ApiError rewrites their message with these, so every existing
// `toast.error(error.message)` call site shows something a school admin can act on.

export interface LimitExceededDetails {
  code: 'limit_exceeded'
  key: string
  limit: number
  current: number
  requested: number
}

export interface FeatureUnavailableDetails {
  code: 'feature_unavailable'
  feature: string
}

export type PlanErrorDetails = LimitExceededDetails | FeatureUnavailableDetails

const LIMIT_NOUNS: Record<string, [singular: string, plural: string]> = {
  max_students: ['student', 'students'],
  max_staff: ['staff account', 'staff accounts'],
  max_courses: ['course', 'courses'],
  max_classes: ['class', 'classes'],
}

export const FEATURE_LABELS: Record<string, string> = {
  robotics_lab: 'Robotics lab',
  live_classes: 'Live classes',
  certificates: 'Certificates',
  learning_paths: 'Learning paths',
  course_library: 'Course library',
  custom_domains: 'Custom domains',
  custom_branding: 'Custom branding',
  events: 'Events',
  announcements: 'Announcements',
}

export function limitNoun(key: string, count: number): string {
  const [singular, plural] = LIMIT_NOUNS[key] ?? ['item', 'items']
  return count === 1 ? singular : plural
}

export function isPlanErrorDetails(data: unknown): data is PlanErrorDetails {
  if (!data || typeof data !== 'object' || !('code' in data)) return false
  const code = (data as { code: unknown }).code
  return code === 'limit_exceeded' || code === 'feature_unavailable'
}

export function describePlanError(details: PlanErrorDetails): string {
  if (details.code === 'feature_unavailable') {
    const label = FEATURE_LABELS[details.feature] ?? 'This feature'
    return `${label} isn't included in your school's plan. Contact RoboAcademy to add it.`
  }

  const { key, limit, current, requested } = details
  const allowance = `Your plan allows ${limit.toLocaleString()} ${limitNoun(key, limit)} and you have ${current.toLocaleString()}.`
  const attempt = requested > 1 ? `This would add ${requested.toLocaleString()} more. ` : ''
  return `${attempt}${allowance} Free up space or contact RoboAcademy to upgrade.`
}
