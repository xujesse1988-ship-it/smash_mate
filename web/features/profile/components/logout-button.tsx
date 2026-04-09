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
        background: '#fff',
        border: '1px solid #ececec',
        borderRadius: 18,
        color: '#ff4d4f',
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
