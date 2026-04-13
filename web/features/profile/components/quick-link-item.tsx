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
        borderBottom: showDivider ? '1px solid var(--surface-2)' : 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ fontSize: 20, color: 'var(--text-1)', lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>{label}</span>
      </span>
      <RightOutlined style={{ fontSize: 16, color: 'var(--text-2)', flexShrink: 0 }} />
    </button>
  );
}
