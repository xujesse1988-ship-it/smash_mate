import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { useEnableCoachRole } from '../hooks/useEnableCoachRole';
import { useAuthStore } from '../../../stores/auth-store';

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
      <div style={{ padding: '12px 16px' }}>
        <span>设置</span>
      </div>

      {/* Settings List */}
      <div>
        {/* Coach Mode Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <span>教练模式</span>
          <input
            type="checkbox"
            role="switch"
            checked={isCoach}
            disabled={isCoach || enableCoachRole.isPending}
            onChange={handleCoachSwitchClick}
            onClick={handleCoachSwitchClick}
          />
        </div>

        {/* Change Phone (disabled in phase 1) */}
        <div
          role="button"
          aria-disabled="true"
          onClick={handlePhoneClick}
          style={{ padding: '12px 16px', color: '#999', cursor: 'not-allowed' }}
        >
          修改手机号
        </div>

        {/* About Us */}
        <div
          role="button"
          onClick={() => setShowAbout(true)}
          style={{ padding: '12px 16px', cursor: 'pointer' }}
        >
          关于我们
        </div>
      </div>

      {/* Logout Button */}
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
        >
          退出登录
        </button>
      </div>

      {/* Coach Mode Confirm Dialog */}
      {showCoachConfirm && (
        <div role="dialog">
          <p>确认开启教练模式？开启后您可以发布团课和私教课。</p>
          <button onClick={handleConfirmEnableCoach}>确认</button>
          <button onClick={() => setShowCoachConfirm(false)}>取消</button>
        </div>
      )}

      {/* Logout Confirm Dialog */}
      {showLogoutConfirm && (
        <div role="dialog">
          <p>确定退出登录？</p>
          <button onClick={handleLogout}>确认</button>
          <button onClick={() => setShowLogoutConfirm(false)}>取消</button>
        </div>
      )}

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
