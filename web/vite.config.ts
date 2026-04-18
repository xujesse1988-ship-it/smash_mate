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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
              return 'vendor-react';
            }
            if (/node_modules\/(antd|@ant-design)\//.test(id)) {
              return 'vendor-antd';
            }
            if (/node_modules\/@tanstack\//.test(id)) {
              return 'vendor-query';
            }
          }
        },
      },
    },
  },
  // 开发模式：明确告知 Vite 预构建 antd 各子模块，避免整包打进一个 9MB 文件
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
      'antd/es/checkbox',
      'antd/es/modal',
      'antd/es/select',
      'antd/es/typography',
      'antd/es/layout',
      'antd/es/menu',
      'antd/es/config-provider',
      '@ant-design/icons/es/icons/UserOutlined',
      '@ant-design/icons/es/icons/BellOutlined',
      '@ant-design/icons/es/icons/EnvironmentOutlined',
      '@ant-design/icons/es/icons/ShopOutlined',
      '@ant-design/icons/es/icons/TeamOutlined',
      '@ant-design/icons/es/icons/LeftOutlined',
      '@ant-design/icons/es/icons/RightOutlined',
      '@ant-design/icons/es/icons/PlusOutlined',
      '@ant-design/icons/es/icons/SyncOutlined',
    ],
  },
});
