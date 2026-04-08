import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Table, Select, Input, Popconfirm, Modal } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useVenueList } from '../hooks/useVenueList';
import { useCityList } from '../hooks/useCityList';
import { useRemoveVenue } from '../hooks/useRemoveVenue';
import { useSyncVenues } from '../hooks/useSyncVenues';

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

const DEBOUNCE_MS = 500;

export function VenueManagementPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [cityFilter, setCityFilter] = useState<string | undefined>(undefined);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const venueList = useVenueList({
    cityId: cityFilter,
    keyword: debouncedKeyword || undefined,
    page,
    pageSize,
  });
  const cityList = useCityList({ page: 1, pageSize: 100 });
  const removeVenue = useRemoveVenue();
  const syncVenuesMutation = useSyncVenues();

  // Debounce keyword search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(1);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [keyword]);

  const handleCityFilterChange = useCallback((value: string | undefined) => {
    setCityFilter(value);
    setPage(1);
  }, []);

  const handleSyncConfirm = useCallback(() => {
    syncVenuesMutation.mutate();
    setSyncModalVisible(false);
  }, [syncVenuesMutation]);

  const columns = [
    {
      title: '球馆名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: '所属城市',
      dataIndex: 'cityName',
      key: 'cityName',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => formatDate(text),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: { id: string }) => (
        <Popconfirm
          title="确定移除该球馆吗？移除后用户端将无法搜索到该球馆。"
          onConfirm={() => removeVenue.mutate(record.id)}
          okText="确定"
          cancelText="取消"
          okButtonProps={{ autoInsertSpace: false } as Record<string, unknown>}
        >
          <Button
            type="link"
            danger
            disabled={removeVenue.isPending && removeVenue.variables === record.id}
            loading={removeVenue.isPending && removeVenue.variables === record.id}
          >
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  if (venueList.error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>球馆管理</h2>
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
        <h2 style={{ margin: 0 }}>球馆管理</h2>
        <Button
          icon={<SyncOutlined />}
          onClick={() => setSyncModalVisible(true)}
          loading={syncVenuesMutation.isPending}
          disabled={syncVenuesMutation.isPending}
        >
          同步球馆数据
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Select
          style={{ width: 200 }}
          placeholder="全部城市"
          allowClear
          value={cityFilter}
          onChange={handleCityFilterChange}
          options={[
            ...(cityList.data?.items.map((city) => ({
              label: city.name,
              value: city.id,
            })) || []),
          ]}
        />
        <Input.Search
          placeholder="搜索球馆名称"
          style={{ width: 300 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={venueList.data?.items}
        rowKey="id"
        loading={venueList.isLoading}
        pagination={{
          current: page,
          pageSize,
          total: venueList.data?.total,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title="同步球馆数据"
        open={syncModalVisible}
        onOk={handleSyncConfirm}
        onCancel={() => setSyncModalVisible(false)}
        okText="确定"
        cancelText="取消"
        okButtonProps={{ autoInsertSpace: false }}
      >
        <p>确定同步所有城市的球馆数据吗？同步过程可能需要一些时间。</p>
      </Modal>
    </div>
  );
}
