import React from 'react';

interface DarkCardProps {
  accentLeft?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function DarkCard({ accentLeft, onClick, style, children }: DarkCardProps) {
  const className = ['dark-card', accentLeft && 'dark-card-accent']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} onClick={onClick} style={style}>
      {children}
    </div>
  );
}
