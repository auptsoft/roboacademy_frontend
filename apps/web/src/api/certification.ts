import { apiFetch, apiFetchPaged, getTenantId, type PageMeta } from '@/api/client'

export type CertificateStatus = 'Issued' | 'Revoked'

export interface CertificateItem {
  id: string
  kind: 'Course' | 'Path'
  courseId: string | null
  pathId: string | null
  verificationId: string
  status: CertificateStatus
  issuedAt: string
  /** Null when the course/path no longer exists. */
  courseTitle: string | null
  pathTitle: string | null
  /** Whether the public verification page shows the holder's name (holder's choice). */
  holderNameVisible: boolean
}

/** One certificate with what its printable view needs; branding is the issuance snapshot. */
export interface CertificateDetail {
  id: string
  kind: 'Course' | 'Path'
  courseId: string | null
  pathId: string | null
  title: string | null
  verificationId: string
  status: CertificateStatus
  issuedAt: string
  revokedAt: string | null
  revokedReason: string | null
  holderName: string
  holderNameVisible: boolean
  issuerName: string | null
  brandLogoUrl: string | null
  brandPrimaryColor: string | null
  brandSecondaryColor: string | null
}

export interface CertificateVerification {
  valid: boolean
  status: CertificateStatus
  courseTitle: string | null
  pathTitle: string | null
  issuedAt: string
  revokedAt: string | null
  /** Only present when the holder has chosen to show it. */
  holderName: string | null
  issuerName: string | null
}

export function getMyCertificates(params: { page?: number; pageSize?: number } = {}): Promise<{ data: CertificateItem[]; meta: PageMeta }> {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 50))
  return apiFetchPaged<CertificateItem>(`/api/certification/me?${query.toString()}`)
}

export function getMyCertificate(certificateId: string): Promise<CertificateDetail> {
  return apiFetch<CertificateDetail>(`/api/certification/me/${certificateId}`)
}

export function setHolderNameVisibility(
  certificateId: string, visible: boolean,
): Promise<{ id: string; holderNameVisible: boolean }> {
  return apiFetch(`/api/certification/me/${certificateId}/holder-name-visibility`, {
    method: 'PUT',
    body: JSON.stringify({ visible }),
  })
}

// Public: the verifier is usually signed out, so the issuing tenant comes from the link itself
// (see verificationUrl) rather than whatever tenant this browser last signed in to.
export function verifyCertificate(verificationId: string, tenantId?: string): Promise<CertificateVerification> {
  const headers = tenantId ? { 'X-Tenant-Id': tenantId } : undefined
  return apiFetch<CertificateVerification>(
    `/api/certification/verify/${encodeURIComponent(verificationId)}`,
    { headers },
  )
}

/** Shareable link to the public verify page, carrying the issuing tenant. */
export function verificationUrl(verificationId: string): string {
  const url = new URL(`/verify/${encodeURIComponent(verificationId)}`, window.location.origin)
  url.searchParams.set('tenantId', getTenantId())
  return url.toString()
}

export function certificateTitle(cert: Pick<CertificateItem, 'kind' | 'courseTitle' | 'pathTitle'>): string {
  return (cert.kind === 'Path' ? cert.pathTitle : cert.courseTitle)
    ?? (cert.kind === 'Path' ? 'Learning path' : 'Course')
}
