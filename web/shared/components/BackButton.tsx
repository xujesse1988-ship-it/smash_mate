import React from 'react';
import { LeftOutlined } from '@ant-design/icons';

interface BackButtonProps {
  onClick: () => void;
  style?: React.CSSProperties;
}

const baseButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1.2,
  color: '#111',
};

export function BackButton({ onClick, style }: BackButtonProps) {
  return (
    <button
      type="button"
      aria-label="返回"
      onClick={onClick}
      style={{ ...baseButtonStyle, ...style }}
    >
      <LeftOutlined style={{ fontSize: 16 }} />
      <span>返回</span>
    </button>
  );
}
