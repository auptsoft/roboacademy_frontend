import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export interface AdminUser {
  userId: string
  email: string
  firstName: string
  lastName: string
  otherNames: string | null
  fullName: string
  phoneNumber: string | null
  studentId: string | null
  isActive: boolean
  mustChangePassword: boolean
  roles: string[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export const ROBOACADEMY_ROLES = [
  'Individual',
  'Student',
  'Teacher',
  'TeachingAssistant',
  'SchoolAdmin',
  'PlatformSupport',
  'PlatformAdmin',
  'RobotLabAdmin',
  'Guest',
] as const

export interface CreateUserRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  otherNames?: string
  phoneNumber?: string
  studentId?: string
  roles?: string[]
}

export interface UpdateUserRequest {
  email: string
  firstName: string
  lastName: string
  otherNames?: string
  phoneNumber?: string
  studentId?: string
}

interface UpdateUserResponse {
  userId: string
  email: string
  firstName: string
  lastName: string
  otherNames: string | null
  fullName: string
  phoneNumber: string | null
  studentId: string | null
}

interface UserMutationResponse {
  userId: string
  isActive: boolean
}

interface RolesMutationResponse {
  userId: string
  roles: string[]
}

export function listUsers(
  page = 1,
  pageSize = 20,
  search = '',
): Promise<{ items: AdminUser[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search.trim()) params.set('search', search.trim())
  return apiFetchPaged<AdminUser>(`/api/admin/identity/users?${params}`)
}

// Scoped to the caller's current tenant (X-Tenant-Id), like every other Identity admin read — a
// userId from a cross-tenant audit row can legitimately 404 here if it belongs to another tenant.
export function getUser(userId: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/api/admin/identity/users/${userId}`)
}

export interface AdminClass {
  classId: string
  name: string
  departmentId: string | null
  studentCount: number
  staffCount: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export function listClasses(page = 1, pageSize = 20): Promise<{ items: AdminClass[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiFetchPaged<AdminClass>(`/api/admin/identity/classes?${params}`)
}

export interface ClassStaffMember {
  userId: string
  fullName: string
  role: string
}

export interface ClassStudent {
  userId: string
  fullName: string
}

export interface ClassDetail {
  classId: string
  name: string
  departmentId: string | null
  staff: ClassStaffMember[]
  students: ClassStudent[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export function getClass(classId: string): Promise<ClassDetail> {
  return apiFetch<ClassDetail>(`/api/admin/identity/classes/${classId}`)
}

export function createClass(name: string, departmentId?: string): Promise<AdminClass> {
  return apiFetch<AdminClass>('/api/admin/identity/classes', {
    method: 'POST',
    body: JSON.stringify({ name, departmentId: departmentId ?? null }),
  })
}

export function updateClass(classId: string, name: string, departmentId?: string): Promise<AdminClass> {
  return apiFetch<AdminClass>(`/api/admin/identity/classes/${classId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, departmentId: departmentId ?? null }),
  })
}

export function deleteClass(classId: string): Promise<{ classId: string }> {
  return apiFetch(`/api/admin/identity/classes/${classId}`, { method: 'DELETE' })
}

export function addClassStaff(
  classId: string,
  userId: string,
  role: 'Teacher' | 'TeachingAssistant',
): Promise<{ classId: string; staffCount: number }> {
  return apiFetch(`/api/admin/identity/classes/${classId}/staff`, {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  })
}

export function removeClassStaff(classId: string, userId: string): Promise<{ classId: string; staffCount: number }> {
  return apiFetch(`/api/admin/identity/classes/${classId}/staff/${userId}`, { method: 'DELETE' })
}

