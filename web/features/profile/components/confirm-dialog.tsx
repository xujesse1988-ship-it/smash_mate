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
    <div role="dialog">
      <p>{message}</p>
      <button onClick={onConfirm}>确认</button>
      <button onClick={onCancel}>取消</button>
    </div>
  );
}
