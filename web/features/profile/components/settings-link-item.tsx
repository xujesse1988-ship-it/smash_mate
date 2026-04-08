import React from 'react';

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
        padding: '12px 16px',
        color: disabled ? '#999' : undefined,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </div>
  );
}
