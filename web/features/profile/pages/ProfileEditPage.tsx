import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useCurrentUser } from '../../../shared/hooks/useCurrentUser';
import { useUpdateProfile } from '../hooks/useUpdateProfile';

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
    <div>
      {/* TopBar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
        <button aria-label="返回" onClick={handleBack}>
          返回
        </button>
        <span>编辑资料</span>
        <button
          onClick={handleSave}
          disabled={updateProfile.isPending}
        >
          保存
        </button>
      </div>

      {/* Avatar Editor */}
      <div>
        {avatarUrl ? (
          <img src={avatarUrl} alt="头像预览" style={{ width: 64, height: 64, borderRadius: '50%' }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#eee' }} />
        )}
        <div>
          <label>头像链接</label>
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="输入头像 URL"
          />
          {errors.avatarUrl && <div style={{ color: 'red' }}>{errors.avatarUrl}</div>}
        </div>
      </div>

      {/* Profile Form */}
      <div>
        <div>
          <label>昵称</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          {errors.nickname && <div style={{ color: 'red' }}>{errors.nickname}</div>}
        </div>
        <div>
          <label>简介</label>
          <input
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          {errors.bio && <div style={{ color: 'red' }}>{errors.bio}</div>}
        </div>
        <div>
          <span>手机号</span>
          <span>{currentUser.phone}</span>
        </div>
      </div>

      {/* Unsaved changes confirm dialog */}
      {showConfirm && (
        <div role="dialog">
          <p>有未保存的修改，确定离开？</p>
          <button
            onClick={() => {
              setShowConfirm(false);
              navigate(-1);
            }}
          >
            确认
          </button>
          <button onClick={() => setShowConfirm(false)}>取消</button>
        </div>
      )}
    </div>
  );
}
