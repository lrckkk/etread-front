import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'
import path from 'path' // 记得先 npm install @types/node -D 喔

export default defineConfig({
  plugins: [
    vue(),
    VueDevTools()  // 启用 Vue Devtools
  ],
  resolve: {
    alias: {
      // 以后用 @ 就直接代表 src 目录啦，不用写长长的路径
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000, // 咱们前端住在 3000 端口
    proxy: {
      // 以后碰到 /api 开头的请求，就悄悄转交给后端妈妈
      '/api': {
        target: 'http://localhost:9000', // 网关的地址
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
})