import React, { useState, useEffect } from 'react';
import { Input, Button, Checkbox } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth-store';
import { useSendCode } from '../hooks/useSendCode';
import { useLogin } from '../hooks/useLogin';
import { useRedirectUrl } from '../hooks/useRedirectUrl';

const PHONE_REGEX = /^1\d{10}$/;
const CODE_REGEX = /^\d{6}$/;

export function LoginPage() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const redirectUrl = useRedirectUrl();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isCoach, setIsCoach] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const sendCodeHook = useSendCode();
  const loginMutation = useLogin(activeTab === 'register');

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isLoggedIn, navigate, redirectUrl]);

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

    if (activeTab === 'register' && isCoach) {
      loginMutation.mutate({ phone, code, isCoach: true });
    } else {
      loginMutation.mutate({ phone, code });
    }
  };

  const handleTabChange = (key: 'login' | 'register') => {
    setActiveTab(key);
    setPhoneError(null);
    setCodeError(null);
  };

  const handleCoachChange = (e: CheckboxChangeEvent) => {
    setIsCoach(e.target.checked);
  };

  const sendCodeButtonText =
    sendCodeHook.countdown > 0
      ? `重新获取(${sendCodeHook.countdown}s)`
      : '获取验证码';
  const sendCodeDisabled = sendCodeHook.countdown > 0 || sendCodeHook.isPending;

  const submitButtonText = activeTab === 'login' ? '登录' : '注册';

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1>羽约</h1>
      </div>

      <div role="tablist" style={{ display: 'flex', marginBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
        <button
          role="tab"
          aria-selected={activeTab === 'login'}
          onClick={() => handleTabChange('login')}
          style={{
            flex: 1,
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'login' ? '2px solid #00C853' : '2px solid transparent',
            fontWeight: activeTab === 'login' ? 600 : 400,
            color: activeTab === 'login' ? '#00C853' : '#666',
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
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'register' ? '2px solid #00C853' : '2px solid transparent',
            fontWeight: activeTab === 'register' ? 600 : 400,
            color: activeTab === 'register' ? '#00C853' : '#666',
          }}
        >
          注册
        </button>
      </div>

      <div>
        <div>
          <Input
            placeholder="手机号"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (phoneError) setPhoneError(null);
            }}
            maxLength={11}
          />
          {phoneError && (
            <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
              {phoneError}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="验证码"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (codeError) setCodeError(null);
              }}
              maxLength={6}
            />
            <Button disabled={sendCodeDisabled} onClick={handleSendCode}>
              {sendCodeButtonText}
            </Button>
          </div>
          {codeError && (
            <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
              {codeError}
            </div>
          )}
        </div>

        {activeTab === 'register' && (
          <div style={{ marginTop: 16 }}>
            <Checkbox checked={isCoach} onChange={handleCoachChange}>
              我是教练
            </Checkbox>
          </div>
        )}

        <Button
          type="primary"
          block
          disabled={loginMutation.isPending}
          onClick={handleSubmit}
          style={{ marginTop: 16 }}
          autoInsertSpace={false}
        >
          {submitButtonText}
        </Button>
      </div>
    </div>
  );
}