export function addClassStudent(classId: string, userId: string): Promise<{ classId: string; studentCount: number }> {
  return apiFetch(`/api/admin/identity/classes/${classId}/students`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export function removeClassStudent(
  classId: string,
  userId: string,
): Promise<{ classId: string; studentCount: number }> {
  return apiFetch(`/api/admin/identity/classes/${classId}/students/${userId}`, { method: 'DELETE' })
}

export interface AdminDepartment {
  departmentId: string
  name: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export function listDepartments(page = 1, pageSize = 20): Promise<{ items: AdminDepartment[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiFetchPaged<AdminDepartment>(`/api/admin/identity/departments?${params}`)
}

export function createDepartment(name: string): Promise<AdminDepartment> {
  return apiFetch<AdminDepartment>('/api/admin/identity/departments', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function updateDepartment(departmentId: string, name: string): Promise<AdminDepartment> {
  return apiFetch<AdminDepartment>(`/api/admin/identity/departments/${departmentId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export function deleteDepartment(departmentId: string): Promise<{ departmentId: string }> {
  return apiFetch(`/api/admin/identity/departments/${departmentId}`, { method: 'DELETE' })
}

export function createUser(request: CreateUserRequest): Promise<AdminUser> {
  return apiFetch<AdminUser>('/api/admin/identity/users', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function updateUser(userId: string, request: UpdateUserRequest): Promise<UpdateUserResponse> {
  return apiFetch<UpdateUserResponse>(`/api/admin/identity/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function deactivateUser(userId: string): Promise<UserMutationResponse> {
  return apiFetch<UserMutationResponse>(`/api/admin/identity/users/${userId}`, {
    method: 'DELETE',
  })
}

export function reactivateUser(userId: string): Promise<UserMutationResponse> {
  return apiFetch<UserMutationResponse>(`/api/admin/identity/users/${userId}/reactivate`, {
    method: 'POST',
  })
}

export function assignRoles(userId: string, roles: string[]): Promise<RolesMutationResponse> {
  return apiFetch<RolesMutationResponse>(`/api/admin/identity/users/${userId}/roles`, {
    method: 'POST',
    body: JSON.stringify({ roles }),
  })
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>('/api/identity/me/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export interface BulkCreatedUser {
  userId: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  studentId: string
  roles: string[]
  passwordWasGenerated: boolean
  studentIdWasGenerated: boolean
}

export interface BulkRowError {
  rowNumber: number
  email: string | null
  reason: string
}

export interface BulkCreateUsersResponse {
  totalRows: number
  created: BulkCreatedUser[]
  errors: BulkRowError[]
}

export function bulkCreateUsers(file: File): Promise<BulkCreateUsersResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<BulkCreateUsersResponse>('/api/admin/identity/users/bulk', {
    method: 'POST',
    body: formData,
  })
}

export interface IdentityAuditLogItem {
  id: string
  tenantId: string | null
  userId: string | null
  entityType: string
  entityId: string
  action: string
  changes: string | null
  occurredAt: string
}

export interface AuditLogFilters {
  userId?: string | null
  fromDate?: string
  toDate?: string
  entityType?: string
  action?: string
}

export function appendAuditLogFilterParams(params: URLSearchParams, filters: AuditLogFilters): void {
  if (filters.userId) params.set('userId', filters.userId)
  if (filters.fromDate) params.set('fromDate', new Date(filters.fromDate).toISOString())
  if (filters.toDate) params.set('toDate', new Date(filters.toDate).toISOString())
  if (filters.entityType) params.set('entityType', filters.entityType)
  if (filters.action) params.set('action', filters.action)
}

export function getIdentityAuditLog(
  page = 1,
  pageSize = 20,
  filters: AuditLogFilters = {},
): Promise<{ items: IdentityAuditLogItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  appendAuditLogFilterParams(params, filters)
  return apiFetchPaged<IdentityAuditLogItem>(`/api/admin/identity/audit?${params}`)
}

export interface CreateTenantAdminRequest {
  email: string
  password: string
  firstName: string
  lastName: string
}

// Creates the first SchoolAdmin for tenantId, using a short-lived impersonation token (see
// postImpersonationToken) rather than the caller's own session token/tenant — for bootstrapping
// a tenant that has no users yet to log in as.
export function createTenantAdmin(
  tenantId: string,
  impersonationAccessToken: string,
  request: CreateTenantAdminRequest,
): Promise<AdminUser> {
  return apiFetch<AdminUser>('/api/admin/identity/users', {
    method: 'POST',
    headers: {
      'X-Tenant-Id': tenantId,
      Authorization: `Bearer ${impersonationAccessToken}`,
    },
    body: JSON.stringify({ ...request, roles: ['SchoolAdmin'] }),
  })
}
