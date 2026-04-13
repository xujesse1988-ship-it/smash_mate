import React from 'react';

interface ChipProps {
  active?: boolean;
  size?: 'default' | 'sm';
  onClick?: () => void;
  children: React.ReactNode;
}

export function Chip({ active, size, onClick, children }: ChipProps) {
  const className = [
    'chip',
    active && 'chip-active',
    size === 'sm' && 'chip-sm',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} onClick={onClick}>
      {children}
    </span>
  );
}
