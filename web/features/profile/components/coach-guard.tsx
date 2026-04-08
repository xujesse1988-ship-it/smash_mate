import React from 'react';

interface CoachGuardProps {
  onNavigateToSettings: () => void;
}

export function CoachGuard({ onNavigateToSettings }: CoachGuardProps) {
  return (
    <div>
      <p>请先在设置中开启教练模式</p>
      <button onClick={onNavigateToSettings}>设置</button>
    </div>
  );
}
