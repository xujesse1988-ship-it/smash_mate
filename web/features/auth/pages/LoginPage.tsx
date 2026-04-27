import React, { useEffect, useState } from 'react';
import { Input, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSendCode } from '../hooks/useSendCode';
import { useLogin } from '../hooks/useLogin';
import { useRedirectUrl } from '../hooks/useRedirectUrl';
import { useAuthStore } from '../../../stores/auth-store';

const PHONE_REGEX = /^1\d{10}$/;
const CODE_REGEX = /^\d{6}$/;

export function LoginPage() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const redirectUrl = useRedirectUrl();

  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isLoggedIn, redirectUrl, navigate]);

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const sendCodeHook = useSendCode();
  const loginMutation = useLogin(activeTab === 'register');

  const validatePhone = (): boolean => {
    if (!PHONE_REGEX.test(phone)) {
      setPhoneError('请输入正确的手机号');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const validateCode = (): boolean => {
    if (!CODE_REGEX.test(code)) {
      setCodeError('请输入 6 位数字验证码');
      return false;
    }
    setCodeError(null);
    return true;
  };

  const handleSendCode = () => {
    if (!validatePhone()) return;
    sendCodeHook.mutate(phone);
  };

  const handleSubmit = () => {
    const phoneValid = validatePhone();
    const codeValid = validateCode();
    if (!phoneValid || !codeValid) return;

    loginMutation.mutate({ phone, code });
  };

  const handleTabChange = (key: 'login' | 'register') => {
    setActiveTab(key);
    setPhoneError(null);
    setCodeError(null);
  };

  const sendCodeButtonText =
    sendCodeHook.countdown > 0
      ? `重新获取(${sendCodeHook.countdown}s)`
      : '获取验证码';
  const sendCodeDisabled = sendCodeHook.countdown > 0 || sendCodeHook.isPending;

  const submitButtonText = activeTab === 'login' ? '登录' : '注册';

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '0 24px', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Brand Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0 32px' }}>
        <div style={{ fontSize: 56, marginBottom: 4 }}>🏸</div>
        <h1 className="gradient-text" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, margin: '0 0 6px 0' }}>
          羽约
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: 2 }}>
          找球友 · 约场地 · 练技术
        </div>
      </div>

      {/* Tab switcher */}
      <div
        style={{
          display: 'flex',
          background: 'var(--surface-2)',
          borderRadius: 10,
          padding: 3,
          marginBottom: 24,
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === 'login'}
          onClick={() => handleTabChange('login')}
          style={{
            flex: 1,
            padding: '8px 16px',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: activeTab === 'login' ? 600 : 400,
            background: activeTab === 'login' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'login' ? 'var(--text-1)' : 'var(--text-2)',
            transition: 'var(--transition)',
          }}
        >
          登录
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'register'}
          onClick={() => handleTabChange('register')}
          style={{
            flex: 1,
            padding: '8px 16px',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: activeTab === 'register' ? 600 : 400,
            background: activeTab === 'register' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'register' ? 'var(--text-1)' : 'var(--text-2)',
            transition: 'var(--transition)',
          }}
        >
          注册
        </button>
      </div>

      {/* Form */}
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>手机号</div>
        <div>
          <Input
            placeholder="请输入手机号"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (phoneError) setPhoneError(null);
            }}
            maxLength={11}
            status={phoneError ? 'error' : undefined}
          />
          {phoneError && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
              {phoneError}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>验证码</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="6 位验证码"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (codeError) setCodeError(null);
              }}
              maxLength={6}
              status={codeError ? 'error' : undefined}
            />
            <Button disabled={sendCodeDisabled} onClick={handleSendCode} style={{ whiteSpace: 'nowrap' }}>
              {sendCodeButtonText}
            </Button>
          </div>
          {codeError && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
              {codeError}
            </div>
          )}
        </div>

        <Button
          type="primary"
          block
          disabled={loginMutation.isPending}
          onClick={handleSubmit}
          style={{
            marginTop: 24,
            height: 48,
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 12,
          }}
          autoInsertSpace={false}
        >
          {submitButtonText}
        </Button>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 16 }}>
          继续即表示同意 <span style={{ color: 'var(--primary)' }}>用户协议</span> 与 <span style={{ color: 'var(--primary)' }}>隐私政策</span>
        </div>
      </div>
    </div>
  );
}
