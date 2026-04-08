import React from 'react';

interface LogoutButtonProps {
  onClick: () => void;
}

export function LogoutButton({ onClick }: LogoutButtonProps) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center' }}>
      <button
        onClick={onClick}
        style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
      >
        退出登录
      </button>
    </div>
  );
}
