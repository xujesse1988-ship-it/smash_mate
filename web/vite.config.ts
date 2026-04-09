import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      clientPort: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/web'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心单独一个 chunk，体积小、缓存稳定
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Ant Design 体积最大，单独拆出，不影响其他 chunk 缓存
          'vendor-antd': ['antd', '@ant-design/icons'],
          // 数据请求库
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
});
