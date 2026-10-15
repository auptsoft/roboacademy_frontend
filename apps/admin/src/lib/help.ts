import type { Component } from 'vue'
import {
  BadgeCheck, Bot, BookOpen, Building2, CalendarDays, ClipboardList, Compass, Layers, Library, Rocket,
  Settings2, Sparkles, Users,
} from 'lucide-vue-next'

/** Guide topics in the backend's order (HelpTopics.For): staff topics, then platform ones. */
export const HELP_TOPICS: Record<string, { label: string; icon: Component }> = {
  'getting-started': { label: 'Getting started', icon: Rocket },
  'users-and-classes': { label: 'Users and classes', icon: Users },
  courses: { label: 'Courses and enrolments', icon: BookOpen },
  assessments: { label: 'Assessments and grading', icon: ClipboardList },
  paths: { label: 'Learning paths', icon: Compass },
  'live-and-events': { label: 'Live classes, events and announcements', icon: CalendarDays },
  certificates: { label: 'Certificates', icon: BadgeCheck },
  'school-setup': { label: 'School setup', icon: Settings2 },
  ai: { label: 'AI features', icon: Sparkles },
  'robotics-lab': { label: 'Robotics lab', icon: Bot },
  tenants: { label: 'Schools (platform)', icon: Building2 },
  plans: { label: 'Plans (platform)', icon: Layers },
  'ai-models': { label: 'AI models (platform)', icon: Sparkles },
  'content-library': { label: 'Content library (platform)', icon: Library },
}

export function helpTopicLabel(topic: string): string {
  return HELP_TOPICS[topic]?.label ?? topic
}

const PAGE_NAMES: Record<string, string> = {
  '/': 'Dashboard',
  '/school-setup': 'School Setup',
  '/users': 'Users',
  '/classes': 'Classes',
  '/courses': 'Courses',
  '/paths': 'Learning Paths',
  '/live-classes': 'Live Classes',
  '/enrollments': 'Enrolments',
  '/assessment/question-bank': 'Question Bank',
  '/assessment/assessments': 'Assessments',
  '/assessment/grading': 'Grading',
  '/roboticslab/sessions': 'Robotics Lab',
  '/roboticslab/scenes': 'Robotics Lab',
  '/events': 'Events',
  '/calendar': 'Calendar',
  '/announcements': 'Announcements',
  '/certificates': 'Certificates',
  '/tenants': 'Tenants',
  '/plans': 'Plans',
  '/ai-models': 'AI Models',
  '/audit': 'Audit Log',
  '/profile': 'Profile',
}

/** Button label for a guide's app link, e.g. "Go to Grading". */
export function helpLinkLabel(path: string): string {
  return `Go to ${PAGE_NAMES[path] ?? 'page'}`
}
