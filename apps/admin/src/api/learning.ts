import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export type LessonType = 'Video' | 'Reading' | 'Interactive' | 'Simulation' | 'Pdf'
export type CourseState = 'Draft' | 'Published' | 'Retired'
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced'

export const LESSON_TYPES: LessonType[] = ['Video', 'Reading', 'Interactive', 'Simulation', 'Pdf']
export const COURSE_LEVELS: CourseLevel[] = ['Beginner', 'Intermediate', 'Advanced']

export interface LessonItem {
  id: string
  title: string
  type: LessonType
  order: number
  isRequired: boolean
  allowUnenrolled: boolean
  contentReference: string | null
  context: string | null
}

export interface CourseModuleItem {
  id: string
  title: string
  description: string | null
  order: number
  lessons: LessonItem[]
}

export interface CourseDetail {
  id: string
  title: string
  description: string | null
  longDescription: string | null
  level: CourseLevel | null
  category: string | null
  extraProperties: Record<string, unknown>
  state: CourseState
  thumbnailUrl: string | null
  introVideoReference: string | null
  modules: CourseModuleItem[]
}

export interface CourseCatalogItem {
  id: string
  title: string
  description: string | null
  level: CourseLevel | null
  category: string | null
  state: CourseState
  thumbnailUrl: string | null
  lessonCount: number
}

export interface CreateCourseRequest {
  title: string
  description?: string
}

export interface CreatedCourse {
  id: string
  title: string
  state: CourseState
}

export interface ListCourseCatalogFilters {
  state?: CourseState
  search?: string
}

export function listCourseCatalog(
  filters: ListCourseCatalogFilters = {}, page = 1, pageSize = 20,
): Promise<{ items: CourseCatalogItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.state) params.set('state', filters.state)
  if (filters.search) params.set('search', filters.search)
  return apiFetchPaged<CourseCatalogItem>(`/api/learning/courses?${params}`)
}

export function getCourse(courseId: string): Promise<CourseDetail> {
  return apiFetch<CourseDetail>(`/api/learning/courses/${courseId}`)
}

export interface UpdateCourseRequest {
  title: string
  description?: string
  longDescription?: string | null
  level?: CourseLevel | null
  category?: string | null
  // String-only for now - see KeyValueEditor, the admin UI component that produces this.
  extraProperties?: Record<string, string>
}

export function updateCourse(courseId: string, request: UpdateCourseRequest): Promise<{
  id: string
  title: string
  description: string | null
  longDescription: string | null
  level: CourseLevel | null
  category: string | null
  extraProperties: Record<string, unknown>
}> {
  return apiFetch(`/api/learning/courses/${courseId}`, { method: 'PUT', body: JSON.stringify(request) })
}

export function createCourse(request: CreateCourseRequest): Promise<CreatedCourse> {
  return apiFetch(`/api/learning/courses`, {
    method: 'POST',
    body: JSON.stringify({ title: request.title, description: request.description, modules: [] }),
  })
}

export function publishCourse(courseId: string): Promise<{ id: string; state: CourseState }> {
  return apiFetch(`/api/learning/courses/${courseId}/publish`, { method: 'POST' })
}

export function unpublishCourse(courseId: string): Promise<{ id: string; state: CourseState }> {
  return apiFetch(`/api/learning/courses/${courseId}/unpublish`, { method: 'POST' })
}

export function addCourseModule(
  courseId: string, request: { title: string; description?: string },
): Promise<CourseModuleItem> {
  return apiFetch(`/api/learning/courses/${courseId}/modules`, { method: 'POST', body: JSON.stringify(request) })
}

