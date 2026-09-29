import { LayoutGrid, BookOpen, Radio, Compass, CalendarDays, Ticket } from 'lucide-vue-next'

// `mobile: false` keeps an item out of the phone bottom bar, which only fits five.
export const mainNav = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutGrid, path: '/app' },
  { id: 'courses',     label: 'Courses', icon: BookOpen, path: '/app/courses' },
  { id: 'explore',     label: 'Explore',      icon: Compass,    path: '/app/explore' },
  { id: 'live-sessions', label: 'Live Sessions', icon: Radio,   path: '/app/live-sessions' },
  { id: 'calendar',    label: 'Calendar',     icon: CalendarDays, path: '/app/calendar' },
  { id: 'events',      label: 'Events',       icon: Ticket,     path: '/app/events', mobile: false },
]
