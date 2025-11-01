import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
        {
            path: '/',
            name: 'chat',
            component: () => import('./views/ChatView.vue'),
            meta: { requiresAuth: false } 
        },
         {
            path: '/sign-in',
            name: 'signin',
            component: () => import('./views/LoginView.vue'),
            meta: { requiresAuth: false } 
        },
         {
            path: '/create-account',
            name: 'signup',
            component: () => import('./views/SignupView.vue'),
            meta: { requiresAuth: false } 
        },
         {
            path: '/about',
            name: 'about',
            component: () => import('./views/AboutView.vue'),
            meta: { requiresAuth: false } 
        },
         {
            path: '/auto-signin',
            name: 'autosignin',
            component: () => import('./views/AutoSignInView.vue'),
            meta: { requiresAuth: false } 
        }
    ],
    scrollBehavior (to) {
        if (to.hash) {
            return {
                selector: to.hash
            }
        }
        return { x: 0, y: 0 }
    }
})  

export default router;
