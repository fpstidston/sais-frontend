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
        }
    ]
})  

export default router;
