import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '@/store/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('@/pages/login.vue'),
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
          path: 'courses',
          component: () => import('@/pages/courses/index.vue'),
        },
        {
          path: 'courses/:courseId',
          component: () => import('@/pages/courses/detail.vue'),
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
          path: 'roboticslab/sessions',
          component: () => import('@/pages/roboticslab/sessions.vue'),
        },
        {
          path: 'certificates',
          component: () => import('@/pages/certificates.vue'),
        },
        {
          path: 'audit',
          component: () => import('@/pages/audit.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  if (to.path !== '/login' && !isAuthenticated()) {
    return '/login'
  }
  if (to.path === '/login' && isAuthenticated()) {
    return '/'
  }
})

export default router
