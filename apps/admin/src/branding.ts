import { ref } from 'vue'
import { applyDocumentTitle, applyFavicon } from '@roboacademy/ui'
import { getTenantId } from '@/api/client'
import { getTenantBranding } from '@/api/tenancy'

const TITLE_SUFFIX = 'Admin'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

// Read by AdminLayout/AdminSidebar/login.vue to show the tenant's logo in place of the default
// Shield mark. Null until applyTenantBranding resolves, or if the tenant has no logo set.
export const tenantLogoUrl = ref<string | null>(null)

// Picks black or white text for legibility on top of an arbitrary background color,
// via the standard relative-luminance threshold (WCAG-style, simplified).
function contrastingForeground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#0b0f19' : '#ffffff'
}

function resetBrandColors(): void {
  const root = document.documentElement.style
  root.removeProperty('--primary')
  root.removeProperty('--primary-foreground')
  root.removeProperty('--secondary')
  root.removeProperty('--secondary-foreground')
}

// Applies the current tenant's brand colors as the admin app's primary/secondary colors. Falls
// back to the CSS defaults (see style.css) when the tenant has no custom color set, or the
// request fails - this must actively reset any previously-applied override (not just skip
// setting a new one), since this now also runs when switching tenants via enterTenant/exitTenant,
// not just once at login.
export async function applyTenantBranding(): Promise<void> {
  try {
    const branding = await getTenantBranding(getTenantId())
    const root = document.documentElement.style
    if (branding.primaryColor && HEX_COLOR.test(branding.primaryColor)) {
      root.setProperty('--primary', branding.primaryColor)
      root.setProperty('--primary-foreground', contrastingForeground(branding.primaryColor))
    } else {
      root.removeProperty('--primary')
      root.removeProperty('--primary-foreground')
    }
    if (branding.secondaryColor && HEX_COLOR.test(branding.secondaryColor)) {
      root.setProperty('--secondary', branding.secondaryColor)
      root.setProperty('--secondary-foreground', contrastingForeground(branding.secondaryColor))
    } else {
      root.removeProperty('--secondary')
      root.removeProperty('--secondary-foreground')
    }
    tenantLogoUrl.value = branding.logoUrl
    applyDocumentTitle(branding.name, { suffix: TITLE_SUFFIX })
    applyFavicon(branding.logoUrl)
  } catch {
    // No branding available (e.g. anonymous/platform tenant, or a network error) — reset to default
    // rather than leaving a previously-active tenant's branding applied.
    resetBrandColors()
    tenantLogoUrl.value = null
    applyDocumentTitle(null, { suffix: TITLE_SUFFIX })
    applyFavicon(null)
  }
}
