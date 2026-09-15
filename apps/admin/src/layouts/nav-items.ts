import {
  LayoutGrid, Users, Building2, Settings2, GraduationCap, ScrollText,
  BookOpen, Route, Video, ClipboardList, HelpCircle, FileQuestion, Bot, BadgeCheck, ClipboardCheck,
  UserCheck,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import { getActiveTenantId } from '@/store/auth'

const PLATFORM_TENANT_ID = import.meta.env.VITE_PLATFORM_TENANT_ID

export interface AdminNavLeaf {
  id: string
  label: string
  icon: Component
  // A function defers resolution to render time - needed for entries whose target depends on
  // which tenant is currently active (e.g. "School Setup" while impersonating another tenant).
  path: string | (() => string)
  permission?: string
  // Hides this entry while viewing another tenant via enterTenant - for platform-wide screens
  // (e.g. the full Tenants list) that don't make sense to reach mid-impersonation.
  hiddenWhileImpersonating?: boolean
}

export interface AdminNavGroup {
  id: string
  label: string
  icon: Component
  items: AdminNavLeaf[]
}

export type AdminNavEntry = AdminNavLeaf | AdminNavGroup

export function isNavGroup(entry: AdminNavEntry): entry is AdminNavGroup {
  return 'items' in entry
}

export const adminNav: AdminNavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, path: '/' },
   // Points at whichever tenant is currently active (home tenant, or the tenant currently being
  // impersonated via enterTenant - see store/auth.ts#getActiveTenantId) — the only path a
  // ManageOwn-only caller (e.g. SchoolAdmin) has into tenant setup, since the full Tenants list
  // above requires platform-wide tenancy:manage. Resolved lazily (a function, not a string) so it
  // stays correct across enterTenant/exitTenant without re-importing this module.
  {
    id: 'my-tenant',
    label: 'School Setup',
    icon: Settings2,
    path: () => `/tenants/${getActiveTenantId() || PLATFORM_TENANT_ID}`,
    permission: 'tenancy:manage-own',
  },
  { id: 'users', label: 'Users', icon: Users, path: '/users', permission: 'identity:users:manage' },
  { id: 'classes', label: 'Classes', icon: GraduationCap, path: '/classes', permission: 'identity:classes:manage' },
  {
    id: 'learning',
    label: 'Learning',
    icon: BookOpen,
    items: [
      { id: 'courses', label: 'Courses', icon: BookOpen, path: '/courses', permission: 'learning:courses:author' },
      { id: 'paths', label: 'Learning Paths', icon: Route, path: '/paths', permission: 'learning:courses:author' },
      { id: 'live-classes', label: 'Live Classes', icon: Video, path: '/live-classes', permission: 'learning:courses:author' },
      { id: 'enrollments', label: 'Enrollments', icon: UserCheck, path: '/enrollments', permission: 'learning:enrolments:manage' },
    ],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    icon: ClipboardList,
    items: [
      { id: 'question-bank', label: 'Question Bank', icon: FileQuestion, path: '/assessment/question-bank', permission: 'assessment:assessments:author' },
      { id: 'assessments', label: 'Assessments', icon: HelpCircle, path: '/assessment/assessments', permission: 'assessment:assessments:author' },
      { id: 'grading', label: 'Grading', icon: ClipboardCheck, path: '/assessment/grading', permission: 'assessment:assessments:author' },
    ],
  },
  {
    id: 'roboticslab',
    label: 'Robotics Lab',
    icon: Bot,
    items: [
      { id: 'sessions', label: 'Sessions', icon: Bot, path: '/roboticslab/sessions', permission: 'roboticslab:robots:manage' },
    ],
  },
  { id: 'certificates', label: 'Certificates', icon: BadgeCheck, path: '/certificates', permission: 'certification:certificates:issue' },
  { id: 'tenants', label: 'Tenants', icon: Building2, path: '/tenants', permission: 'tenancy:manage', hiddenWhileImpersonating: true },
  { id: 'audit', label: 'Audit Log', icon: ScrollText, path: '/audit', permission: 'identity:audit:view' },
]
