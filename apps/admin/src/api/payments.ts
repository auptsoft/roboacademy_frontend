import { apiErrorFrom, apiFetch, apiFetchPaged, apiHeaders, apiUrl, type PageMeta } from '@/api/client'

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

// --- Phase P2: a school's payouts and sales (payments:manage-own, own tenant) ---

export type PayoutAccountStatus = 'PendingVerification' | 'Active' | 'Failed' | 'Disabled'

export interface PayoutAccount {
  id: string
  tenantId: string
  providerId: string
  bankName: string
  bankCode: string
  accountNumberLast4: string
  accountName: string
  businessName: string
  status: PayoutAccountStatus
  failureReason: string | null
  updatedAt: string
}

/** percentBps: 500 = 5%. Amounts in kobo. */
export interface FeeRule {
  percentBps: number
  flatMinor: number
  capMinor: number | null
}

export interface PayoutOverview {
  account: PayoutAccount | null
  providerConfigured: boolean
  currency: string
  fee: FeeRule
  providerFeePaidBySchool: boolean
}

export interface Bank {
  code: string
  name: string
}

const school = '/api/admin/payments'

export function listBanks(): Promise<Bank[]> {
  return apiFetch(`${school}/banks`)
}

export function resolveBankAccount(bankCode: string, accountNumber: string): Promise<{ accountName: string }> {
  return apiFetch(`${school}/payout-account/resolve`, { method: 'POST', body: JSON.stringify({ bankCode, accountNumber }) })
}

export function getPayoutOverview(): Promise<PayoutOverview> {
  return apiFetch(`${school}/payout-account`)
}

export function savePayoutAccount(request: { bankCode: string; accountNumber: string; businessName: string }): Promise<PayoutAccount> {
  return apiFetch(`${school}/payout-account`, { method: 'PUT', body: JSON.stringify(request) })
}

export interface Sale {
  id: string
  reference: string
  userId: string
  buyerName: string | null
  buyerEmail: string | null
  courseId: string
  courseTitle: string
  amountMinor: number
  currency: string
  platformFeeMinor: number
  providerFeeMinor: number | null
  /** What reaches the school's bank; null until the provider reports its fee. */
  netMinor: number | null
  status: OrderStatus
  createdAt: string
  paidAt: string | null
}

export interface SalesFilters {
  status?: OrderStatus
  search?: string
  from?: string
  to?: string
}

function salesParams(filters: SalesFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  return params
}

export function listSales(filters: SalesFilters = {}, page = 1, pageSize = 20): Promise<{ items: Sale[]; meta: PageMeta }> {
  const params = salesParams(filters)
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  return apiFetchPaged<Sale>(`${school}/orders?${params}`)
}

export interface Earnings {
  currency: string
  sales: number
  grossMinor: number
  platformFeeMinor: number
  providerFeeMinor: number
  netMinor: number
}

export function getEarnings(filters: Pick<SalesFilters, 'from' | 'to'> = {}): Promise<Earnings> {
  return apiFetch(`${school}/earnings?${salesParams(filters)}`)
}

/** Downloads the filtered sales as CSV. */
export async function downloadSalesCsv(filters: SalesFilters = {}): Promise<void> {
  const headers = apiHeaders()
  headers.delete('Content-Type')
  const response = await fetch(apiUrl(`${school}/orders/export?${salesParams(filters)}`), { headers })
  if (!response.ok) throw apiErrorFrom(response.status, null, 'Failed to export sales.')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// --- Phase P2: fees and every school's payout account (payments:manage) ---

export type FeeBearer = 'Tenant' | 'Platform'

export interface PlatformFees extends FeeRule {
  bearer: FeeBearer
  updatedAt: string
}

export function getPlatformFees(): Promise<PlatformFees> {
  return apiFetch(`${platform}/fees`)
}

export function setPlatformFees(request: FeeRule & { bearer: FeeBearer }): Promise<PlatformFees> {
  return apiFetch(`${platform}/fees`, { method: 'PUT', body: JSON.stringify(request) })
}

export interface TenantFee {
  tenantId: string
  percentBps: number | null
  flatMinor: number | null
  capMinor: number | null
  notes: string | null
  effective: FeeRule
  isOverridden: boolean
}

export function getTenantFee(tenantId: string): Promise<TenantFee> {
  return apiFetch(`${platform}/tenants/${tenantId}/fee`)
}

export function setTenantFee(
  tenantId: string, request: { percentBps: number | null; flatMinor: number | null; capMinor: number | null; notes: string | null },
): Promise<TenantFee> {
  return apiFetch(`${platform}/tenants/${tenantId}/fee`, { method: 'PUT', body: JSON.stringify(request) })
}

export function clearTenantFee(tenantId: string): Promise<TenantFee> {
  return apiFetch(`${platform}/tenants/${tenantId}/fee`, { method: 'DELETE' })
}

export function listPayoutAccounts(tenantId?: string): Promise<PayoutAccount[]> {
  return apiFetch(`${platform}/payout-accounts${tenantId ? `?tenantId=${tenantId}` : ''}`)
}

export function setPayoutAccountEnabled(payoutAccountId: string, enabled: boolean): Promise<PayoutAccount> {
  return apiFetch(`${platform}/payout-accounts/${payoutAccountId}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' })
}

/** "5%", "2% + ₦100, max ₦300". */
export function describeFee(rule: FeeRule, money: (minor: number) => string): string {
  const parts = [`${rule.percentBps / 100}%`]
  if (rule.flatMinor) parts.push(`+ ${money(rule.flatMinor)}`)
  const text = parts.join(' ')
  return rule.capMinor ? `${text}, max ${money(rule.capMinor)}` : text
}
