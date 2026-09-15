
import { isAuthenticated } from "@/store/auth"
import {createRouter, createWebHistory} from "vue-router"

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
                    path: 'settings',
                    component: () => import("@/pages/app/settings.vue")
                }
            ]
        },

        {
            path: '/:pathMatch(.*)*',
            component: () => import("@/pages/not-found.vue")
        }
    ]
})

router.beforeEach((to) => {
  if ((to.path !== '/auth' && to.path !== '/landing') && !isAuthenticated()) {
    return '/auth'
  }
  if (to.path === '/auth' && isAuthenticated()) {
    return '/app'
  }
})

export default router