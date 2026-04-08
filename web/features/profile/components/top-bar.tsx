import React from 'react';

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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
      {showBackButton ? (
        <button aria-label="返回" onClick={onBack}>
          返回
        </button>
      ) : (
        <span />
      )}
      <span>{title}</span>
      {onSave ? (
        <button
          onClick={onSave}
          disabled={saveDisabled}
        >
          保存
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
