import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

// A school's community, for its staff (backend Community module, Phases C1 and C2): the moderation
// queues for posts and chat, muting, study group approvals, the school's settings and each class's
// safety level. Answers 403 feature_unavailable unless the plan includes some part of community.

export type SafetyPreset = 'Open' | 'Standard' | 'Restricted'
export type ContentStatus = 'Visible' | 'PendingApproval' | 'Held' | 'Hidden' | 'Removed'
export type QueueView = 'review' | 'reported' | 'hidden' | 'removed'
export type ModerationAction =
  | 'approve' | 'hide' | 'restore' | 'remove' | 'pin' | 'unpin' | 'lock' | 'unlock' | 'dismiss-reports'

export interface QueueItem {
  contentType: 'Post' | 'Reply'
  contentId: string
  postId: string
  postTitle: string
  postKind: 'Announcement' | 'Discussion' | 'Question'
  space: { id: string; kind: 'SchoolBoard' | 'ClassBoard' | 'CourseQA'; contextId: string; name: string }
  author: { id: string; name: string; isStaff: boolean }
  body: string
  status: ContentStatus
  /** blocked_term, personal_info, approval, reports, ai:<category>, or a moderator's words. */
  statusReason: string | null
  /** Open reports, grouped by reason. */
  reports: { reason: string; count: number; notes: string[] }[]
  createdAt: string
  /** The post in the learner app (relative to its base URL). */
  linkPath: string
}

export interface Mute {
  userId: string
  name: string
  /** Far in the future (year 9999) when muted until someone unmutes. */
  mutedUntil: string | null
  reason: string | null
  mutedBy: string | null
}

export interface SafetyRules {
  preset: SafetyPreset
  defaultAudience: 'Class' | 'Course'
  audienceFixed: boolean
  requiresApproval: boolean
  imagesAllowed: boolean
  linksAllowed: boolean
  editWindowMinutes: number | null
}

export interface CommunitySettings {
  boardIncluded: boolean
  commentsIncluded: boolean
  qaIncluded: boolean
  simRunsIncluded: boolean
  aiModerationIncluded: boolean
  storageLimitMb: number | null
  storageUsedMb: number
  boardEnabled: boolean
  boardCommentsEnabled: boolean
  qaEnabled: boolean
  qaSimAttachmentsEnabled: boolean
  defaultPreset: SafetyPreset
  blockedTerms: string[]
  presets: { preset: SafetyPreset; rules: SafetyRules }[]
  // Phase C2.
  studyGroupsIncluded: boolean
  chatIncluded: boolean
  directMessagesIncluded: boolean
  maxStudyGroups: number | null
  maxGroupMembers: number | null
  /** Days of chat history kept; null keeps it all. */
  chatHistoryDays: number | null
  studyGroupsEnabled: boolean
  chatEnabled: boolean
  directMessagesEnabled: boolean
  /** Learners may message classmates (only in Open classes). */
  studentMessagesEnabled: boolean
}

export interface UpdateCommunitySettings {
  boardEnabled: boolean
  boardCommentsEnabled: boolean
  qaEnabled: boolean
  qaSimAttachmentsEnabled: boolean
  defaultPreset: SafetyPreset
  blockedTerms: string[]
  studyGroupsEnabled: boolean
  chatEnabled: boolean
  directMessagesEnabled: boolean
  studentMessagesEnabled: boolean
}

export type ChannelKind = 'Class' | 'StudyGroup' | 'Direct'
export type ChatAction = 'approve' | 'hide' | 'restore' | 'remove' | 'dismiss-reports'

export interface ChatQueueItem {
  messageId: string
  /** Direct conversations are named after both people. */
  channel: { id: string; kind: ChannelKind; name: string }
  author: { id: string; name: string; isStaff: boolean }
  body: string
  status: ContentStatus
  statusReason: string | null
  reports: { reason: string; count: number; notes: string[] }[]
  createdAt: string
}

export interface ChatMessage {
  id: string
  channelId: string
  author: { id: string; name: string; isStaff: boolean }
  body: string
  status: ContentStatus
  statusReason: string | null
  isDeleted: boolean
  createdAt: string
  editedAt: string | null
}

export type GroupStatus = 'PendingApproval' | 'Active' | 'Rejected' | 'Archived'

export interface StudyGroup {
  id: string
  class: { id: string; name: string }
  name: string
  description: string | null
  courseTitle: string | null
  goal: string | null
  targetDate: string | null
  status: GroupStatus
  decisionReason: string | null
  memberCount: number
  createdBy: { id: string; name: string; isStaff: boolean }
  createdAt: string
}

