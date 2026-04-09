import React from 'react';
import { RightOutlined } from '@ant-design/icons';

interface SettingsLinkItemProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function SettingsLinkItem({ label, onClick, disabled = false }: SettingsLinkItemProps) {
  return (
    <div
      role="button"
      aria-disabled={disabled ? 'true' : undefined}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 20px',
        color: disabled ? '#999' : '#111',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 16,
        fontWeight: 500,
        background: '#fff',
      }}
    >
      <span>{label}</span>
      <RightOutlined style={{ color: '#ccc', fontSize: 14 }} />
    </div>
  );
}
