import { apiFetch } from '@/api/client'

// Payments Phase P1: buying a course. Checkout returns the provider's page to send the learner
// to; the provider sends them back to /app/payments/callback?reference=…, which polls the order.

export type OrderStatus = 'Pending' | 'Paid' | 'Failed' | 'Abandoned'

export interface MyOrder {
  id: string
  reference: string
  courseId: string
  courseTitle: string
  amountMinor: number
  currency: string
  status: OrderStatus
  createdAt: string
  paidAt: string | null
}

// Refusals carry a code: already_has_access, already_purchased, free, no_payment_provider,
// payment_provider_unavailable, no_email, not_found.
export function startCheckout(courseId: string): Promise<{ reference: string; authorizationUrl: string }> {
  return apiFetch('/api/payments/checkout', { method: 'POST', body: JSON.stringify({ courseId }) })
}

/** Also asks the provider about a pending order, so a slow webhook doesn't keep the learner waiting. */
export function getMyOrder(reference: string): Promise<MyOrder> {
  return apiFetch(`/api/payments/orders/${encodeURIComponent(reference)}`)
}

export function listMyOrders(): Promise<MyOrder[]> {
  return apiFetch('/api/payments/orders/me')
}