export interface ClassCommunitySettings {
  classId: string
  name: string
  /** The class's own level, or null when it follows the school. */
  preset: SafetyPreset | null
  schoolDefault: SafetyPreset
  effective: SafetyPreset
}

export function getQueue(view: QueueView, page = 1, pageSize = 20): Promise<{ items: QueueItem[]; meta: PageMeta }> {
  return apiFetchPaged<QueueItem>(`/api/admin/community/queue?view=${view}&page=${page}&pageSize=${pageSize}`)
}

export function getQueueCounts() {
  return apiFetch<{ review: number; reported: number }>('/api/admin/community/queue/counts')
}

export function moderate(contentType: 'Post' | 'Reply', contentId: string, action: ModerationAction, reason: string | null = null) {
  return apiFetch<void>(`/api/admin/community/content/${contentType}/${contentId}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function getChatQueue(view: QueueView, page = 1, pageSize = 20): Promise<{ items: ChatQueueItem[]; meta: PageMeta }> {
  return apiFetchPaged<ChatQueueItem>(`/api/admin/community/chat/queue?view=${view}&page=${page}&pageSize=${pageSize}`)
}

export function getChatQueueCounts() {
  return apiFetch<{ review: number; reported: number }>('/api/admin/community/chat/queue/counts')
}

export function moderateMessage(messageId: string, action: ChatAction, reason: string | null = null) {
  return apiFetch<void>(`/api/admin/community/chat/messages/${messageId}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

/** A chat for its moderators, every message whatever its status. Opening someone's direct
 * conversation is only allowed once something in it was reported or held, and is logged. */
export function getModeratedChannel(channelId: string, before?: string) {
  return apiFetch<{ channel: { id: string; kind: ChannelKind; name: string }; messages: ChatMessage[]; hasMore: boolean }>(
    `/api/admin/community/chat/channels/${channelId}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`)
}

export function listStudyGroups(status: GroupStatus = 'PendingApproval') {
  return apiFetch<StudyGroup[]>(`/api/admin/community/groups?status=${status}`)
}

export function decideStudyGroup(groupId: string, decision: 'approve' | 'reject' | 'archive', reason: string | null = null) {
  return apiFetch<StudyGroup>(`/api/admin/community/groups/${groupId}/${decision}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function listMutes() {
  return apiFetch<Mute[]>('/api/admin/community/mutes')
}

/** `days` null mutes until unmuted (school admins only). */
export function muteUser(userId: string, days: number | null, reason: string) {
  return apiFetch<void>(`/api/admin/community/users/${userId}/mute`, { method: 'POST', body: JSON.stringify({ days, reason }) })
}

export function unmuteUser(userId: string) {
  return apiFetch<void>(`/api/admin/community/users/${userId}/mute`, { method: 'DELETE' })
}

export function getCommunitySettings() {
  return apiFetch<CommunitySettings>('/api/admin/community/settings')
}

export function saveCommunitySettings(request: UpdateCommunitySettings) {
  return apiFetch<CommunitySettings>('/api/admin/community/settings', { method: 'PUT', body: JSON.stringify(request) })
}

export function getClassCommunitySettings(classId: string) {
  return apiFetch<ClassCommunitySettings>(`/api/admin/community/classes/${classId}/settings`)
}

export function saveClassCommunitySettings(classId: string, preset: SafetyPreset | null) {
  return apiFetch<ClassCommunitySettings>(`/api/admin/community/classes/${classId}/settings`, {
    method: 'PUT',
    body: JSON.stringify({ preset }),
  })
}

export const PRESET_LABELS: Record<SafetyPreset, { label: string; description: string }> = {
  Open: {
    label: 'Open',
    description: 'For older learners. Questions go to the whole course by default, posts can be edited any time, and learners start study groups themselves.',
  },
  Standard: {
    label: 'Standard',
    description: 'Questions stay in the class unless the learner chooses the course. Posts sharing phone numbers or emails are held for review. Learners\' study groups wait for a teacher.',
  },
  Restricted: {
    label: 'Restricted',
    description: 'For young learners. Every post and chat message waits for a teacher, questions stay in the class, no images or links, and only teachers set up study groups.',
  },
}

/** Plain words for why something is in the queue. */
export function reasonLabel(reason: string | null): string {
  if (!reason) return ''
  if (reason === 'approval') return 'Waiting for approval (Restricted class)'
  if (reason === 'blocked_term') return 'Contains a blocked word'
  if (reason === 'personal_info') return 'May share personal details'
  if (reason === 'reports') return 'Reported by several people'
  if (reason.startsWith('ai:')) {
    const category = reason.slice(3).replace('_', ' ')
    return `AI flagged: ${category}`
  }
  return reason
}
