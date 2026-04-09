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
    port: 5174,
    hmr: {
      clientPort: 5174,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/admin'),
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: [
      'antd/es/button',
      'antd/es/input',
      'antd/es/form',
      'antd/es/table',
      'antd/es/card',
      'antd/es/message',
      'antd/es/spin',
      'antd/es/tag',
      'antd/es/avatar',
      'antd/es/modal',
      'antd/es/select',
      'antd/es/layout',
      'antd/es/menu',
      'antd/es/config-provider',
      '@ant-design/icons/es/icons/EnvironmentOutlined',
      '@ant-design/icons/es/icons/ShopOutlined',
      '@ant-design/icons/es/icons/TeamOutlined',
      '@ant-design/icons/es/icons/UserOutlined',
    ],
  },
});
