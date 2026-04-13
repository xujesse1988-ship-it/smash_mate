import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { AppRoutes } from './routes';
import './styles/theme.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

const theme = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#4ADE80',
    colorBgContainer: '#1E293B',
    colorBgElevated: '#334155',
    colorBorder: '#334155',
    colorText: '#F1F5F9',
    colorTextSecondary: '#94A3B8',
    borderRadius: 14,
    fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={theme}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
