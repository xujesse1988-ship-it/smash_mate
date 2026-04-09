import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, message, Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { getAllUsers, User } from '../api/user-management-api';

const { Title } = Typography;

export function UserManagementPage() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err: any) {
      message.error(err.message || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const columns = [
    {
      title: '用户 ID',
      dataIndex: 'id',
      key: 'id',
      width: 320,
    },
    {
      title: '头像',
      dataIndex: 'avatarUrl',
      key: 'avatarUrl',
      width: 80,
      render: (avatarUrl: string | null) => (
        <Avatar src={avatarUrl} icon={<UserOutlined />} />
      ),
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
    },
    {
      title: '角色',
      dataIndex: 'isCoach',
      key: 'isCoach',
      width: 120,
      render: (isCoach: boolean) => (
        <Tag color={isCoach ? 'cyan' : 'default'}>{isCoach ? '教练' : '普通用户'}</Tag>
      ),
    },
    {
      title: '个人简介',
      dataIndex: 'bio',
      key: 'bio',
      ellipsis: true,
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ padding: 24, margin: '0 auto', maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>用户管理</Title>
      </div>

      <Card>
        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 10,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>
    </div>
  );
}
