import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

// School and class boards, course Q&A and reporting (backend Community module). The whole API
// answers 403 feature_unavailable unless the school's plan includes boards or Q&A, and 403
// community_off for an area the school has switched off - check featureConfirmed first.

export type SafetyPreset = 'Open' | 'Standard' | 'Restricted'
export type SpaceKind = 'SchoolBoard' | 'ClassBoard' | 'CourseQA' | 'StudyGroup'
export type PostKind = 'Announcement' | 'Discussion' | 'Question'
export type ContentStatus = 'Visible' | 'PendingApproval' | 'Held' | 'Hidden' | 'Removed'
export type Audience = 'Class' | 'Course'
export type ReactionKind = 'Like' | 'Helpful' | 'Celebrate' | 'SameQuestion'
export type ReportReason = 'Unkind' | 'Inappropriate' | 'Spam' | 'PersonalInfo' | 'Other'
export type CodeLanguage = 'blocks' | 'python' | 'lua' | 'javascript' | 'text'

export interface SafetyRules {
  preset: SafetyPreset
  defaultAudience: Audience
  /** The learner's questions always stay in their class. */
  audienceFixed: boolean
  /** Their posts wait for a teacher before others see them. */
  requiresApproval: boolean
  imagesAllowed: boolean
  linksAllowed: boolean
  /** Null: no limit. 0: no editing after posting. */
  editWindowMinutes: number | null
  /** Whether the learner can start a study group, and whether it needs approval. */
  studentGroups: 'Allowed' | 'Approval' | 'StaffOnly'
  /** Their class lets them message classmates (if the school allows it too). */
  studentMessages: boolean
}

export interface ClassRef {
  id: string
  name: string
}

export interface Space {
  id: string
  kind: SpaceKind
  contextId: string
  name: string
  canPost: boolean
  /** Learners may reply and react (always true for Q&A). */
  canComment: boolean
  canModerate: boolean
  /** Q&A: the classes a class-only question can go to. */
  audienceClasses: ClassRef[]
}

export interface CommunityHome {
  boardOn: boolean
  commentsOn: boolean
  qaOn: boolean
  simRunsOn: boolean
  isStaff: boolean
  mutedUntil: string | null
  rules: SafetyRules
  schoolBoard: Space | null
  classBoards: Space[]
  /** Phase C2: study groups, class and group chat, direct messages. */
  studyGroupsOn: boolean
  chatOn: boolean
  directMessagesOn: boolean
}

export interface Author {
  id: string
  /** Other learners appear as "Ada O."; staff see full names. */
  name: string
  isStaff: boolean
}

export interface Reactions {
  counts: Partial<Record<ReactionKind, number>>
  mine: ReactionKind[]
}

export interface SharedRun {
  runId: string
  lessonId: string
  sceneId: string
  sceneName: string
  mode: 'practice' | 'graded'
  language: string
  program: string | null
  generatedCode: string | null
  outcome: string | null
  passed: boolean | null
  stars: number | null
  submittedAt: string
}

export interface Attachment {
  id: string
  kind: 'Image' | 'Code' | 'SimulationRun'
  /** Images: a signed URL, valid for an hour. */
  url: string | null
  fileName: string | null
  codeLanguage: CodeLanguage | null
  code: string | null
  /** Null when the run is no longer available. */
  run: SharedRun | null
}

export interface PostSummary {
  id: string
  spaceId: string
  kind: PostKind
  title: string
  excerpt: string
  author: Author
  status: ContentStatus
  statusReason: string | null
  isDeleted: boolean
  isPinned: boolean
  isLocked: boolean
  audience: Audience | null
  audienceClass: ClassRef | null
  anchorLessonId: string | null
  anchorSceneId: string | null
  replyCount: number
  isAnswered: boolean
  hasStaffReply: boolean
  reactions: Reactions
  attachmentCount: number
  createdAt: string
  editedAt: string | null
  lastActivityAt: string
}

export interface Reply {
  id: string
  postId: string
  author: Author
  body: string
  status: ContentStatus
  statusReason: string | null
  isDeleted: boolean
  isAccepted: boolean
  quotedReplyId: string | null
  reactions: Reactions
  attachments: Attachment[]
  canEdit: boolean
  canDelete: boolean
  createdAt: string
  editedAt: string | null
}

export interface PostDetail {
  post: PostSummary
  body: string
  space: Space
  attachments: Attachment[]
  replies: Reply[]
  canEdit: boolean
  canDelete: boolean
  canReply: boolean
  canAccept: boolean
  canModerate: boolean
  /** Staff board posts, for moderators: how many have opened it. */
  seenCount: number | null
}

export interface CodeAttachment {
  language: CodeLanguage
  code: string
}

/** What a post or reply carries besides its text. */
export interface AttachmentDraft {
  imageIds: string[]
  code: CodeAttachment[]
  simulationRunIds: string[]
}

/** What the attachment picker holds before posting: uploaded images (with a local preview), code and runs. */
export interface PickedAttachments {
  images: { id: string; name: string; preview: string }[]
  code: CodeAttachment[]
  runs: SharedRun[]
}

export const emptyAttachments = (): PickedAttachments => ({ images: [], code: [], runs: [] })

export function toAttachmentDraft(picked: PickedAttachments): AttachmentDraft {
  return {
    imageIds: picked.images.map((i) => i.id),
    code: picked.code,
    simulationRunIds: picked.runs.map((r) => r.runId),
  }
}

