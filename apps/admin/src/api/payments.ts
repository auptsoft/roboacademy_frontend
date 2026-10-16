import { apiFetch, apiFetchPaged, type PageMeta } from '@/api/client'

// Payments Phase P1: payment providers and every tenant's orders, for the platform admin
// (payments:manage). Secret keys are write-only - responses only say whether one is set.

export type PaymentProviderType = 'Paystack'
export type PaymentProviderMode = 'Test' | 'Live'
export type PaymentProviderStatus = 'Active' | 'Disabled'

export interface PaymentProvider {
  id: string
  name: string
  type: PaymentProviderType
  mode: PaymentProviderMode
  currencies: string[]
  publicKey: string | null
  hasSecretKey: boolean
  status: PaymentProviderStatus
  /** Paste into the provider's dashboard so it can tell us about payments. */
  webhookUrl: string
  orderCount: number
  createdAt: string
  updatedAt: string
}

export const SUPPORTED_CURRENCIES = ['NGN'] as const

const platform = '/api/admin/payments/platform'

export function listPaymentProviders(): Promise<PaymentProvider[]> {
  return apiFetch(`${platform}/providers`)
}

export function createPaymentProvider(request: {
  name: string
  type: PaymentProviderType
  mode: PaymentProviderMode
  currencies: string[]
  publicKey: string | null
  secretKey: string
}): Promise<PaymentProvider> {
  return apiFetch(`${platform}/providers`, { method: 'POST', body: JSON.stringify(request) })
}

// secretKey: null keeps the stored key. Activating a provider disables any other active one for
// the same currency.
export function updatePaymentProvider(
  providerId: string,
  request: {
    name: string
    mode: PaymentProviderMode
    currencies: string[]
    publicKey: string | null
    secretKey: string | null
    status: PaymentProviderStatus
  },
): Promise<PaymentProvider> {
  return apiFetch(`${platform}/providers/${providerId}`, { method: 'PUT', body: JSON.stringify(request) })
}

export function testPaymentProvider(providerId: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch(`${platform}/providers/${providerId}/test`, { method: 'POST' })
}

export function deletePaymentProvider(providerId: string): Promise<void> {
  return apiFetch(`${platform}/providers/${providerId}`, { method: 'DELETE' })
}

export type OrderStatus = 'Pending' | 'Paid' | 'Failed' | 'Abandoned'

export interface PlatformOrder {
  id: string
  reference: string
  tenantId: string
  userId: string
  buyerName: string | null
  buyerEmail: string | null
  courseId: string
  courseTitle: string
  amountMinor: number
  currency: string
  platformFeeMinor: number
  providerFeeMinor: number | null
  status: OrderStatus
  /** Set when a person needs to look: a mismatched amount, or a second payment to refund. */
  issue: string | null
  providerId: string
  providerTransactionId: string | null
  createdAt: string
  paidAt: string | null
}

export interface PlatformOrderFilters {
  status?: OrderStatus
  tenantId?: string
  search?: string
  issuesOnly?: boolean
}

export function listPlatformOrders(
  filters: PlatformOrderFilters = {}, page = 1, pageSize = 20,
): Promise<{ items: PlatformOrder[]; meta: PageMeta }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.status) params.set('status', filters.status)
  if (filters.tenantId) params.set('tenantId', filters.tenantId)
  if (filters.search) params.set('search', filters.search)
  if (filters.issuesOnly) params.set('issuesOnly', 'true')
  return apiFetchPaged<PlatformOrder>(`${platform}/orders?${params}`)
}
