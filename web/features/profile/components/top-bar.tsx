import React from 'react';
import { BackButton } from '../../../shared/components/BackButton';

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
        padding: '14px 18px',
        borderBottom: '1px solid var(--surface-2)',
        background: 'rgba(15,23,42,.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ width: 88, display: 'flex', justifyContent: 'flex-start' }}>
        {showBackButton ? <BackButton onClick={onBack} /> : <span />}
      </div>

      <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)' }}>{title}</span>

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
              color: saveDisabled ? 'var(--text-3)' : 'var(--text-1)',
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
