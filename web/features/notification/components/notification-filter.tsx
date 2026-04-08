import React from 'react';

export type FilterStatus = 'all' | 'unread' | 'read';

interface NotificationFilterProps {
  value: FilterStatus;
  onChange: (status: FilterStatus) => void;
}

const TABS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'read', label: '已读' },
];

export function NotificationFilter({ value, onChange }: NotificationFilterProps) {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            padding: '6px 16px',
            border: 'none',
            borderBottom: value === tab.key ? '2px solid #1677ff' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer',
            fontWeight: value === tab.key ? 600 : 400,
            color: value === tab.key ? '#1677ff' : '#666',
            fontSize: 14,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
