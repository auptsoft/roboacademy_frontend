import type { InjectionKey, Ref } from 'vue'
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

function validHex(value: string | null): string | null {
  return value && HEX_COLOR.test(value) ? value : null
}

// Writes the tenant's raw colours onto <html> as --tenant-* inputs; style.css derives the
// per-theme palette from them (inline values would otherwise override both light and dark).
//   primary   → structure: navy surfaces, ribbons, headings, links
//   secondary → accent: CTA buttons (--brand-blue), card strips, active indicators
// Missing colours leave the CSS defaults in place; with no secondary, CTAs use the primary.
export function applyTenantBranding(branding: TenantBranding): void {
  applyDocumentTitle(branding.name)
  applyFavicon(branding.logoUrl)

  const root = document.documentElement.style
  const primary = validHex(branding.primaryColor)
  const secondary = validHex(branding.secondaryColor)

  if (primary) {
    const primaryFg = contrastingForeground(primary)
    root.setProperty('--tenant-primary', primary)
    root.setProperty('--tenant-primary-fg', primaryFg)
    // Only use the primary as heading/link text when it's dark enough to read on white.
    if (primaryFg === '#ffffff') root.setProperty('--tenant-heading', primary)
  }

  if (secondary) {
    root.setProperty('--tenant-secondary', secondary)
    root.setProperty('--tenant-secondary-fg', contrastingForeground(secondary))
  }

  const cta = secondary ?? primary
  if (cta) {
    root.setProperty('--brand-blue', cta)
    root.setProperty('--brand-blue-foreground', contrastingForeground(cta))
  }
}

// Provided by app-layout once branding loads, so pages (e.g. the dashboard hero) can use it
// without refetching.
export const brandingKey: InjectionKey<Ref<TenantBranding>> = Symbol('tenant-branding')
