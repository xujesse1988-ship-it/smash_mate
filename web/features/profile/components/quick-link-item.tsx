import React from 'react';
import { RightOutlined } from '@ant-design/icons';

interface QuickLinkItemProps {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  showDivider?: boolean;
}

export function QuickLinkItem({ label, onClick, icon, showDivider = true }: QuickLinkItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '16px 0',
        border: 'none',
        borderBottom: showDivider ? '1px solid #e8e8e8' : 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ fontSize: 20, color: '#222', lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{label}</span>
      </span>
      <RightOutlined style={{ fontSize: 16, color: '#666', flexShrink: 0 }} />
    </button>
  );
}