export interface CreatePostRequest extends Partial<AttachmentDraft> {
  kind: PostKind
  title: string
  body: string
  /** Q&A: null for the caller's default. */
  audience?: Audience | null
  audienceClassId?: string | null
  anchorLessonId?: string | null
  anchorSceneId?: string | null
  /** Staff board posts: also email the board's members. */
  sendEmail?: boolean
}

export type PostFilter = 'all' | 'questions' | 'unanswered' | 'mine'
export type PostSort = 'recent' | 'new' | 'top'

export function getCommunityHome() {
  return apiFetch<CommunityHome>('/api/community/me')
}

export function getSchoolBoard() {
  return apiFetch<Space>('/api/community/spaces/school')
}

export function getClassBoard(classId: string) {
  return apiFetch<Space>(`/api/community/spaces/class/${classId}`)
}

export function getCourseQA(courseId: string) {
  return apiFetch<Space>(`/api/community/spaces/course/${courseId}`)
}

export function getGroupBoard(groupId: string) {
  return apiFetch<Space>(`/api/community/spaces/group/${groupId}`)
}

export function listPosts(
  spaceId: string,
  options: { lessonId?: string | null; sceneId?: string | null; filter?: PostFilter; sort?: PostSort; page?: number; pageSize?: number } = {},
): Promise<{ data: PostSummary[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  if (options.lessonId) query.set('lessonId', options.lessonId)
  if (options.sceneId) query.set('sceneId', options.sceneId)
  if (options.filter && options.filter !== 'all') query.set('filter', options.filter)
  if (options.sort && options.sort !== 'recent') query.set('sort', options.sort)
  query.set('page', String(options.page ?? 1))
  query.set('pageSize', String(options.pageSize ?? 20))
  return apiFetchPaged<PostSummary>(`/api/community/spaces/${spaceId}/posts?${query.toString()}`)
}

export function createPost(spaceId: string, request: CreatePostRequest) {
  return apiFetch<PostDetail>(`/api/community/spaces/${spaceId}/posts`, { method: 'POST', body: JSON.stringify(request) })
}

export function getPost(postId: string) {
  return apiFetch<PostDetail>(`/api/community/posts/${postId}`)
}

export function editPost(postId: string, title: string, body: string) {
  return apiFetch<PostDetail>(`/api/community/posts/${postId}`, { method: 'PATCH', body: JSON.stringify({ title, body }) })
}

export function deletePost(postId: string) {
  return apiFetch<void>(`/api/community/posts/${postId}`, { method: 'DELETE' })
}

export function createReply(postId: string, body: string, attachments: Partial<AttachmentDraft> = {}, quotedReplyId: string | null = null) {
  return apiFetch<PostDetail>(`/api/community/posts/${postId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ body, quotedReplyId, ...attachments }),
  })
}

export function editReply(replyId: string, body: string) {
  return apiFetch<PostDetail>(`/api/community/replies/${replyId}`, { method: 'PATCH', body: JSON.stringify({ body }) })
}

export function deleteReply(replyId: string) {
  return apiFetch<void>(`/api/community/replies/${replyId}`, { method: 'DELETE' })
}

export function acceptAnswer(postId: string, replyId: string) {
  return apiFetch<void>(`/api/community/posts/${postId}/accept`, { method: 'POST', body: JSON.stringify({ replyId }) })
}

export function clearAnswer(postId: string) {
  return apiFetch<void>(`/api/community/posts/${postId}/accept`, { method: 'DELETE' })
}

export function setReaction(contentType: 'Post' | 'Reply', contentId: string, kind: ReactionKind, on: boolean) {
  return apiFetch<void>(`/api/community/reactions/${contentType}/${contentId}/${kind}`, { method: on ? 'PUT' : 'DELETE' })
}

export function reportContent(contentType: 'Post' | 'Reply', contentId: string, reason: ReportReason, note: string | null) {
  return apiFetch<void>('/api/community/reports', {
    method: 'POST',
    body: JSON.stringify({ contentType, contentId, reason, note }),
  })
}

/** Uploads an image straight to storage and returns its attachment id, to pass when posting. */
export async function uploadImage(file: File): Promise<string> {
  const { attachmentId, uploadUrl } = await apiFetch<{ attachmentId: string; uploadUrl: string; expiresAt: string }>(
    '/api/community/attachments/images',
    { method: 'POST', body: JSON.stringify({ contentType: file.type, fileName: file.name, sizeBytes: file.size }) },
  )
  const upload = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  if (!upload.ok) throw new Error("Couldn't upload the image. Please try again.")
  return attachmentId
}

export function listMyRuns(lessonId?: string | null) {
  const query = lessonId ? `?lessonId=${lessonId}` : ''
  return apiFetch<SharedRun[]>(`/api/community/attachments/simulation-runs${query}`)
}

export const REACTION_LABELS: Record<ReactionKind, string> = {
  Like: 'Like',
  Helpful: 'Helpful',
  Celebrate: 'Nice!',
  SameQuestion: 'Same question',
}

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'Unkind', label: 'Unkind or bullying' },
  { value: 'Inappropriate', label: 'Inappropriate' },
  { value: 'PersonalInfo', label: 'Shares personal details' },
  { value: 'Spam', label: 'Spam' },
  { value: 'Other', label: 'Something else' },
]

/** Words for a status the author (or staff) can see. */
export function statusLabel(status: ContentStatus): string | null {
  switch (status) {
    case 'PendingApproval': return 'Waiting for your teacher to approve'
    case 'Held': return 'Being checked before others can see it'
    case 'Hidden': return 'Hidden by staff'
    case 'Removed': return 'Removed by staff'
    default: return null
  }
}
