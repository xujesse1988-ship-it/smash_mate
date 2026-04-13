import React from 'react';
import { Layout, Menu, Button } from 'antd';
import { EnvironmentOutlined, ShopOutlined, TeamOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdminUser } from '../hooks/useAdminUser';

const { Header, Sider, Content } = Layout;

function maskPhone(phone: string): string {
  if (phone.length === 11) {
    return `${phone.slice(0, 3)}****${phone.slice(7)}`;
  }
  return phone;
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAdminAuth();
  const adminUser = useAdminUser();

  const menuItems = [
    {
      key: '/cities',
      icon: <EnvironmentOutlined />,
      label: '城市管理',
    },
    {
      key: '/venues',
      icon: <ShopOutlined />,
      label: '球馆管理',
    },
    {
      key: '/users',
      icon: <TeamOutlined />,
      label: '用户管理',
    },
    {
      key: '/coach-review',
      icon: <SafetyCertificateOutlined />,
      label: '教练审核',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#001529',
          padding: '0 24px',
        }}
      >
        <h1 style={{ color: '#fff', margin: 0, fontSize: 18 }}>羽约管理后台</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {adminUser.data && (
            <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
              {maskPhone(adminUser.data.phone)}
            </span>
          )}
          <Button type="link" onClick={logout} style={{ color: '#fff' }}>
            退出登录
          </Button>
        </div>
      </Header>
      <Layout>
        <Sider width={200}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Content style={{ background: '#fff', minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
