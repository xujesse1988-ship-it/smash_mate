import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Textarea } from '@tarojs/components'
import { Input, Button } from '@nutui/nutui-react-taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMe, updateProfile, uploadAvatar } from '../../apis/user'
import { useLoginCheck } from '../../hooks/use-login-check'
import styles from './index.module.scss'

export default function ProfileEditPage() {
  const isLoggedIn = useLoginCheck()
  const queryClient = useQueryClient()

  const { data: userInfo, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: isLoggedIn,
  })

  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bio, setBio] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  useEffect(() => {
    if (userInfo) {
      setNickname(userInfo.nickname || '')
      setAvatarUrl(userInfo.avatarUrl || '')
      setBio(userInfo.bio || '')
    }
  }, [userInfo])

  if (!isLoggedIn) return null

  if (isLoading) {
    return (
      <View className={styles.container}>
        <Text style={{ color: '#999', fontSize: '28px' }}>加载中...</Text>
      </View>
    )
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length < 2 || nickname.length > 20) {
      newErrors.nickname = '昵称长度需在 2-20 个字符之间'
    }
    if (bio.length > 200) {
      newErrors.bio = '简介不能超过 200 个字符'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleChooseAvatar() {
    if (avatarUploading) return
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      const filePath = res.tempFilePaths[0]
      if (!filePath) return

      setAvatarUploading(true)
      try {
        const url = await uploadAvatar(filePath)
        setAvatarUrl(url)
        Taro.showToast({ title: '头像上传成功', icon: 'success' })
      } catch {
        Taro.showToast({ title: '头像上传失败', icon: 'none' })
      } finally {
        setAvatarUploading(false)
      }
    } catch {
      // User cancelled image picker
    }
  }

  async function handleSave() {
    if (!validate()) return
    if (saving) return

    setSaving(true)
    try {
      const data: { nickname?: string; avatarUrl?: string; bio?: string } = {}
      if (nickname !== (userInfo?.nickname || '')) data.nickname = nickname
      if (avatarUrl !== (userInfo?.avatarUrl || '')) data.avatarUrl = avatarUrl
      if (bio !== (userInfo?.bio || '')) data.bio = bio

      await updateProfile(data)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 500)
    } catch (err) {
      const apiError = err as Error & { code?: string }
      if (apiError.code === 'USER_INVALID_NICKNAME') {
        setErrors((prev) => ({ ...prev, nickname: '昵称长度需在 2-20 个字符之间' }))
      } else if (apiError.code === 'USER_INVALID_BIO') {
        setErrors((prev) => ({ ...prev, bio: '简介不能超过 200 个字符' }))
      } else {
        Taro.showToast({ title: apiError.message || '保存失败', icon: 'none' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className={styles.container}>
      {/* Avatar */}
      <View className={styles.avatarSection} onClick={handleChooseAvatar}>
        <View className={styles.avatarWrap}>
          {avatarUrl ? (
            <Image className={styles.avatarImg} src={avatarUrl} mode="aspectFill" />
          ) : (
            <View className={styles.avatarPlaceholder}>
              <Text>{nickname?.charAt(0) || '?'}</Text>
            </View>
          )}
          <View className={styles.avatarOverlay}>
            <Text className={styles.avatarOverlayText}>
              {avatarUploading ? '上传中...' : '修改头像'}
            </Text>
          </View>
        </View>
      </View>

      {/* Nickname */}
      <View className={styles.fieldGroup}>
        <Text className={styles.label}>昵称</Text>
        <View className={`${styles.inputWrap} ${errors.nickname ? styles.inputError : ''}`}>
          <Input
            placeholder="请输入昵称（2-20字）"
            maxLength={20}
            value={nickname}
            onChange={(val) => {
              setNickname(val)
              if (errors.nickname) {
                setErrors((prev) => {
                  const { nickname: _, ...rest } = prev
                  return rest
                })
              }
            }}
          />
        </View>
        {errors.nickname && <Text className={styles.errorText}>{errors.nickname}</Text>}
      </View>

      {/* Bio */}
      <View className={styles.fieldGroup}>
        <Text className={styles.label}>个人简介（选填）</Text>
        <View className={styles.textareaWrap}>
          <Textarea
            className={styles.textarea}
            placeholder="介绍一下自己吧..."
            maxlength={200}
            value={bio}
            onInput={(e) => {
              setBio(e.detail.value)
              if (errors.bio) {
                setErrors((prev) => {
                  const { bio: _, ...rest } = prev
                  return rest
                })
              }
            }}
          />
        </View>
        <Text className={styles.charCount}>{bio.length}/200</Text>
        {errors.bio && <Text className={styles.errorText}>{errors.bio}</Text>}
      </View>

      {/* Save */}
      <Button
        type="primary"
        block
        className={styles.saveBtn}
        disabled={saving || avatarUploading}
        onClick={handleSave}
        style={{ background: '#4ADE80', borderColor: '#4ADE80' }}
      >
        {saving ? '保存中...' : '保存'}
      </Button>
    </View>
  )
}
