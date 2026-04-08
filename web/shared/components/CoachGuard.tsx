import React from 'react';

/**
 * Coach role guard component.
 * Displayed when a non-coach user tries to access a coach-only page.
 * Prompts the user to enable coach mode in settings.
 *
 * Design reference: docs/module-design/web-app.md §6 — CoachGuard
 */
interface CoachGuardProps {
  onNavigateToSettings: () => void;
  message?: string;
}

export function CoachGuard({
  onNavigateToSettings,
  message = '请先在设置中开启教练模式',
}: CoachGuardProps) {
  return (
    <div>
      <p>{message}</p>
      <button onClick={onNavigateToSettings}>设置</button>
    </div>
  );
}
