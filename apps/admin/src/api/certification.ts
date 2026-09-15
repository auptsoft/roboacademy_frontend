import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

export type CertificateStatus = 'Issued' | 'Revoked'

export interface CertificateListItem {
  id: string
  courseId: string
  userId: string
  verificationId: string
  status: CertificateStatus
  issuedAt: string
}

export interface ListCertificatesFilters {
  courseId?: string
  userId?: string
}

export function listCertificates(
  filters: ListCertificatesFilters = {}, page = 1, pageSize = 20,
): Promise<{ items: CertificateListItem[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.courseId) params.set('courseId', filters.courseId)
  if (filters.userId) params.set('userId', filters.userId)
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
