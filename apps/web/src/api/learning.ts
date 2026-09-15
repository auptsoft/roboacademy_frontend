import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export interface CourseCatalogItem {
  id: string
  title: string
  description: string | null
  level: 'Beginner' | 'Intermediate' | 'Advanced' | null
  category: string | null
  state: 'Draft' | 'Published' | 'Retired'
  thumbnailUrl: string | null
  lessonCount: number
}

export interface LearningPathItem {
  id: string
  title: string
  description: string | null
  state: 'Draft' | 'Published'
  thumbnailUrl: string | null
  courseCount: number
}

export interface LearningPathStep {
  courseId: string
  courseTitle: string
  order: number
}

export interface LearningPathDetail {
  id: string
  title: string
  description: string | null
  longDescription: string | null
  state: 'Draft' | 'Published'
  thumbnailUrl: string | null
  introVideoReference: string | null
  steps: LearningPathStep[]
}

export interface CatalogListParams {
  search?: string
  page?: number
  pageSize?: number
}

function buildQuery(params: CatalogListParams): string {
  const query = new URLSearchParams()
  if (params.search?.trim()) query.set('search', params.search.trim())
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 24))
  return query.toString()
}

export function listCourseCatalog(params: CatalogListParams = {}): Promise<{ data: CourseCatalogItem[]; meta: PageMeta }> {
  return apiFetchPaged<CourseCatalogItem>(`/api/learning/courses?${buildQuery(params)}`)
}

export function listLearningPaths(params: CatalogListParams = {}): Promise<{ data: LearningPathItem[]; meta: PageMeta }> {
  return apiFetchPaged<LearningPathItem>(`/api/learning/paths?${buildQuery(params)}`)
}

export function getLearningPath(pathId: string): Promise<LearningPathDetail> {
  return apiFetch<LearningPathDetail>(`/api/learning/paths/${pathId}`)
}

export function getSuggestedLearningPaths(params: CatalogListParams = {}): Promise<{ data: LearningPathItem[]; meta: PageMeta }> {
  return apiFetchPaged<LearningPathItem>(`/api/learning/paths/suggested/me?${buildQuery(params)}`)
}

export interface PathStartResult {
  pathEnrolmentId: string
  pathId: string
  userId: string
  coursesEnrolled: number
  coursesAlreadyEnrolled: number
}

export function startLearningPath(pathId: string): Promise<PathStartResult> {
  return apiFetch<PathStartResult>(`/api/learning/paths/${pathId}/start`, { method: 'POST' })
}

export interface PathWithdrawResult {
  pathEnrolmentId: string
  status: string
}

export function withdrawPathEnrolment(pathEnrolmentId: string): Promise<PathWithdrawResult> {
  return apiFetch<PathWithdrawResult>(`/api/learning/paths/enrolments/${pathEnrolmentId}/withdraw`, { method: 'POST' })
}

export interface PathEnrolmentDto {
  id: string
  learningPathId: string
  userId: string
  status: string
  enrolledAt: string
}

export function getMyPathEnrolments(params: { page?: number; pageSize?: number } = {}): Promise<{ data: PathEnrolmentDto[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 50))
  return apiFetchPaged<PathEnrolmentDto>(`/api/learning/paths/enrolments/me?${query.toString()}`)
}

export interface PathStepProgress {
  courseId: string
  courseTitle: string
  order: number
  status: 'Locked' | 'Unlocked' | 'InProgress' | 'Completed'
}

export interface PathProgress {
  pathId: string
  steps: PathStepProgress[]
}

export function getPathProgress(pathId: string): Promise<PathProgress> {
  return apiFetch<PathProgress>(`/api/learning/paths/${pathId}/progress/me`)
}

export interface EnrolledPathSummary {
  pathEnrolmentId: string
  pathId: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  courseCount: number
  completedCourses: number
  progressPercent: number
  enrolledAt: string
}

// enrolments/me only returns pathId/status — join against getLearningPath + progress/me per
// enrolment since there's no combined backend endpoint for this yet (same shape as
// getMyEnrolledCourses above).
export async function getMyEnrolledPaths(): Promise<EnrolledPathSummary[]> {
  const { data: enrolments } = await getMyPathEnrolments()
  const active = enrolments.filter(e => e.status !== 'Withdrawn')
  return Promise.all(
    active.map(async (enrolment) => {
      const [path, progress] = await Promise.all([
        getLearningPath(enrolment.learningPathId),
        getPathProgress(enrolment.learningPathId),
      ])
      const completedCourses = progress.steps.filter(s => s.status === 'Completed').length
      const courseCount = path.steps.length
      return {
        pathEnrolmentId: enrolment.id,
        pathId: path.id,
        title: path.title,
        description: path.description,
        thumbnailUrl: path.thumbnailUrl,
        courseCount,
        completedCourses,
        progressPercent: courseCount > 0 ? Math.round((completedCourses / courseCount) * 100) : 0,
        enrolledAt: enrolment.enrolledAt,
      }
    }),
  )
}

