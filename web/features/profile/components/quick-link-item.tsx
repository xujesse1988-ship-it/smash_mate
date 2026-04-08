import React from 'react';

interface QuickLinkItemProps {
  label: string;
  onClick: () => void;
}

export function QuickLinkItem({ label, onClick }: QuickLinkItemProps) {
  return (
    <div role="button" onClick={onClick}>
      {label}
    </div>
  );
}
