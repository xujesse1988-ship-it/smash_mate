import React, { useState } from 'react';
import { Table, Tag, Avatar, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useApplicationList } from '../hooks/useApplicationList';

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
};

export function CoachReviewListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, error } = useApplicationList({
    status: statusFilter,
    page,
    pageSize,
  });

  const columns = [
    {
      title: '申请人',
      key: 'applicant',
      render: (_: unknown, record: { nickname: string; avatarUrl: string | null }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar src={record.avatarUrl} size="small">
            {record.nickname?.charAt(0)}
          </Avatar>
          <span>{record.nickname}</span>
        </div>
      ),
    },
    {
      title: '证书数量',
      key: 'certificates',
      render: (_: unknown, record: { certificateUrls: string[] }) =>
        `${record.certificateUrls.length} 张`,
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = STATUS_MAP[status] || { label: status, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => formatDate(text),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: { id: string }) => (
        <a onClick={() => navigate(`/coach-review/${record.id}`)}>查看详情</a>
      ),
    },
  ];

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>教练审核</h2>
        <div style={{ textAlign: 'center', padding: 48 }}>加载失败，请刷新重试</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>教练审核</h2>

      <Tabs
        activeKey={statusFilter || 'all'}
        onChange={(key) => {
          setStatusFilter(key === 'all' ? undefined : key);
          setPage(1);
        }}
        items={[
          { key: 'all', label: '全部' },
          { key: 'pending', label: '待审核' },
          { key: 'approved', label: '已通过' },
          { key: 'rejected', label: '已拒绝' },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={data?.items}
        rowKey="id"
        loading={isLoading}
        onRow={(record) => ({
          onClick: () => navigate(`/coach-review/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: page,
          pageSize,
          total: data?.total,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </div>
  );
}