export interface EnrolmentResult {
  enrolmentId: string
  courseId: string
  userId: string
}

export function enrolInCourse(courseId: string): Promise<EnrolmentResult> {
  return apiFetch<EnrolmentResult>(`/api/learning/courses/${courseId}/enrolments`, { method: 'POST' })
}

export interface WithdrawEnrolmentResult {
  enrolmentId: string
  status: string
}

export function withdrawEnrolment(enrolmentId: string): Promise<WithdrawEnrolmentResult> {
  return apiFetch<WithdrawEnrolmentResult>(`/api/learning/enrolments/${enrolmentId}/withdraw`, { method: 'POST' })
}

export interface CourseLessonDetail {
  id: string
  title: string
  type: 'Video' | 'Reading' | 'Interactive' | 'Simulation' | 'Pdf'
  order: number
  isRequired: boolean
  allowUnenrolled: boolean
  // Not rendered by course-details.vue: contentReference needs signed-URL/content-delivery
  // infra that doesn't exist yet, and context is raw HTML/Markdown lesson body.
  contentReference: string | null
  context: string | null
}

export interface CourseModuleDetail {
  id: string
  title: string
  description: string | null
  order: number
  lessons: CourseLessonDetail[]
}

export interface CourseDetail {
  id: string
  title: string
  description: string | null
  longDescription: string | null
  level: 'Beginner' | 'Intermediate' | 'Advanced' | null
  category: string | null
  extraProperties: Record<string, unknown>
  state: 'Draft' | 'Published' | 'Retired'
  thumbnailUrl: string | null
  introVideoReference: string | null
  modules: CourseModuleDetail[]
}

export function getCourse(courseId: string): Promise<CourseDetail> {
  return apiFetch<CourseDetail>(`/api/learning/courses/${courseId}`)
}

export interface VideoPlaybackUrl {
  url: string
  expiresAt: string
}

// Presigned, short-lived (60 min) — fetch fresh right before playback, never cache/reuse.
export function getCourseIntroVideoUrl(courseId: string): Promise<VideoPlaybackUrl> {
  return apiFetch<VideoPlaybackUrl>(`/api/learning/courses/${courseId}/intro-video-url`)
}

// Presigned, short-lived (60 min) — fetch fresh right before playback, never cache/reuse.
export function getLearningPathIntroVideoUrl(pathId: string): Promise<VideoPlaybackUrl> {
  return apiFetch<VideoPlaybackUrl>(`/api/learning/paths/${pathId}/intro-video-url`)
}

// Presigned, short-lived (60 min) — fetch fresh right before playback, never cache/reuse.
export function getLessonPlaybackUrl(courseId: string, moduleId: string, lessonId: string): Promise<VideoPlaybackUrl> {
  return apiFetch<VideoPlaybackUrl>(`/api/learning/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/playback-url`)
}

export interface EnrolmentDto {
  id: string
  courseId: string
  userId: string
  status: string
  enrolledAt: string
}

export function getMyEnrolments(params: { page?: number; pageSize?: number } = {}): Promise<{ data: EnrolmentDto[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 50))
  return apiFetchPaged<EnrolmentDto>(`/api/learning/enrolments/me?${query.toString()}`)
}

export interface CourseResumePoint {
  courseId: string
  nextLessonId: string | null
  completedLessons: number
  totalLessons: number
  courseCompleted: boolean
  completedAssessments: number
  totalAssessments: number
}

export function getCourseResumePoint(courseId: string): Promise<CourseResumePoint> {
  return apiFetch<CourseResumePoint>(`/api/learning/courses/${courseId}/progress/me`)
}

// Lessons and required assessments both count toward the progress bar - see resume.completed*/
// total* fields. courseCompleted itself stays lesson-only (see backend GetResumePoint remarks),
// so a course can show 100% here while courseCompleted still reflects only lesson completion.
export function combinedProgressPercent(resume: CourseResumePoint): number {
  const completed = resume.completedLessons + resume.completedAssessments
  const total = resume.totalLessons + resume.totalAssessments
  if (total <= 0) return resume.courseCompleted ? 100 : 0
  return Math.round((completed / total) * 100)
}

export interface RecordProgressResult {
  courseId: string
  completedLessons: number
  totalLessons: number
  courseCompleted: boolean
}

