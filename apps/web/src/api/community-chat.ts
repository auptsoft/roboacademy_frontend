import { apiFetch } from '@/api/client'
import type { Author, ClassRef, ContentStatus, ReportReason } from '@/api/community'

// Study groups, class and group chat, and direct messages (backend Community module, Phase C2).
// Groups answer 403 feature_unavailable unless the plan includes community_study_groups; chat
// unless it includes community_group_chat or community_direct_messages.

export type GroupStatus = 'PendingApproval' | 'Active' | 'Rejected' | 'Archived'
export type GroupCreation = 'Allowed' | 'Approval' | 'StaffOnly'
export type ChannelKind = 'Class' | 'StudyGroup' | 'Direct'

export interface StudyGroup {
  id: string
  class: ClassRef
  name: string
  description: string | null
  courseId: string | null
  courseTitle: string | null
  goal: string | null
  targetDate: string | null
  status: GroupStatus
  /** Why staff turned it down - for its creator and staff. */
  decisionReason: string | null
  memberCount: number
  isMember: boolean
  myRole: 'Leader' | 'Member' | null
  createdBy: Author
  /** Leader or the class's staff, while the group is open. */
  canManage: boolean
  canJoin: boolean
  createdAt: string
}

export interface GroupMember {
  userId: string
  name: string
  isStaff: boolean
  role: 'Leader' | 'Member'
  /** Null when the group has no course or the member isn't enrolled on it. */
  completedLessons: number | null
  totalLessons: number | null
  courseCompleted: boolean
}

export interface StudyGroupDetail {
  group: StudyGroup
  members: GroupMember[]
  /** The group's board; null until the group is active and the caller is in it. */
  spaceId: string | null
  /** The group's chat; null when chat is off. */
  channelId: string | null
  averageProgress: number | null
  maxMembers: number | null
  canLeave: boolean
}

export interface GroupsHome {
  canCreate: boolean
  creation: GroupCreation
  classes: ClassRef[]
  mine: StudyGroup[]
  joinable: StudyGroup[]
  /** Staff: groups waiting for approval. Learners: their own waiting or turned-down groups. */
  pending: StudyGroup[]
}

export interface GroupRequest {
  name: string
  description?: string | null
  courseId?: string | null
  goal?: string | null
  targetDate?: string | null
}

export interface Channel {
  id: string
  kind: ChannelKind
  contextId: string
  name: string
  /** Direct conversations: the other person. */
  other: Author | null
  unread: number
  lastMessageAt: string | null
  lastMessage: string | null
  /** Why the caller can't send messages here, or null when they can. */
  cannotWrite: string | null
  canModerate: boolean
}

export interface Mention {
  id: string
  name: string
}

export interface ChatMessage {
  id: string
  channelId: string
  author: Author
  body: string
  status: ContentStatus
  statusReason: string | null
  isDeleted: boolean
  mentions: Mention[]
  canEdit: boolean
  canDelete: boolean
  createdAt: string
  editedAt: string | null
}

export interface ChannelMessages {
  channel: Channel
  messages: ChatMessage[]
  /** There are older messages before the first one. */
  hasMore: boolean
  /** Days of history the school keeps; null for all of it. */
  historyDays: number | null
}

export interface Contact {
  id: string
  name: string
  isStaff: boolean
}

// --- Study groups ---

export function getGroupsHome() {
  return apiFetch<GroupsHome>('/api/community/groups')
}

export function createGroup(classId: string, request: GroupRequest) {
  return apiFetch<StudyGroup>('/api/community/groups', { method: 'POST', body: JSON.stringify({ classId, ...request }) })
}

export function getGroup(groupId: string) {
  return apiFetch<StudyGroupDetail>(`/api/community/groups/${groupId}`)
}

export function editGroup(groupId: string, request: GroupRequest) {
  return apiFetch<StudyGroup>(`/api/community/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(request) })
}

export function joinGroup(groupId: string) {
  return apiFetch<null>(`/api/community/groups/${groupId}/join`, { method: 'POST' })
}

export function leaveGroup(groupId: string) {
  return apiFetch<null>(`/api/community/groups/${groupId}/leave`, { method: 'POST' })
}

export function addGroupMember(groupId: string, userId: string) {
  return apiFetch<null>(`/api/community/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ userId }) })
}

/** Learners in the group's class who aren't in it yet (leader or class staff). */
export function listGroupCandidates(groupId: string, search = '') {
  return apiFetch<Contact[]>(`/api/community/groups/${groupId}/candidates${search ? `?search=${encodeURIComponent(search)}` : ''}`)
}

export function removeGroupMember(groupId: string, userId: string) {
  return apiFetch<null>(`/api/community/groups/${groupId}/members/${userId}`, { method: 'DELETE' })
}

export function archiveGroup(groupId: string) {
  return apiFetch<null>(`/api/community/groups/${groupId}/archive`, { method: 'POST' })
}

// --- Chat ---

export function listChannels() {
  return apiFetch<Channel[]>('/api/community/chat/channels')
}

export function getUnread() {
  return apiFetch<{ total: number; channels: Record<string, number> }>('/api/community/chat/unread')
}

export function listMessages(channelId: string, options: { before?: string; after?: string } = {}) {
  const params = new URLSearchParams()
  if (options.before) params.set('before', options.before)
  if (options.after) params.set('after', options.after)
  const query = params.toString()
  return apiFetch<ChannelMessages>(`/api/community/chat/channels/${channelId}/messages${query ? `?${query}` : ''}`)
}

export function sendMessage(channelId: string, body: string, mentionUserIds: string[] = []) {
  return apiFetch<ChatMessage>(`/api/community/chat/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body, mentionUserIds }),
  })
}

export function markRead(channelId: string) {
  return apiFetch<null>(`/api/community/chat/channels/${channelId}/read`, { method: 'POST' })
}

export function listChannelMembers(channelId: string) {
  return apiFetch<Contact[]>(`/api/community/chat/channels/${channelId}/members`)
}

export function editMessage(messageId: string, body: string) {
  return apiFetch<ChatMessage>(`/api/community/chat/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ body }) })
}

export function deleteMessage(messageId: string) {
  return apiFetch<null>(`/api/community/chat/messages/${messageId}`, { method: 'DELETE' })
}

export function reportMessage(messageId: string, reason: ReportReason, note: string | null) {
  return apiFetch<null>(`/api/community/chat/messages/${messageId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason, note }),
  })
}

export function listContacts(search = '') {
  return apiFetch<Contact[]>(`/api/community/chat/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`)
}

export function startDirect(userId: string) {
  return apiFetch<Channel>('/api/community/chat/direct', { method: 'POST', body: JSON.stringify({ userId }) })
}

export const GROUP_STATUS_LABELS: Record<GroupStatus, string> = {
  PendingApproval: 'Waiting for your teacher',
  Active: 'Open',
  Rejected: 'Not approved',
  Archived: 'Closed',
}
