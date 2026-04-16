import Taro from '@tarojs/taro'

const BASE_URL = process.env.TARO_APP_API_BASE_URL || ''

export class ApiRequestError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ApiRequestError'
  }
}

/** 获取存储的 token */
function getToken(): string | null {
  try {
    return Taro.getStorageSync('token') || null
  } catch {
    return null
  }
}

/** 统一请求封装 */
export async function request<T>(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  needAuth?: boolean
}): Promise<T> {
  const { url, method = 'GET', data, needAuth = true } = options
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (needAuth) {
    const token = getToken()
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }
  }

  const response = await Taro.request({
    url: `${BASE_URL}${url}`,
    method,
    data,
    header,
  })

  if (response.statusCode === 401) {
    // 清除登录态
    try {
      Taro.removeStorageSync('token')
      Taro.removeStorageSync('userId')
    } catch {}
    // 跳转登录页
    Taro.redirectTo({ url: '/pages/login/index' })
    throw new ApiRequestError('AUTH_REQUIRED', '请重新登录')
  }

  if (response.statusCode >= 400) {
    const err = response.data as { statusCode?: number; code?: string; message?: string }
    throw new ApiRequestError(
      err.code || 'UNKNOWN_ERROR',
      err.message || '请求失败'
    )
  }

  // 解包 { data: T }
  const body = response.data as { data: T }
  return body.data
}

/** 图片上传封装 */
export async function uploadFile(options: {
  url: string
  filePath: string
  name: string
}): Promise<{ avatarUrl: string }> {
  const { url, filePath, name } = options
  const token = getToken()
  const header: Record<string, string> = {}
  if (token) {
    header['Authorization'] = `Bearer ${token}`
  }

  const response = await Taro.uploadFile({
    url: `${BASE_URL}${url}`,
    filePath,
    name,
    header,
  })

  if (response.statusCode >= 400) {
    throw new ApiRequestError('UPLOAD_FAILED', '上传失败')
  }

  const body = JSON.parse(response.data) as { data: { avatarUrl: string } }
  return body.data
}
