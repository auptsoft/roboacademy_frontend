import { applyDocumentTitle, applyFavicon } from '@roboacademy/ui'
import type { TenantBranding } from '@/api/tenancy'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

// Picks black or white text for legibility on top of an arbitrary background color,
// via the standard relative-luminance threshold (WCAG-style, simplified).
function contrastingForeground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#0b0f19' : '#ffffff'
}

// Applies the tenant's brand color to the auth page's --brand-blue tokens. Falls back to the
// CSS defaults (see style.css) when the tenant has no custom primaryColor set.
export function applyTenantBranding(branding: TenantBranding): void {
  applyDocumentTitle(branding.name)
  applyFavicon(branding.logoUrl)

  if (!branding.primaryColor || !HEX_COLOR.test(branding.primaryColor)) {
    return
  }

  const root = document.documentElement.style
  root.setProperty('--brand-blue', branding.primaryColor)
  root.setProperty('--brand-blue-foreground', contrastingForeground(branding.primaryColor))

  const hover = branding.secondaryColor && HEX_COLOR.test(branding.secondaryColor)
    ? branding.secondaryColor
    : branding.primaryColor
  root.setProperty('--brand-blue-hover', hover)
}
