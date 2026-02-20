import { createRouter, createWebHistory } from 'vue-router'
import Bookshelf from '@/views/Bookshelf.vue'
import UnifiedReaderView from '@/views/UnifiedReaderView.vue'

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
    }
  ]
})

export default router
