import { createRouter, createWebHistory } from 'vue-router'
import Bookshelf from '@/views/Bookshelf.vue'
import UnifiedReaderView from '@/views/UnifiedReaderView.vue'
import Auth from '@/views/Auth.vue'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'bookshelf',
      component: Bookshelf
    },
    {
      path: '/reader/:bookId',
      name: 'reader',
      component: UnifiedReaderView,
      props: true
    },
    {
      path: '/auth',
      name: 'auth',
      component: Auth
    }
  ]
})

export default router
