import React from 'react';

interface ConfirmDialogProps {
  visible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ visible, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!visible) return null;

  return (
    <div
      role="dialog"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          padding: '24px',
          width: '80%',
          maxWidth: 320,
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        <p style={{ fontSize: 16, color: 'var(--text-1)', marginBottom: 28, lineHeight: 1.5, fontWeight: 500 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'var(--surface-2)',
              border: 'none',
              borderRadius: 12,
              fontSize: 16,
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'var(--primary)',
              border: 'none',
              borderRadius: 12,
              fontSize: 16,
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
