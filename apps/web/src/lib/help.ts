import type { Component } from 'vue'
import { Award, BookOpen, Compass, Cpu, PenLine, Radio, Rocket, UserCog } from 'lucide-vue-next'

/** Help Center topics, in the order the backend sorts them (HelpTopics.All). */
export const HELP_TOPICS: Record<string, { label: string; icon: Component }> = {
  'getting-started': { label: 'Getting started', icon: Rocket },
  courses: { label: 'Courses and lessons', icon: BookOpen },
  assessments: { label: 'Quizzes and assignments', icon: PenLine },
  paths: { label: 'Learning paths', icon: Compass },
  'progress-certificates': { label: 'Progress and certificates', icon: Award },
  'live-and-events': { label: 'Live sessions, events and calendar', icon: Radio },
  'robotics-lab': { label: 'Robotics lab', icon: Cpu },
  account: { label: 'Your account', icon: UserCog },
}

export function helpTopicLabel(topic: string): string {
  return HELP_TOPICS[topic]?.label ?? topic
}

const PAGE_NAMES: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/courses': 'Courses',
  '/app/explore': 'Explore',
  '/app/explore?tab=paths': 'Learning Paths',
  '/app/live-sessions': 'Live Sessions',
  '/app/calendar': 'Calendar',
  '/app/events': 'Events',
  '/app/progress': 'Progress',
  '/app/certificates': 'Certificates',
  '/app/notifications': 'Notifications',
  '/app/settings': 'Settings',
  '/app/profile': 'Profile',
}

/** Button label for an article's app link, e.g. "Go to Explore". */
export function helpLinkLabel(path: string): string {
  return `Go to ${PAGE_NAMES[path] ?? 'page'}`
}
