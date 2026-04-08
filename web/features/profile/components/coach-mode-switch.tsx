import React from 'react';

interface CoachModeSwitchProps {
  isCoach: boolean;
  isPending: boolean;
  onToggle: () => void;
}

export function CoachModeSwitch({ isCoach, isPending, onToggle }: CoachModeSwitchProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
      <span>教练模式</span>
      <input
        type="checkbox"
        role="switch"
        checked={isCoach}
        disabled={isCoach || isPending}
        onChange={onToggle}
      />
    </div>
  );
}
