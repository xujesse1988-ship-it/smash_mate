import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { useUpdateProfile } from '../hooks/useUpdateProfile';
import { TopBar } from '../components/top-bar';
import { ProfileForm } from '../components/profile-form';
import { PhoneDisplay } from '../components/phone-display';
import { ConfirmDialog } from '../components/confirm-dialog';

export function ProfileEditPage() {
  const navigate = useNavigate();
  const { data: currentUser, isLoading, error } = useCurrentUser();
  const updateProfile = useUpdateProfile();

  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);

  // Track initial values for dirty detection
  const initialValues = useRef<{ nickname: string; avatarUrl: string; bio: string } | null>(null);

  // Fill form when currentUser data arrives
  useEffect(() => {
    if (currentUser) {
      const n = currentUser.nickname || '';
      const a = currentUser.avatarUrl || '';
      const b = currentUser.bio || '';
      setNickname(n);
      setAvatarUrl(a);
      setBio(b);
      initialValues.current = { nickname: n, avatarUrl: a, bio: b };
    }
  }, [currentUser]);

  if (error) {
    return <div>加载失败</div>;
  }

  if (isLoading || !currentUser) {
    return <div>加载中...</div>;
  }

  const isDirty =
    initialValues.current !== null &&
    (nickname !== initialValues.current.nickname ||
      avatarUrl !== initialValues.current.avatarUrl ||
      bio !== initialValues.current.bio);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    // nickname: required, 2-20 chars, not pure whitespace
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname || trimmedNickname.length < 2 || nickname.length > 20) {
      newErrors.nickname = '昵称长度需在 2-20 个字符之间';
    }

    // avatarUrl: optional, must start with http:// or https://
    if (avatarUrl && !avatarUrl.match(/^https?:\/\//)) {
      newErrors.avatarUrl = '请输入合法的头像链接';
    }

    // bio: optional, max 200 chars
    if (bio.length > 200) {
      newErrors.bio = '简介不能超过 200 个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    // Build update payload with only changed fields
    const data: { nickname?: string; avatarUrl?: string; bio?: string } = {};
    if (initialValues.current) {
      if (nickname !== initialValues.current.nickname) data.nickname = nickname;
      if (avatarUrl !== initialValues.current.avatarUrl) data.avatarUrl = avatarUrl;
      if (bio !== initialValues.current.bio) data.bio = bio;
    }

    updateProfile.mutate(data, {
      onSuccess: () => {
        message.success('保存成功');
        initialValues.current = { nickname, avatarUrl, bio };
        navigate(-1);
      },
      onError: (err) => {
        const apiError = err as Error & { code?: string };
        if (apiError.code === 'USER_INVALID_NICKNAME') {
          setErrors((prev) => ({ ...prev, nickname: '昵称长度需在 2-20 个字符之间' }));
        } else if (apiError.code === 'USER_INVALID_BIO') {
          setErrors((prev) => ({ ...prev, bio: '简介不能超过 200 个字符' }));
        } else if (apiError.code === 'USER_INVALID_AVATAR_URL') {
          setErrors((prev) => ({ ...prev, avatarUrl: '请输入合法的头像链接' }));
        } else {
          message.error(apiError.message || '保存失败');
        }
      },
    });
  }

  function handleBack() {
    if (isDirty) {
      setShowConfirm(true);
    } else {
      navigate(-1);
    }
  }

  return (
    <div style={{ padding: 16, background: '#f5f5f5', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        <TopBar
          title="编辑资料"
          onBack={handleBack}
          onSave={handleSave}
          saveDisabled={updateProfile.isPending}
        />

        <ProfileForm
          nickname={nickname}
          onNicknameChange={setNickname}
          bio={bio}
          onBioChange={setBio}
          avatarUrl={avatarUrl}
          onAvatarUrlChange={setAvatarUrl}
          errors={errors}
        />

        <PhoneDisplay phone={currentUser.phone} />

        <ConfirmDialog
          visible={showConfirm}
          message="有未保存的修改，确定离开？"
          onConfirm={() => {
            setShowConfirm(false);
            navigate(-1);
          }}
          onCancel={() => setShowConfirm(false)}
        />
      </div>
    </div>
  );
}
