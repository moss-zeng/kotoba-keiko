import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      // 前端的 /api 请求转发给本地 wrangler（提供 Functions + D1）
      '/api': 'http://127.0.0.1:8788',
    },
  },
})
