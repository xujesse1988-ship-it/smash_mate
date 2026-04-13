import React from 'react';

type BadgeVariant = 'green' | 'gray' | 'blue' | 'red' | 'yellow' | 'purple';

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
