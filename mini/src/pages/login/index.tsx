import { useState, useRef, useCallback, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import { Input, Button as NutButton } from '@nutui/nutui-react-taro'
import { useAuthStore } from '../../stores/auth-store'
import { sendCode, login, wxLogin } from '../../apis/auth'
import styles from './index.module.scss'

const PHONE_REGEX = /^1\d{10}$/
const CODE_REGEX = /^\d{6}$/
const COUNTDOWN_SECONDS = 60

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const setAuth = useAuthStore((s) => s.setAuth)

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS)
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const validatePhone = (): boolean => {
    if (!PHONE_REGEX.test(phone)) {
      setPhoneError('请输入正确的手机号')
      return false
    }
    setPhoneError(null)
    return true
  }

  const validateCode = (): boolean => {
    if (!CODE_REGEX.test(code)) {
      setCodeError('请输入 6 位数字验证码')
      return false
    }
    setCodeError(null)
    return true
  }

  const handleGetPhoneNumber = async (e) => {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      // 用户拒绝授权，不阻塞
      return
    }
    try {
      // 1. 获取 wx.login code
      const loginRes = await Taro.login()
      // 2. 调用后端 wx-login
      const result = await wxLogin({
        code: loginRes.code,
        encryptedData: e.detail.encryptedData,
        iv: e.detail.iv,
      })
      // 3. 存储登录态
      useAuthStore.getState().setAuth(result.token, result.user.id)
      // 4. 跳转首页
      Taro.switchTab({ url: '/pages/index/index' })
    } catch (err) {
      Taro.showToast({ title: '登录失败，请使用验证码登录', icon: 'none' })
    }
  }

  const handleSendCode = async () => {
    if (!validatePhone()) return
    if (sendingCode || countdown > 0) return

    setSendingCode(true)
    try {
      await sendCode(phone)
      Taro.showToast({ title: '验证码已发送', icon: 'success' })
      startCountdown()
    } catch (err) {
      const message = err instanceof Error ? err.message : '发送失败'
      Taro.showToast({ title: message, icon: 'none' })
    } finally {
      setSendingCode(false)
    }
  }

  const handleLogin = async () => {
    const phoneValid = validatePhone()
    const codeValid = validateCode()
    if (!phoneValid || !codeValid) return
    if (loggingIn) return

    setLoggingIn(true)
    try {
      const result = await login(phone, code)
      setAuth(result.token, result.user.id)
      Taro.switchTab({ url: '/pages/index/index' })
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败'
      Taro.showToast({ title: message, icon: 'none' })
    } finally {
      setLoggingIn(false)
    }
  }

  const sendCodeDisabled = countdown > 0 || sendingCode
  const sendCodeText = countdown > 0 ? `重新获取(${countdown}s)` : '获取验证码'

  return (
    <View className={styles.container}>
      {/* Logo */}
      <View className={styles.logo}>
        <Text className={styles.logoIcon}>🏸</Text>
        <Text className={styles.appName}>羽约</Text>
        <Text className={styles.slogan}>找球友 · 约场地 · 练技术</Text>
      </View>

      {/* 微信快捷登录 */}
      <View className={styles.wxLoginSection}>
        <Button
          className={styles.wxLoginBtn}
          openType="getPhoneNumber"
          onGetPhoneNumber={handleGetPhoneNumber}
        >
          微信手机号快捷登录
        </Button>
      </View>

      {/* 分隔线 */}
      <View className={styles.divider}>
        <View className={styles.dividerLine} />
        <Text className={styles.dividerText}>或使用手机号登录</Text>
        <View className={styles.dividerLine} />
      </View>

      {/* Form */}
      <View className={styles.form}>
        {/* Phone */}
        <View className={styles.fieldGroup}>
          <Text className={styles.label}>手机号</Text>
          <Input
            type="number"
            placeholder="请输入手机号"
            maxLength={11}
            value={phone}
            onChange={(val) => {
              setPhone(val)
              if (phoneError) setPhoneError(null)
            }}
          />
          {phoneError && <Text className={styles.errorText}>{phoneError}</Text>}
        </View>

        {/* Code */}
        <View className={styles.fieldGroup}>
          <Text className={styles.label}>验证码</Text>
          <View className={styles.codeRow}>
            <View className={styles.codeInputWrap}>
              <Input
                type="number"
                placeholder="6 位验证码"
                maxLength={6}
                value={code}
                onChange={(val) => {
                  setCode(val)
                  if (codeError) setCodeError(null)
                }}
              />
            </View>
            <NutButton
              size="small"
              disabled={sendCodeDisabled}
              onClick={handleSendCode}
            >
              {sendCodeText}
            </NutButton>
          </View>
          {codeError && <Text className={styles.errorText}>{codeError}</Text>}
        </View>

        {/* Login button */}
        <NutButton
          type="primary"
          block
          className={styles.loginBtn}
          disabled={loggingIn}
          onClick={handleLogin}
        >
          登录
        </NutButton>

        <Text className={styles.agreement}>
          继续即表示同意{' '}
          <Text className={styles.link}>用户协议</Text>
          {' '}与{' '}
          <Text className={styles.link}>隐私政策</Text>
        </Text>
      </View>
    </View>
  )
}
