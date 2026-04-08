import React, { useState, useEffect } from 'react';
import { Input, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAdminAuthStore } from '../../../stores/auth-store';
import { useSendCode } from '../hooks/useSendCode';
import { useAdminLogin } from '../hooks/useAdminLogin';

const PHONE_REGEX = /^1\d{10}$/;
const CODE_REGEX = /^\d{6}$/;

export function AdminLoginPage() {
  const navigate = useNavigate();
  const isLoggedIn = useAdminAuthStore((state) => state.isLoggedIn);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const sendCodeHook = useSendCode();
  const loginMutation = useAdminLogin();

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/cities', { replace: true });
    }
  }, [isLoggedIn, navigate]);

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

  const handleLogin = () => {
    const phoneValid = validatePhone();
    const codeValid = validateCode();
    if (!phoneValid || !codeValid) return;
    loginMutation.mutate({ phone, code });
  };

  const sendCodeButtonText =
    sendCodeHook.countdown > 0
      ? `重新获取(${sendCodeHook.countdown}s)`
      : '获取验证码';
  const sendCodeDisabled = sendCodeHook.countdown > 0 || sendCodeHook.isPending;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f2f5',
      }}
    >
      <div
        style={{
          width: 360,
          padding: 32,
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>羽约管理后台</h1>
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

          <Button
            type="primary"
            block
            disabled={loginMutation.isPending}
            onClick={handleLogin}
            style={{ marginTop: 24 }}
            autoInsertSpace={false}
          >
            登录
          </Button>
        </div>
      </div>
    </div>
  );
}
