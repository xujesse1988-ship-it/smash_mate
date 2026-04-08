import React from 'react';
import { LeftOutlined } from '@ant-design/icons';

interface TopBarProps {
  title: string;
  onBack: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  showBackButton?: boolean;
}

export function TopBar({
  title,
  onBack,
  onSave,
  saveDisabled = false,
  showBackButton = true,
}: TopBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: '1px solid #ececec',
        background: '#fff',
      }}
    >
      <div style={{ width: 88, display: 'flex', justifyContent: 'flex-start' }}>
        {showBackButton ? (
          <button
            aria-label="返回"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 16,
              color: '#111',
            }}
          >
            <LeftOutlined style={{ fontSize: 16 }} />
            返回
          </button>
        ) : (
          <span />
        )}
      </div>

      <span style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>{title}</span>

      <div style={{ width: 88, display: 'flex', justifyContent: 'flex-end' }}>
        {onSave ? (
          <button
            onClick={onSave}
            disabled={saveDisabled}
            style={{
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: saveDisabled ? 'not-allowed' : 'pointer',
              fontSize: 16,
              color: saveDisabled ? '#999' : '#111',
            }}
          >
            保存
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
