import React, { useState } from 'react';
import { Button, Table, Modal, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useCityList } from '../hooks/useCityList';
import { useAddCity } from '../hooks/useAddCity';

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

export function CityManagementPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [cityName, setCityName] = useState('');
  const [cityNameError, setCityNameError] = useState<string | null>(null);

  const cityList = useCityList({ page, pageSize });
  const addCity = useAddCity();

  const handleAddCity = () => {
    const trimmed = cityName.trim();
    if (!trimmed) {
      setCityNameError('请输入城市名称');
      return;
    }
    setCityNameError(null);
    addCity.mutate(trimmed, {
      onSuccess: () => {
        setAddModalVisible(false);
        setCityName('');
        setCityNameError(null);
      },
      onError: (err: unknown) => {
        const error = err as { code?: string };
        if (error.code === 'VENUE_CITY_DUPLICATE') {
          setCityNameError('该城市已存在');
        }
      },
    });
  };

  const columns = [
    {
      title: '城市名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '球馆数量',
      dataIndex: 'venueCount',
      key: 'venueCount',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => <span>{formatDate(text)}</span>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (text: string) => <span>{formatDate(text)}</span>,
    },
  ];

  if (cityList.error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>城市管理</h2>
        <div style={{ textAlign: 'center', padding: 48 }}>加载失败，请刷新重试</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>城市管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddModalVisible(true)}
        >
          添加城市
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={cityList.data?.items}
        rowKey="id"
        loading={cityList.isLoading}
        pagination={{
          current: page,
          pageSize,
          total: cityList.data?.total,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title="添加城市"
        open={addModalVisible}
        onOk={handleAddCity}
        onCancel={() => {
          setAddModalVisible(false);
          setCityName('');
          setCityNameError(null);
        }}
        okText="确定"
        cancelText="取消"
        confirmLoading={addCity.isPending}
        okButtonProps={{ disabled: addCity.isPending, autoInsertSpace: false }}
      >
        <div style={{ marginTop: 16 }}>
          <Input
            placeholder="城市名称"
            value={cityName}
            onChange={(e) => {
              setCityName(e.target.value);
              if (cityNameError) setCityNameError(null);
            }}
          />
          {cityNameError && (
            <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
              {cityNameError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
