import { request } from './client'

interface LoginResponse {
  token: string
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
    phone: string
    isCoach: boolean
  }
  isNewUser: boolean
}

/** 发送验证码 */
export function sendCode(phone: string): Promise<void> {
  return request<void>({
    url: '/auth/send-code',
    method: 'POST',
    data: { phone },
    needAuth: false,
  })
}

/** 手机号 + 验证码登录 */
export function login(phone: string, code: string, isCoach?: boolean): Promise<LoginResponse> {
  return request<LoginResponse>({
    url: '/auth/login',
    method: 'POST',
    data: { phone, code, ...(isCoach !== undefined ? { isCoach } : {}) },
    needAuth: false,
  })
}

interface WxLoginResponse {
  token: string
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
    phone: string
    isCoach: boolean
  }
  isNewUser: boolean
}

/** 微信快捷手机号登录 */
export function wxLogin(params: {
  code: string
  phoneCode: string
  isCoach?: boolean
}): Promise<WxLoginResponse> {
  return request<WxLoginResponse>({
    url: '/auth/wx-login',
    method: 'POST',
    data: params as Record<string, unknown>,
    needAuth: false,
  })
}