// Idempotent per lesson and batch-friendly — pass just the newly completed lesson id(s), no
// need to resend the full completion history.
export function recordLessonProgress(courseId: string, completedLessonIds: string[]): Promise<RecordProgressResult> {
  return apiFetch<RecordProgressResult>('/api/learning/progress', {
    method: 'POST',
    body: JSON.stringify({ courseId, completedLessonIds }),
  })
}

export interface EnrolledCourseSummary {
  enrolmentId: string
  courseId: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  progressPercent: number
  completedLessons: number
  totalLessons: number
  completedAssessments: number
  totalAssessments: number
  courseCompleted: boolean
  enrolledAt: string
  nextLessonId: string | null
  nextLessonTitle: string | null
  nextModuleTitle: string | null
}

// enrolments/me only returns courseId/status — join against getCourse + progress/me per
// enrolment since there's no combined backend endpoint for this yet.
export async function getMyEnrolledCourses(): Promise<EnrolledCourseSummary[]> {
  const { data: enrolments } = await getMyEnrolments()
  return Promise.all(
    enrolments.map(async (enrolment) => {
      const [course, resume] = await Promise.all([
        getCourse(enrolment.courseId),
        getCourseResumePoint(enrolment.courseId),
      ])
      const nextLesson = resume.nextLessonId
        ? course.modules.flatMap(m => m.lessons.map(l => ({ lesson: l, moduleTitle: m.title })))
          .find(({ lesson }) => lesson.id === resume.nextLessonId)
        : undefined
      return {
        enrolmentId: enrolment.id,
        courseId: course.id,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        progressPercent: combinedProgressPercent(resume),
        completedLessons: resume.completedLessons,
        totalLessons: resume.totalLessons,
        completedAssessments: resume.completedAssessments,
        totalAssessments: resume.totalAssessments,
        courseCompleted: resume.courseCompleted,
        enrolledAt: enrolment.enrolledAt,
        nextLessonId: resume.nextLessonId,
        nextLessonTitle: nextLesson?.lesson.title ?? null,
        nextModuleTitle: nextLesson?.moduleTitle ?? null,
      }
    }),
  )
}

export interface ProgressEventItem {
  courseId: string
  courseTitle: string
  lessonId: string
  lessonTitle: string
  occurredAt: string
}

export function getMyProgressEvents(params: { page?: number; pageSize?: number } = {}): Promise<{ data: ProgressEventItem[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 10))
  return apiFetchPaged<ProgressEventItem>(`/api/learning/progress/events/me?${query.toString()}`)
}

export type LiveClassStatus = 'Scheduled' | 'Live' | 'Ended' | 'Cancelled'

export interface LiveClassSummary {
  id: string
  courseId: string
  title: string
  scheduledStart: string
  status: LiveClassStatus
}

export interface LiveClassDetail {
  id: string
  courseId: string
  title: string
  instructorUserId: string
  scheduledStart: string
  scheduledEnd: string
  capacity: number | null
  bookedCount: number
  status: LiveClassStatus
  isCallerBooked: boolean
}

// Every live class the caller has booked, ordered by start - past ones included, not just
// upcoming. Callers that only want a window filter it themselves.
export function getMyLiveClasses(params: { page?: number; pageSize?: number } = {}): Promise<{ data: LiveClassSummary[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 20))
  return apiFetchPaged<LiveClassSummary>(`/api/learning/live-classes/mine?${query.toString()}`)
}

export function listLiveClasses(params: { courseId?: string; page?: number; pageSize?: number } = {}): Promise<{ data: LiveClassSummary[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 50))
  if (params.courseId) query.set('courseId', params.courseId)
  return apiFetchPaged<LiveClassSummary>(`/api/learning/live-classes?${query.toString()}`)
}

export function getLiveClass(liveClassId: string): Promise<LiveClassDetail> {
  return apiFetch(`/api/learning/live-classes/${liveClassId}`)
}

export function bookLiveClass(liveClassId: string): Promise<{ liveClassId: string; bookedCount: number }> {
  return apiFetch(`/api/learning/live-classes/${liveClassId}/bookings`, { method: 'POST' })
}

export function cancelLiveClassBooking(liveClassId: string): Promise<{ liveClassId: string }> {
  return apiFetch(`/api/learning/live-classes/${liveClassId}/bookings/me`, { method: 'DELETE' })
}

// Minted fresh on every call and short-lived, so fetch it at the moment of joining rather than
// caching it. Succeeds only for a booked attendee or the instructor.
export function joinLiveClass(liveClassId: string): Promise<{ iframeUrl: string; expiresAt: string }> {
  return apiFetch(`/api/learning/live-classes/${liveClassId}/join`)
}