export function updateCourseModule(
  courseId: string, moduleId: string, request: { title: string; description?: string; order: number },
): Promise<CourseModuleItem> {
  return apiFetch(`/api/learning/courses/${courseId}/modules/${moduleId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function deleteCourseModule(courseId: string, moduleId: string): Promise<{ moduleId: string }> {
  return apiFetch(`/api/learning/courses/${courseId}/modules/${moduleId}`, { method: 'DELETE' })
}

export function addLessonToModule(
  courseId: string, moduleId: string, request: { title: string; type: LessonType },
): Promise<LessonItem> {
  return apiFetch(`/api/learning/courses/${courseId}/modules/${moduleId}/lessons`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function updateLesson(
  courseId: string, moduleId: string, lessonId: string,
  request: {
    title: string; type: LessonType; isRequired: boolean; allowUnenrolled?: boolean; context?: string | null;
    order?: number; targetModuleId?: string;
  },
): Promise<LessonItem> {
  return apiFetch(`/api/learning/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function deleteLesson(courseId: string, moduleId: string, lessonId: string): Promise<{ lessonId: string }> {
  return apiFetch(`/api/learning/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, { method: 'DELETE' })
}

// --- Lesson content (e.g. video) upload/playback via presigned R2 URLs ---

export interface LessonContentUploadUrl {
  uploadUrl: string
  objectKey: string
  expiresAt: string
}

export interface LessonContentUrl {
  url: string
  expiresAt: string
}

// Request a presigned PUT URL, then upload the file bytes directly to `uploadUrl` (not
// through apiFetch - it's R2's endpoint, not our API), then call setLessonContentReference
// with the returned objectKey.
export function getLessonContentUploadUrl(
  courseId: string, moduleId: string, lessonId: string,
  request: { contentType: string; fileName: string },
): Promise<LessonContentUploadUrl> {
  return apiFetch(
    `/api/learning/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/content-upload-url`,
    { method: 'POST', body: JSON.stringify(request) },
  )
}

export function setLessonContentReference(
  courseId: string, moduleId: string, lessonId: string, contentReference: string | null,
): Promise<{ id: string; contentReference: string | null }> {
  return apiFetch(`/api/learning/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/content`, {
    method: 'PUT',
    body: JSON.stringify({ contentReference }),
  })
}

// Fetch fresh each time playback starts - the returned URL expires, never cache it.
export function getLessonContentUrl(
  courseId: string, moduleId: string, lessonId: string,
): Promise<LessonContentUrl> {
  return apiFetch(`/api/learning/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/content-url`)
}

// --- Course thumbnail (local-disk storage, permanent public URL - mirrors uploadTenantLogo) ---

// Stores the file and hands back its permanent URL only - it does not itself save the
// course's thumbnailUrl, so the caller still needs to submit that URL through setCourseThumbnail.
export function uploadCourseThumbnail(courseId: string, file: File): Promise<{ thumbnailUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<{ thumbnailUrl: string }>(`/api/learning/courses/${courseId}/thumbnail`, {
    method: 'POST',
    body: formData,
  })
}

export function setCourseThumbnail(
  courseId: string, thumbnailUrl: string | null,
): Promise<{ id: string; thumbnailUrl: string | null }> {
  return apiFetch(`/api/learning/courses/${courseId}/thumbnail`, {
    method: 'PUT',
    body: JSON.stringify({ thumbnailUrl }),
  })
}

// --- Course intro video (R2 presigned URLs - mirrors lesson content upload/playback) ---

// Request a presigned PUT URL, then upload the file bytes directly to `uploadUrl` (not
// through apiFetch - it's R2's endpoint, not our API), then call setCourseIntroVideo with
// the returned objectKey.
export function getCourseIntroVideoUploadUrl(
  courseId: string, request: { contentType: string; fileName: string },
): Promise<LessonContentUploadUrl> {
  return apiFetch(`/api/learning/courses/${courseId}/intro-video-upload-url`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function setCourseIntroVideo(
  courseId: string, introVideoReference: string | null,
): Promise<{ id: string; introVideoReference: string | null }> {
  return apiFetch(`/api/learning/courses/${courseId}/intro-video`, {
    method: 'PUT',
    body: JSON.stringify({ introVideoReference }),
  })
}

// Fetch fresh each time playback starts - the returned URL expires, never cache it.
export function getCourseIntroVideoUrl(courseId: string): Promise<LessonContentUrl> {
  return apiFetch(`/api/learning/courses/${courseId}/intro-video-url`)
}

// --- Learning Paths ---

export type PathState = 'Draft' | 'Published'

export interface PathListItem {
  id: string
  title: string
  description: string | null
  state: PathState
  thumbnailUrl: string | null
  courseCount: number
}

export interface PathStep {
  courseId: string
  courseTitle: string
  order: number
}

export interface PathDetail {
  id: string
  title: string
  description: string | null
  longDescription: string | null
  state: PathState
  thumbnailUrl: string | null
  introVideoReference: string | null
  steps: PathStep[]
}

export interface ListPathsFilters {
  state?: PathState
  search?: string
}

export function listPaths(
  filters: ListPathsFilters = {}, page = 1, pageSize = 20,
): Promise<{ items: PathListItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.state) params.set('state', filters.state)
  if (filters.search) params.set('search', filters.search)
  return apiFetchPaged<PathListItem>(`/api/learning/paths?${params}`)
}

export function getPath(pathId: string): Promise<PathDetail> {
  return apiFetch(`/api/learning/paths/${pathId}`)
}

export interface PathEnrolmentItem {
  enrolmentId: string
  userId: string
  fullName: string
  email: string
  status: string
  enrolledAt: string
}

export function listPathEnrolments(
  pathId: string, page = 1, pageSize = 50,
): Promise<{ items: PathEnrolmentItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiFetchPaged<PathEnrolmentItem>(`/api/learning/admin/paths/${pathId}/enrolments?${params}`)
}

export function updatePath(
  pathId: string, request: { title: string; description?: string; longDescription?: string | null },
): Promise<{ id: string; title: string; description: string | null; longDescription: string | null }> {
  return apiFetch(`/api/learning/paths/${pathId}`, { method: 'PUT', body: JSON.stringify(request) })
}

export function createPath(request: { title: string; description?: string }): Promise<{ id: string; title: string; state: PathState }> {
  return apiFetch(`/api/learning/paths`, { method: 'POST', body: JSON.stringify(request) })
}

export function unpublishPath(pathId: string): Promise<{ id: string; state: PathState }> {
  return apiFetch(`/api/learning/paths/${pathId}/unpublish`, { method: 'POST' })
}

// Append-only — there is no remove/reorder endpoint for path steps.
export function addCourseToPath(pathId: string, courseId: string): Promise<{ courseId: string; order: number }> {
  return apiFetch(`/api/learning/paths/${pathId}/courses`, { method: 'POST', body: JSON.stringify({ courseId }) })
}

export function publishPath(pathId: string): Promise<{ id: string; state: PathState }> {
  return apiFetch(`/api/learning/paths/${pathId}/publish`, { method: 'POST' })
}

// --- Path thumbnail (local-disk storage, permanent public URL - mirrors uploadCourseThumbnail) ---

// Stores the file and hands back its permanent URL only - it does not itself save the path's
// thumbnailUrl, so the caller still needs to submit that URL through setPathThumbnail.
export function uploadPathThumbnail(pathId: string, file: File): Promise<{ thumbnailUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<{ thumbnailUrl: string }>(`/api/learning/paths/${pathId}/thumbnail`, {
    method: 'POST',
    body: formData,
  })
}

export function setPathThumbnail(
  pathId: string, thumbnailUrl: string | null,
): Promise<{ id: string; thumbnailUrl: string | null }> {
  return apiFetch(`/api/learning/paths/${pathId}/thumbnail`, {
    method: 'PUT',
    body: JSON.stringify({ thumbnailUrl }),
  })
}

// --- Path intro video (R2 presigned URLs - mirrors course intro video upload/playback) ---

// Request a presigned PUT URL, then upload the file bytes directly to `uploadUrl` (not
// through apiFetch - it's R2's endpoint, not our API), then call setPathIntroVideo with
// the returned objectKey.
export function getPathIntroVideoUploadUrl(
  pathId: string, request: { contentType: string; fileName: string },
): Promise<LessonContentUploadUrl> {
  return apiFetch(`/api/learning/paths/${pathId}/intro-video-upload-url`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function setPathIntroVideo(
  pathId: string, introVideoReference: string | null,
): Promise<{ id: string; introVideoReference: string | null }> {
  return apiFetch(`/api/learning/paths/${pathId}/intro-video`, {
    method: 'PUT',
    body: JSON.stringify({ introVideoReference }),
  })
}

// Fetch fresh each time playback starts - the returned URL expires, never cache it.
export function getPathIntroVideoUrl(pathId: string): Promise<LessonContentUrl> {
  return apiFetch(`/api/learning/paths/${pathId}/intro-video-url`)
}

// --- Live Classes ---

export type LiveClassStatus = 'Scheduled' | 'Live' | 'Ended' | 'Cancelled'

export interface LiveClassListItem {
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

export interface CreateLiveClassRequest {
  courseId: string
  lessonId?: string
  title: string
  instructorUserId: string
  scheduledStart: string
  scheduledEnd: string
  capacity?: number
}

export function listLiveClasses(
  courseId?: string, page = 1, pageSize = 20,
): Promise<{ items: LiveClassListItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (courseId) params.set('courseId', courseId)
  return apiFetchPaged<LiveClassListItem>(`/api/learning/live-classes?${params}`)
}

export function getLiveClass(liveClassId: string): Promise<LiveClassDetail> {
  return apiFetch(`/api/learning/live-classes/${liveClassId}`)
}

export function createLiveClass(
  request: CreateLiveClassRequest,
): Promise<{ id: string; title: string; status: LiveClassStatus; scheduledStart: string }> {
  return apiFetch(`/api/learning/live-classes`, { method: 'POST', body: JSON.stringify(request) })
}

export function cancelLiveClass(liveClassId: string): Promise<{ id: string; status: LiveClassStatus }> {
  return apiFetch(`/api/learning/live-classes/${liveClassId}/cancel`, { method: 'POST' })
}

export interface CourseEnrolmentItem {
  enrolmentId: string
  userId: string
  fullName: string
  email: string
  status: string
  enrolledAt: string
}

export function listCourseEnrolments(
  courseId: string, page = 1, pageSize = 50,
): Promise<{ items: CourseEnrolmentItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiFetchPaged<CourseEnrolmentItem>(`/api/learning/admin/courses/${courseId}/enrolments?${params}`)
}

export function adminEnrolUser(courseId: string, userId: string): Promise<{ courseId: string; userId: string }> {
  return apiFetch(`/api/learning/admin/courses/${courseId}/enrolments`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export function adminWithdrawEnrolment(
  courseId: string, userId: string,
): Promise<{ courseId: string; userId: string; status: string }> {
  return apiFetch(`/api/learning/admin/courses/${courseId}/enrolments/${userId}/withdraw`, { method: 'POST' })
}

// Succeeds only for a booked attendee or the instructor.
export function joinLiveClass(liveClassId: string): Promise<{ iframeUrl: string; expiresAt: string }> {
  return apiFetch(`/api/learning/live-classes/${liveClassId}/join`)
}

// --- Cross-tenant course copy (platform admin only, from the platform tenant) ---

export interface CourseCopyTargetResult {
  tenantId: string
  isSuccessful: boolean
  courseId: string | null
  assessmentsCopied: number
  warnings: string[]
  error: string | null
}

export function copyCourseToTenants(
  courseId: string,
  request: { targetTenantIds: string[]; titleOverride?: string; includeAssessments?: boolean },
): Promise<{ results: CourseCopyTargetResult[] }> {
  return apiFetch(`/api/learning/courses/${courseId}/copy-to-tenants`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function importCourseFromTenant(request: {
  sourceTenantId: string
  courseId: string
  titleOverride?: string
  includeAssessments?: boolean
}): Promise<{ courseId: string; assessmentsCopied: number; warnings: string[] }> {
  return apiFetch('/api/learning/courses/import-from-tenant', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function listTenantCourses(
  sourceTenantId: string, search?: string, page = 1, pageSize = 20,
): Promise<{ items: CourseCatalogItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search) params.set('search', search)
  return apiFetchPaged<CourseCatalogItem>(`/api/learning/courses/from-tenant/${sourceTenantId}?${params}`)
}

export function getTenantCourse(sourceTenantId: string, courseId: string): Promise<CourseDetail> {
  return apiFetch<CourseDetail>(`/api/learning/courses/from-tenant/${sourceTenantId}/${courseId}`)
}
