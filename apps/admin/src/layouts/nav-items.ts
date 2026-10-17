import {
  LayoutGrid, Users, Building2, Settings2, GraduationCap, ScrollText,
  BookOpen, Route, Video, ClipboardList, HelpCircle, FileQuestion, Bot, BadgeCheck, ClipboardCheck,
  UserCheck, CalendarDays, CalendarRange, Megaphone, Layers, Sparkles, LifeBuoy, Boxes, CreditCard, Receipt, Landmark, Undo2, Scale, Trophy,
  MessagesSquare, ShieldCheck, MessageCircle, UsersRound,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import { getActiveTenantId } from '@/store/auth'
import { getEnv } from '@/lib/runtime-env'

const PLATFORM_TENANT_ID = getEnv('VITE_PLATFORM_TENANT_ID')

export interface AdminNavLeaf {
  id: string
  label: string
  icon: Component
  // A function defers resolution to render time - needed for entries whose target depends on
  // which tenant is currently active (e.g. "School Setup" while impersonating another tenant).
  path: string | (() => string)
  // Any one of these grants visibility (e.g. Courses: authors, and school admins who only
  // manage visibility).
  permission?: string | string[]
  // Hides this entry while viewing another tenant via enterTenant - for platform-wide screens
  // (e.g. the full Tenants list) that don't make sense to reach mid-impersonation.
  hiddenWhileImpersonating?: boolean
  // For a school's own screens that platform operators hold every permission for but have no use
  // for at home (they manage the platform's equivalents). Still shown while viewing a school.
  schoolOnly?: boolean
  // A plan feature key (see the backend's PlanFeatureKeys), or several of which any one will do.
  // Hidden when the active tenant's plan doesn't include it - the API rejects those calls anyway.
  feature?: string | string[]
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
  // Teachers see the classes they're staff on, read-only (the API filters the list).
  { id: 'classes', label: 'Classes', icon: GraduationCap, path: '/classes', permission: ['identity:classes:manage', 'learning:courses:author'] },
  {
    id: 'learning',
    label: 'Learning',
    icon: BookOpen,
    items: [
      { id: 'courses', label: 'Courses', icon: BookOpen, path: '/courses', permission: ['learning:courses:author', 'learning:courses:manage-visibility'] },
      { id: 'paths', label: 'Learning Paths', icon: Route, path: '/paths', permission: 'learning:courses:author', feature: 'learning_paths' },
      { id: 'live-classes', label: 'Live Classes', icon: Video, path: '/live-classes', permission: 'learning:courses:author', feature: 'live_classes' },
      { id: 'enrollments', label: 'Enrolments', icon: UserCheck, path: '/enrollments', permission: 'learning:enrolments:manage' },
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
      { id: 'lab-sessions', label: 'Lab Sessions', icon: Bot, path: '/roboticslab/lab-sessions', permission: ['roboticslab:labsessions:manage', 'roboticslab:labsessions:approve-class'], feature: 'robotics_lab' },
      { id: 'own-slots', label: 'Our Robot Time', icon: CalendarRange, path: '/roboticslab/own-slots', permission: 'roboticslab:providers:manage-own', feature: 'robotics_lab_own_providers', schoolOnly: true },
      { id: 'own-provider', label: 'Our botnova Account', icon: Settings2, path: '/roboticslab/own-provider', permission: 'roboticslab:providers:manage-own', feature: 'robotics_lab_own_providers', schoolOnly: true },
      { id: 'scenes', label: 'Simulation Scenes', icon: Boxes, path: '/roboticslab/scenes', permission: 'roboticslab:scenes:author', feature: 'robotics_lab' },
      { id: 'lab-slots', label: 'Robot Lab Slots', icon: CalendarRange, path: '/roboticslab/slots', permission: 'roboticslab:slots:manage' },
      { id: 'lab-providers', label: 'Robot Lab Providers', icon: Settings2, path: '/roboticslab/providers', permission: 'roboticslab:providers:manage' },
    ],
  },
  { id: 'events', label: 'Events', icon: CalendarDays, path: '/events', permission: 'scheduling:events:manage', feature: 'events' },
  { id: 'calendar', label: 'Calendar', icon: CalendarRange, path: '/calendar', permission: 'scheduling:events:manage' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, path: '/announcements', permission: 'notifications:announcements:manage', feature: 'announcements' },
  { id: 'certificates', label: 'Certificates', icon: BadgeCheck, path: '/certificates', permission: 'certification:certificates:issue', feature: 'certificates' },
  { id: 'gamification', label: 'Achievements', icon: Trophy, path: '/gamification', permission: ['gamification:settings:manage', 'gamification:badges:manage'], feature: 'gamification' },
  {
    id: 'community',
    label: 'Community',
    icon: MessagesSquare,
    items: [
      { id: 'community-moderation', label: 'Moderation', icon: ShieldCheck, path: '/community/moderation', permission: 'community:moderate', feature: ['community_board', 'community_qa', 'community_study_groups'] },
      { id: 'community-chat', label: 'Chat moderation', icon: MessageCircle, path: '/community/chat', permission: 'community:moderate', feature: ['community_group_chat', 'community_direct_messages'] },
      { id: 'community-groups', label: 'Study groups', icon: UsersRound, path: '/community/groups', permission: 'community:moderate', feature: 'community_study_groups' },
      { id: 'community-settings', label: 'Settings', icon: Settings2, path: '/community/settings', permission: 'community:settings:manage', feature: ['community_board', 'community_qa', 'community_study_groups', 'community_group_chat', 'community_direct_messages'] },
    ],
  },
  { id: 'tenants', label: 'Tenants', icon: Building2, path: '/tenants', permission: 'tenancy:manage', hiddenWhileImpersonating: true },
  { id: 'plans', label: 'Plans', icon: Layers, path: '/plans', permission: 'tenancy:plans:manage', hiddenWhileImpersonating: true },
  { id: 'ai-models', label: 'AI Models', icon: Sparkles, path: '/ai-models', permission: 'ai:models:manage', hiddenWhileImpersonating: true },
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    items: [
      // A school's own (Phase P2): only with paid_courses, and not at home for platform operators.
      { id: 'school-sales', label: 'Sales', icon: Receipt, path: '/payments/sales', permission: 'payments:manage-own', feature: 'paid_courses', schoolOnly: true },
      { id: 'school-payout', label: 'Payouts', icon: Landmark, path: '/payments/payout', permission: 'payments:manage-own', feature: 'paid_courses', schoolOnly: true },
      { id: 'payment-orders', label: 'Orders', icon: Receipt, path: '/payments/orders', permission: 'payments:manage', hiddenWhileImpersonating: true },
      { id: 'payment-refunds', label: 'Refunds', icon: Undo2, path: '/payments/refunds', permission: 'payments:manage', hiddenWhileImpersonating: true },
      { id: 'payment-reconciliation', label: 'Reconciliation', icon: Scale, path: '/payments/reconciliation', permission: 'payments:manage', hiddenWhileImpersonating: true },
      { id: 'payment-payouts', label: 'Fees & Payouts', icon: Landmark, path: '/payments/payouts', permission: 'payments:manage', hiddenWhileImpersonating: true },
      { id: 'payment-providers', label: 'Payment Providers', icon: Settings2, path: '/payments/providers', permission: 'payments:manage', hiddenWhileImpersonating: true },
    ],
  },
  { id: 'audit', label: 'Audit Log', icon: ScrollText, path: '/audit', permission: 'identity:audit:view' },
  { id: 'help', label: 'Help', icon: LifeBuoy, path: '/help' },
]
