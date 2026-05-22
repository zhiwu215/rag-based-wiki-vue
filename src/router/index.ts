import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginPage.vue'),
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('@/views/RegisterPage.vue'),
    },
    {
      path: '/',
      name: 'Home',
      component: () => import('@/views/KnowledgeBaseList.vue'),
    },
    {
      path: '/knowledge-base/:id',
      name: 'DocumentList',
      component: () => import('@/views/DocumentList.vue'),
    },
    {
      path: '/knowledge-base/:id/chat',
      name: 'Chat',
      component: () => import('@/views/ChatPage.vue'),
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if ((!token || token === 'undefined') && to.path !== '/login' && to.path !== '/register') {
    next('/login')
  } else {
    next()
  }
})

export default router
