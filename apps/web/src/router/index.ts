
import { isAuthenticated } from "@/store/auth"
import {createRouter, createWebHistory} from "vue-router"
import { captureTenantFromQuery } from "@/lib/tenant-from-url"

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/landing',
            component: ()=> import("@/pages/landing.vue"),
        },

        {
            path: '/',
            redirect: '/auth'
        },

        {
            path: '/auth',
            component: ()=> import("@/pages/auth.vue")
        },

        {
            // Public certificate verification - reachable signed out (see beforeEach). /verify is
            // the original (longer) link format, kept so already-shared links keep working.
            path: '/v/:verificationId',
            alias: '/verify/:verificationId',
            component: () => import("@/pages/verify.vue"),
            meta: { public: true },
        },

        {
            // Terms of Service and Privacy Policy - public, linked from sign-up and every footer.
            path: '/terms',
            component: () => import("@/pages/legal.vue"),
            props: { document: 'terms' },
            meta: { public: true },
        },

        {
            path: '/privacy',
            component: () => import("@/pages/legal.vue"),
            props: { document: 'privacy' },
            meta: { public: true },
        },

        {
            // Printable certificate - outside app-layout so no app chrome reaches the page.
            path: '/certificates/:id',
            component: () => import("@/pages/certificate-print.vue"),
        },

        {
            path: '/app',
            component: () => import("@/pages/app-layout.vue"),
            children: [
                {
                    path: '',
                    component: () => import("@/pages/app/dashboard.vue")
                },

                {
                    path: 'courses',
                    component: () => import("@/pages/app/courses.vue")
                },

                {
                    path: 'courses/:id',
                    component: () => import("@/pages/app/course-detail.vue")
                },

                {
                    path: 'explore',
                    component: () => import("@/pages/app/explore.vue")
                },

                {
                    path: 'explore/courses/:id',
                    component: () => import("@/pages/app/course-details.vue")
                },

                {
                    path: 'explore/paths/:id',
                    component: () => import("@/pages/app/learning-path-details.vue")
                },

                {
                    path: 'live-sessions',
                    component: () => import("@/pages/app/live-sessions.vue")
                },

                {
                    path: 'live-sessions/:id',
                    component: () => import("@/pages/app/live-session-detail.vue")
                },

                {
                    path: 'progress',
                    component: () => import("@/pages/app/progress.vue")
                },

                {
                    path: 'profile',
                    component: () => import("@/pages/app/profile.vue")
                },

                {
                    path: 'events',
                    component: () => import("@/pages/app/events.vue")
                },

                {
                    path: 'events/:id',
                    component: () => import("@/pages/app/event-detail.vue")
                },

                {
                    path: 'calendar',
                    component: () => import("@/pages/app/calendar.vue")
                },

                {
                    path: 'lab-sessions',
                    component: () => import("@/pages/app/lab-sessions.vue")
                },

                {
                    path: 'lab-sessions/:id',
                    component: () => import("@/pages/app/lab-session-detail.vue")
                },

                {
                    path: 'certificates',
                    component: () => import("@/pages/app/certificates.vue")
                },

                {
                    path: 'notifications',
                    component: () => import("@/pages/app/notifications.vue")
                },

                {
                    path: 'settings',
                    component: () => import("@/pages/app/settings.vue")
                },

                {
                    path: 'payments/callback',
                    component: () => import("@/pages/app/payment-callback.vue")
                },

                {
                    path: 'help',
                    component: () => import("@/pages/app/help.vue")
                },

                {
                    path: 'help/:slug',
                    component: () => import("@/pages/app/help-article.vue")
                },

                ...(import.meta.env.DEV ? [{
                    path: 'dev/interactive-lesson',
                    component: () => import("@/pages/app/dev-interactive-lesson.vue")
                }] : [])
            ]
        },

        {
            path: '/:pathMatch(.*)*',
            component: () => import("@/pages/not-found.vue")
        }
    ]
})

router.beforeEach(async (to) => {
  // First, before the redirects below drop the query (e.g. /?t=<slug> -> /auth).
  if (to.query.t || to.query.tenantId) await captureTenantFromQuery(to.query)

  if (to.meta.public) return
  if ((to.path !== '/auth' && to.path !== '/landing') && !isAuthenticated()) {
    return '/auth'
  }
  if (to.path === '/auth' && isAuthenticated()) {
    return '/app'
  }
})

export default router