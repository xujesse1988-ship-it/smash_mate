import React from 'react';

interface LogoutButtonProps {
  onClick: () => void;
}

export function LogoutButton({ onClick }: LogoutButtonProps) {
  return (
    <div
      role="button"
      onClick={onClick}
      style={{
        padding: '18px 20px',
        background: 'var(--surface)',
        border: '1px solid var(--surface-2)',
        borderRadius: 18,
        color: 'var(--danger)',
        fontSize: 16,
        fontWeight: 600,
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      退出登录
    </div>
  );
}
