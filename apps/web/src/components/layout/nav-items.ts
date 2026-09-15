import { LayoutGrid, BookOpen, Radio, Compass } from 'lucide-vue-next'

export const mainNav = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutGrid, path: '/app' },
  { id: 'courses',     label: 'Enrolled Courses', icon: BookOpen, path: '/app/courses' },
  { id: 'explore',     label: 'Explore',      icon: Compass,    path: '/app/explore' },
  { id: 'live-sessions', label: 'Live Sessions', icon: Radio,   path: '/app/live-sessions' },
]
