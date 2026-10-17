// Amounts travel as integers in the currency's minor unit (kobo for NGN), matching the API and the
// payment providers. These turn them into what people read, and back.

/** "₦5,000.00" for 500000 NGN; "USD 12.50" style for currencies without a symbol here. */
export function formatMoney(amountMinor: number, currency: string): string {
  const major = amountMinor / 100
  const number = major.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency === 'NGN' ? `₦${number}` : `${currency} ${number}`
}

/** "₦5,000" when there are no kobo, otherwise the full amount - for buttons and cards. */
export function formatPrice(amountMinor: number, currency: string): string {
  return amountMinor % 100 === 0
    ? formatMoney(amountMinor, currency).replace(/\.00$/, '')
    : formatMoney(amountMinor, currency)
}

/** Parses what someone typed in naira ("5000", "5,000.50") into kobo, or null when it isn't a number. */
export function toMinorUnits(major: string | number): number | null {
  const text = String(major).replace(/,/g, '').trim()
  if (text === '' || !/^\d+(\.\d{1,2})?$/.test(text)) return null
  return Math.round(Number(text) * 100)
}
