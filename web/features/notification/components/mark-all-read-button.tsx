import React from 'react';
import { Button } from 'antd';

interface MarkAllReadButtonProps {
  onClick: () => void;
  isPending: boolean;
}

export function MarkAllReadButton({ onClick, isPending }: MarkAllReadButtonProps) {
  return (
    <Button
      type="link"
      size="small"
      onClick={onClick}
      disabled={isPending}
      loading={isPending}
      style={{ color: 'var(--primary)' }}
    >
      全部已读
    </Button>
  );
}
