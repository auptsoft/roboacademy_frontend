import { apiFetchPaged, type PageMeta } from '@/api/client'

export interface CertificateItem {
  id: string
  kind: 'Course' | 'Path'
  courseId: string | null
  pathId: string | null
  verificationId: string
  status: string
  issuedAt: string
}

export function getMyCertificates(params: { page?: number; pageSize?: number } = {}): Promise<{ data: CertificateItem[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 50))
  return apiFetchPaged<CertificateItem>(`/api/certification/me?${query.toString()}`)
}
