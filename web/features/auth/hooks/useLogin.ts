import { useRef } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login as loginApi } from '../api/auth-api';
import { useAuthStore } from '../../../stores/auth-store';
import { useRedirectUrl } from './useRedirectUrl';

interface LoginParams {
  phone: string;
  code: string;
  isCoach?: boolean;
}

interface UseLoginReturn {
  mutate: (params: LoginParams) => void;
  isPending: boolean;
}

export function useLogin(isRegisterTab: boolean = false): UseLoginReturn {
  const navigate = useNavigate();
  const redirectUrl = useRedirectUrl();
  const setAuth = useAuthStore((state) => state.setAuth);
  // Use a ref to track the latest isRegisterTab value without causing re-renders
  const isRegisterTabRef = useRef(isRegisterTab);
  isRegisterTabRef.current = isRegisterTab;

  const mutation = useMutation({
    mutationFn: (params: LoginParams) =>
      loginApi(params.phone, params.code, params.isCoach),
    onSuccess: (result) => {
      // If registering but user already exists, show info message
      if (isRegisterTabRef.current && !result.isNewUser) {
        message.info('该手机号已注册，已自动登录');
      }

      setAuth(result.token, result.user.id);
      navigate(redirectUrl, { replace: true });
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'AUTH_INVALID_PHONE':
          message.error('请输入正确的手机号');
          break;
        case 'AUTH_INVALID_CODE':
          message.error('请输入 6 位数字验证码');
          break;
        case 'AUTH_CODE_WRONG':
          message.error('验证码错误，请重新输入');
          break;
        case 'AUTH_CODE_EXPIRED':
          message.error('验证码已过期，请重新获取');
          break;
        case 'AUTH_PHONE_LOCKED':
          message.error('操作过于频繁，请 30 分钟后再试');
          break;
        default:
          message.error(error.message || '登录失败，请重试');
      }
    },
  });

  return { mutate: mutation.mutate, isPending: mutation.isPending };
}
