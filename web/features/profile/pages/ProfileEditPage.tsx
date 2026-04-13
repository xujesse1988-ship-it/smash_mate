import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { useUpdateProfile } from '../hooks/useUpdateProfile';
import { uploadAvatar } from '../api/profile-api';
import { BackButton } from '../../../shared/components/BackButton';
import { ProfileForm } from '../components/profile-form';
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // avatarUrl: optional, must start with http:// or https:// or /api/uploads/
    if (avatarUrl && !avatarUrl.match(/^https?:\/\//) && !avatarUrl.startsWith('/api/uploads/')) {
      newErrors.avatarUrl = '头像链接格式不合法';
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

  function handleAvatarButtonClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so the same file can be re-selected
    e.target.value = '';

    // Validate file size client-side (5MB)
    if (file.size > 5 * 1024 * 1024) {
      message.error('图片大小不能超过 5MB');
      return;
    }

    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      setErrors((prev) => {
        const { avatarUrl: _avatarUrl, ...rest } = prev;
        return rest;
      });
      message.success('头像上传成功');
    } catch {
      message.error('头像上传失败，请重试');
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
        {/* Header — same style as MyActivityListPage */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid var(--surface-2)',
            background: 'rgba(15,23,42,.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <BackButton onClick={handleBack} style={{ marginRight: 8 }} />
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-1)' }}>编辑资料</h2>
        </div>

        <ProfileForm
          nickname={nickname}
          onNicknameChange={setNickname}
          bio={bio}
          onBioChange={setBio}
          avatarUrl={avatarUrl}
          onAvatarButtonClick={handleAvatarButtonClick}
          avatarUploading={avatarUploading}
          errors={errors}
          phone={currentUser.phone}
        />

        {/* Save button */}
        <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleSave}
            disabled={updateProfile.isPending}
            className="btn-dark btn-primary btn-lg"
            style={{ minWidth: 200 }}
          >
            {updateProfile.isPending ? '保存中...' : '保存'}
          </button>
        </div>

        {/* Hidden file input for avatar selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />

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
