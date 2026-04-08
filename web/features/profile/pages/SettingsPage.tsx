import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { useEnableCoachRole } from '../hooks/useEnableCoachRole';
import { useAuthStore } from '../../../stores/auth-store';
import { CoachModeSwitch } from '../components/coach-mode-switch';
import { SettingsLinkItem } from '../components/settings-link-item';
import { LogoutButton } from '../components/logout-button';
import { ConfirmDialog } from '../components/confirm-dialog';

export function SettingsPage() {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const enableCoachRole = useEnableCoachRole();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showCoachConfirm, setShowCoachConfirm] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const isCoach = currentUser?.isCoach ?? false;

  function handleCoachSwitchClick() {
    if (isCoach || enableCoachRole.isPending) return;
    setShowCoachConfirm(true);
  }

  function handleConfirmEnableCoach() {
    setShowCoachConfirm(false);
    enableCoachRole.mutate(undefined, {
      onSuccess: () => {
        message.success('教练模式已开启');
      },
      onError: (err) => {
        const apiError = err as Error & { code?: string };
        if (apiError.code === 'USER_COACH_ROLE_CLOSE_NOT_SUPPORTED') {
          message.error('当前不支持关闭教练模式');
        } else {
          message.error('操作失败，请重试');
        }
      },
    });
  }

  function handleLogout() {
    setShowLogoutConfirm(false);
    clearAuth();
    navigate('/login');
  }

  function handlePhoneClick() {
    message.info('该功能暂未开放');
  }

  return (
    <div>
      {/* TopBar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
        <button aria-label="返回" onClick={() => navigate(-1)}>
          返回
        </button>
        <span style={{ marginLeft: 8 }}>设置</span>
      </div>

      {/* Settings List */}
      <div>
        <CoachModeSwitch
          isCoach={isCoach}
          isPending={enableCoachRole.isPending}
          onToggle={handleCoachSwitchClick}
        />

        <SettingsLinkItem
          label="修改手机号"
          onClick={handlePhoneClick}
          disabled
        />

        <SettingsLinkItem
          label="关于我们"
          onClick={() => setShowAbout(true)}
        />
      </div>

      <LogoutButton onClick={() => setShowLogoutConfirm(true)} />

      {/* Coach Mode Confirm Dialog */}
      <ConfirmDialog
        visible={showCoachConfirm}
        message="确认开启教练模式？开启后您可以发布团课和私教课。"
        onConfirm={handleConfirmEnableCoach}
        onCancel={() => setShowCoachConfirm(false)}
      />

      {/* Logout Confirm Dialog */}
      <ConfirmDialog
        visible={showLogoutConfirm}
        message="确定退出登录？"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* About Dialog */}
      {showAbout && (
        <div role="dialog">
          <p>羽约 v1.0.0</p>
          <p>羽毛球社交平台</p>
          <button onClick={() => setShowAbout(false)}>关闭</button>
        </div>
      )}
    </div>
  );
}
