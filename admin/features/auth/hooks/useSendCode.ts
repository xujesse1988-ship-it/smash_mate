import { useState, useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { sendCode as sendCodeApi } from '../api/auth-api';

const COUNTDOWN_SECONDS = 60;

interface UseSendCodeReturn {
  mutate: (phone: string) => void;
  isPending: boolean;
  countdown: number;
}

export function useSendCode(): UseSendCodeReturn {
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const mutation = useMutation({
    mutationFn: (phone: string) => sendCodeApi(phone),
    onSuccess: () => {
      message.success('验证码已发送');
      startCountdown();
    },
    onError: (err: unknown) => {
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'AUTH_INVALID_PHONE':
          message.error('请输入正确的手机号');
          break;
        case 'AUTH_CODE_RATE_LIMITED':
          message.error('请稍后再试');
          break;
        case 'AUTH_PHONE_LOCKED':
          message.error('操作过于频繁，请 30 分钟后再试');
          break;
        default:
          message.error(error.message || '发送失败，请重试');
      }
    },
  });

  return { mutate: mutation.mutate, isPending: mutation.isPending, countdown };
}
