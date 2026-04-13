import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { BackButton } from '../../../shared/components/BackButton';
import { useAuthStore } from '../../../stores/auth-store';
import { SettingsLinkItem } from '../components/settings-link-item';
import { LogoutButton } from '../components/logout-button';
import { ConfirmDialog } from '../components/confirm-dialog';

export function SettingsPage() {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const isCoach = currentUser?.isCoach ?? false;

  function handleCoachEntryClick() {
    navigate('/coach-apply');
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
    <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0 24px' }}>
          <BackButton onClick={() => navigate(-1)} style={{ marginRight: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-1)' }}>设置</span>
        </div>

        {/* Settings List Card */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 18,
            border: '1px solid var(--surface-2)',
            overflow: 'hidden',
          }}
        >
          <SettingsLinkItem
            label={isCoach ? '教练资质（已认证）' : '申请成为教练'}
            onClick={handleCoachEntryClick}
          />

          <div style={{ height: 1, background: 'var(--surface-2)', margin: '0 20px' }} />

          <SettingsLinkItem label="修改手机号" onClick={handlePhoneClick} disabled />

          <div style={{ height: 1, background: 'var(--surface-2)', margin: '0 20px' }} />

          <SettingsLinkItem label="关于我们" onClick={() => setShowAbout(true)} />
        </div>

        <div style={{ marginTop: 24 }}>
          <LogoutButton onClick={() => setShowLogoutConfirm(true)} />
        </div>
      </div>

      {/* Logout Confirm Dialog */}
      <ConfirmDialog
        visible={showLogoutConfirm}
        message="确定退出登录？"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* About Dialog */}
      {showAbout && (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 24,
              padding: '32px 24px',
              width: '80%',
              maxWidth: 320,
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                background: 'var(--primary)',
                borderRadius: 16,
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 32,
                fontWeight: 'bold',
              }}
            >
              S
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--text-1)' }}>羽约 SmashMate</h3>
            <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: 14 }}>版本 v1.0.0</p>
            <button
              onClick={() => setShowAbout(false)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--surface-2)',
                border: 'none',
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 500,
                color: 'var(--text-1)',
                cursor: 'pointer',
              }}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
