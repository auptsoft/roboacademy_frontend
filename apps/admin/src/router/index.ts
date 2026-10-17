import { createRouter, createWebHistory } from 'vue-router'
import { getActiveTenantId, isAuthenticated } from '@/store/auth'
import { getEnv } from '@/lib/runtime-env'
import { captureTenantFromQuery } from '@/lib/tenant-from-url'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('@/pages/login.vue'),
    },
    {
      path: '/subscription-expired',
      component: () => import('@/pages/subscription-expired.vue'),
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      children: [
        {
          path: '',
          
          component: () => import('@/pages/dashboard.vue'),
        },
        {
          path: 'tenants',
          component: () => import('@/pages/tenants/index.vue'),
        },
        {
          path: 'tenants/:tenantId',
          component: () => import('@/pages/tenants/setup.vue'),
        },
        {
          path: 'plans',
          component: () => import('@/pages/plans/index.vue'),
        },
        {
          path: 'plans/:planId',
          component: () => import('@/pages/plans/detail.vue'),
        },
        {
          path: 'ai-models',
          component: () => import('@/pages/ai-models.vue'),
        },
        {
          path: 'payments/providers',
          component: () => import('@/pages/payments/providers.vue'),
        },
        {
          path: 'payments/orders',
          component: () => import('@/pages/payments/orders.vue'),
        },
        {
          path: 'payments/payouts',
          component: () => import('@/pages/payments/payouts.vue'),
        },
        {
          path: 'payments/payout',
          component: () => import('@/pages/payments/payout.vue'),
        },
        {
          path: 'gamification',
          component: () => import('@/pages/gamification/index.vue'),
        },
        {
          path: 'community/moderation',
          component: () => import('@/pages/community/moderation.vue'),
        },
        {
          path: 'community/settings',
          component: () => import('@/pages/community/settings.vue'),
        },
        {
          path: 'community/chat',
          component: () => import('@/pages/community/chat-moderation.vue'),
        },
        {
          path: 'community/groups',
          component: () => import('@/pages/community/groups.vue'),
        },
        {
          path: 'payments/sales',
          component: () => import('@/pages/payments/sales.vue'),
        },
        {
          path: 'payments/refunds',
          component: () => import('@/pages/payments/refunds.vue'),
        },
        {
          path: 'payments/reconciliation',
          component: () => import('@/pages/payments/reconciliation.vue'),
        },
        {
          path: 'users',
          component: () => import('@/pages/users.vue'),
        },
        {
          path: 'profile',
          component: () => import('@/pages/profile.vue'),
        },
        {
          path: 'classes',
          component: () => import('@/pages/classes.vue'),
        },
        {
          path: 'classes/:classId',
          component: () => import('@/pages/classes/detail.vue'),
        },
        {
          path: 'courses',
          component: () => import('@/pages/courses/index.vue'),
        },
        {
          path: 'courses/:courseId',
          component: () => import('@/pages/courses/detail.vue'),
        },
        {
          path: 'courses/:courseId/modules/:moduleId/lessons/:lessonId/content',
          component: () => import('@/pages/courses/lesson-content.vue'),
        },
        {
          path: 'enrollments',
          component: () => import('@/pages/enrollments/index.vue'),
        },
        {
          path: 'paths',
          component: () => import('@/pages/paths/index.vue'),
        },
        {
          path: 'paths/:pathId',
          component: () => import('@/pages/paths/detail.vue'),
        },
        {
          path: 'live-classes',
          component: () => import('@/pages/live-classes/index.vue'),
        },
        {
          path: 'events',
          component: () => import('@/pages/events/index.vue'),
        },
        {
          path: 'calendar',
          component: () => import('@/pages/calendar.vue'),
        },
        {
          path: 'announcements',
          component: () => import('@/pages/announcements/index.vue'),
        },
        {
          path: 'events/:eventId',
          component: () => import('@/pages/events/detail.vue'),
        },
        {
          path: 'assessment/question-bank',
          component: () => import('@/pages/assessment/question-bank.vue'),
        },
        {
          path: 'assessment/assessments',
          component: () => import('@/pages/assessment/assessments/index.vue'),
        },
        {
          path: 'assessment/assessments/:assessmentId',
          component: () => import('@/pages/assessment/assessments/detail.vue'),
        },
        {
          path: 'assessment/grading',
          component: () => import('@/pages/assessment/grading/index.vue'),
        },
        {
          path: 'roboticslab/lab-sessions',
          component: () => import('@/pages/roboticslab/lab-sessions.vue'),
        },
        {
          path: 'roboticslab/lab-sessions/:labSessionId',
          component: () => import('@/pages/roboticslab/lab-session-detail.vue'),
        },
        {
          path: 'roboticslab/own-provider',
          component: () => import('@/pages/roboticslab/own-provider.vue'),
        },
        {
          path: 'roboticslab/own-slots',
          component: () => import('@/pages/roboticslab/own-slots.vue'),
        },
        {
          path: 'roboticslab/providers',
          component: () => import('@/pages/roboticslab/providers.vue'),
        },
        {
          path: 'roboticslab/slots',
          component: () => import('@/pages/roboticslab/slots.vue'),
        },
        {
          path: 'roboticslab/scenes',
          component: () => import('@/pages/roboticslab/scenes.vue'),
        },
        {
          path: 'roboticslab/scenes/:sceneId',
          component: () => import('@/pages/roboticslab/scene-editor.vue'),
        },
        {
          path: 'certificates',
          component: () => import('@/pages/certificates.vue'),
        },
        {
          path: 'audit',
          component: () => import('@/pages/audit.vue'),
        },
        {
          path: 'help',
          component: () => import('@/pages/help/index.vue'),
        },
        {
          path: 'help/:slug',
          component: () => import('@/pages/help/detail.vue'),
        },
        {
          // A stable address for "your school's setup" (help guides link here); the real page is
          // per tenant, and follows enterTenant like the School Setup menu entry.
          path: 'school-setup',
          redirect: () => `/tenants/${getActiveTenantId() || getEnv('VITE_PLATFORM_TENANT_ID')}`,
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  // First, before the redirects below drop the query (e.g. /?t=<slug> -> /login).
  if (to.query.t || to.query.tenantId) await captureTenantFromQuery(to.query)

  if (to.path !== '/login' && !isAuthenticated()) {
    return '/login'
  }
  if (to.path === '/login' && isAuthenticated()) {
    return '/'
  }
})

export default router
