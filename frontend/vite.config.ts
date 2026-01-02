import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 获取后端地址，优先使用环境变量，否则使用localhost
  const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:8000';
  
  return {
    plugins: [react()],
    server: {
      port: 3000,
      // host 默认为 'localhost'，使用 --host 参数时会自动设置为 '0.0.0.0' 允许外网访问
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          // 如果后端在不同机器，需要配置这个
          rewrite: (path) => path,
        },
      },
    },
  };
})

