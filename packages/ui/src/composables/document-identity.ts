const DEFAULT_TITLE = 'RoboAcademy'
const DEFAULT_FAVICON_HREF = '/favicon.svg'
const DEFAULT_FAVICON_TYPE = 'image/svg+xml'

function getFaviconLink(): HTMLLinkElement {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
    }
    return link
}

// Swaps the tab favicon for the current tenant's logo, or restores the app default when the
// tenant has none (or branding failed to load) so a previous tenant's icon doesn't stick around.
export function applyFavicon(logoUrl: string | null | undefined): void {
    const link = getFaviconLink()
    if (logoUrl) {
        // Tenant logos may be png/jpg, not just svg - let the browser sniff the type.
        link.removeAttribute('type')
        link.href = logoUrl
    } else {
        link.type = DEFAULT_FAVICON_TYPE
        link.href = DEFAULT_FAVICON_HREF
    }
}

export function applyDocumentTitle(name: string | null | undefined, options?: { suffix?: string }): void {
    const base = name?.trim() || DEFAULT_TITLE
    document.title = options?.suffix ? `${base} ${options.suffix}` : base
}
