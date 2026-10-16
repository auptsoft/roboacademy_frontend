import { LayoutGrid, BookOpen, Radio, Compass, CalendarDays, Ticket, Bot } from 'lucide-vue-next'

import type { TenantBranding } from '@/api/tenancy'
import { hasFeature } from '@/branding'

// `mobile: false` keeps an item out of the phone bottom bar, which only fits five.
// `feature` hides an item when the school's plan doesn't include that area.
export const mainNav: { id: string; label: string; icon: typeof LayoutGrid; path: string; mobile?: boolean; feature?: string }[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutGrid, path: '/app' },
  { id: 'courses',     label: 'Courses', icon: BookOpen, path: '/app/courses' },
  { id: 'explore',     label: 'Explore',      icon: Compass,    path: '/app/explore' },
  { id: 'live-sessions', label: 'Live Sessions', icon: Radio,   path: '/app/live-sessions', feature: 'live_classes' },
  { id: 'calendar',    label: 'Calendar',     icon: CalendarDays, path: '/app/calendar' },
  { id: 'events',      label: 'Events',       icon: Ticket,     path: '/app/events', mobile: false, feature: 'events' },
  { id: 'robot-lab',   label: 'Robot lab',    icon: Bot,        path: '/app/lab-sessions', mobile: false, feature: 'robotics_lab' },
]

export function navFor(branding: TenantBranding | null | undefined) {
  return mainNav.filter((item) => !item.feature || hasFeature(branding, item.feature))
}
