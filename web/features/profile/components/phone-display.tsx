import React from 'react';

interface PhoneDisplayProps {
  phone: string;
}

export function PhoneDisplay({ phone }: PhoneDisplayProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '72px 1fr',
        alignItems: 'start',
        gap: 16,
        marginTop: 18,
        padding: '0 20px 24px',
        background: '#fff',
        border: '1px solid #ececec',
        borderTop: 'none',
        borderRadius: '0 0 18px 18px',
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 500, color: '#111', paddingTop: 10 }}>手机号</span>
      <div
        style={{
          padding: '10px 12px',
          border: '1px solid #cfcfcf',
          background: '#f3f3f3',
          color: '#888',
          fontSize: 16,
          lineHeight: 1.5,
        }}
      >
        {phone}
      </div>
    </div>
  );
}
