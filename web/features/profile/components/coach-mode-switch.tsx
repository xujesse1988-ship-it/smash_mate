import React from 'react';
import { Switch } from 'antd';

interface CoachModeSwitchProps {
  isCoach: boolean;
  isPending: boolean;
  onToggle: () => void;
}

export function CoachModeSwitch({ isCoach, isPending, onToggle }: CoachModeSwitchProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px' }}>
      <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-1)' }}>开启教练模式</span>
      <Switch
        checked={isCoach}
        disabled={isCoach || isPending}
        onChange={onToggle}
      />
    </div>
  );
}
