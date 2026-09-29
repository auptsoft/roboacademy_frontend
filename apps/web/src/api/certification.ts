import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

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
  /** The issuing tenant, resolved server-side from the verification id. */
  tenantId: string
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

// Public: the verifier is usually signed out. The id alone identifies the issuing tenant
// server-side, so whatever tenant this browser last signed in to doesn't matter.
export function verifyCertificate(verificationId: string): Promise<CertificateVerification> {
  return apiFetch<CertificateVerification>(
    `/api/certification/verify/${encodeURIComponent(verificationId)}`,
  )
}

/** Shareable link to the public verify page. */
export function verificationUrl(verificationId: string): string {
  return new URL(`/v/${encodeURIComponent(verificationId)}`, window.location.origin).toString()
}

export function certificateTitle(cert: Pick<CertificateItem, 'kind' | 'courseTitle' | 'pathTitle'>): string {
  return (cert.kind === 'Path' ? cert.pathTitle : cert.courseTitle)
    ?? (cert.kind === 'Path' ? 'Learning path' : 'Course')
}
