import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export type CertificateStatus = 'Issued' | 'Revoked'
export type CertificateKind = 'Course' | 'Path'

export interface CertificateListItem {
  id: string
  kind: CertificateKind
  courseId: string | null
  pathId: string | null
  /** Null when the course/path no longer exists. */
  title: string | null
  userId: string
  learnerName: string | null
  learnerEmail: string | null
  verificationId: string
  status: CertificateStatus
  issuedAt: string
  revokedAt: string | null
  revokedReason: string | null
}

export interface ListCertificatesFilters {
  kind?: CertificateKind
  courseId?: string
  pathId?: string
  userId?: string
  status?: CertificateStatus
}

export function listCertificates(
  filters: ListCertificatesFilters = {}, page = 1, pageSize = 20,
): Promise<{ items: CertificateListItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.courseId) params.set('courseId', filters.courseId)
  if (filters.pathId) params.set('pathId', filters.pathId)
  if (filters.userId) params.set('userId', filters.userId)
  if (filters.status) params.set('status', filters.status)
  return apiFetchPaged<CertificateListItem>(`/api/admin/certification/certificates?${params}`)
}

export function issueCertificate(
  courseId: string, userId: string,
): Promise<{ id: string; verificationId: string; status: CertificateStatus }> {
  return apiFetch(`/api/admin/certification/certificates`, {
    method: 'POST',
    body: JSON.stringify({ courseId, userId }),
  })
}

export function revokeCertificate(certificateId: string, reason: string): Promise<{ id: string; status: CertificateStatus }> {
  return apiFetch(`/api/admin/certification/certificates/${certificateId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}
