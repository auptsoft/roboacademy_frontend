import { LayoutGrid, BookOpen, Radio, Compass, CalendarDays, Ticket, Bot, Trophy, MessagesSquare, MessageCircle } from 'lucide-vue-next'

import type { TenantBranding } from '@/api/tenancy'
import { featureConfirmed, hasFeature } from '@/branding'

// `mobile: false` keeps an item out of the phone bottom bar, which only fits five.
// `feature` hides an item when the school's plan doesn't include that area (any of them, for a
// list). `strict` waits until the plan is known to show it - for areas that are off unless a plan
// switches them on.
export const mainNav: { id: string; label: string; icon: typeof LayoutGrid; path: string; mobile?: boolean; feature?: string | string[]; strict?: boolean }[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutGrid, path: '/app' },
  { id: 'courses',     label: 'Courses', icon: BookOpen, path: '/app/courses' },
  { id: 'explore',     label: 'Explore',      icon: Compass,    path: '/app/explore' },
  { id: 'live-sessions', label: 'Live Sessions', icon: Radio,   path: '/app/live-sessions', feature: 'live_classes' },
  { id: 'calendar',    label: 'Calendar',     icon: CalendarDays, path: '/app/calendar' },
  { id: 'events',      label: 'Events',       icon: Ticket,     path: '/app/events', mobile: false, feature: 'events' },
  { id: 'robot-lab',   label: 'Robot lab',    icon: Bot,        path: '/app/lab-sessions', mobile: false, feature: 'robotics_lab' },
  { id: 'achievements', label: 'Achievements', icon: Trophy,    path: '/app/achievements', mobile: false, feature: 'gamification' },
  { id: 'community',   label: 'Community',    icon: MessagesSquare, path: '/app/community', mobile: false, feature: ['community_board', 'community_qa', 'community_study_groups'], strict: true },
  { id: 'messages',    label: 'Messages',     icon: MessageCircle, path: '/app/community/chat', mobile: false, feature: ['community_group_chat', 'community_direct_messages'], strict: true },
]

export function navFor(branding: TenantBranding | null | undefined) {
  const on = (key: string, strict?: boolean) => (strict ? featureConfirmed(branding, key) : hasFeature(branding, key))
  return mainNav.filter((item) =>
    !item.feature || (Array.isArray(item.feature) ? item.feature : [item.feature]).some((key) => on(key, item.strict)))
}
