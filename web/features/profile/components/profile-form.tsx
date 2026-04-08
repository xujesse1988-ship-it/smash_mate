import React from 'react';

interface ProfileFormProps {
  nickname: string;
  onNicknameChange: (value: string) => void;
  bio: string;
  onBioChange: (value: string) => void;
  avatarUrl: string;
  onAvatarUrlChange: (value: string) => void;
  errors: Record<string, string>;
}

export function ProfileForm({
  nickname,
  onNicknameChange,
  bio,
  onBioChange,
  avatarUrl,
  onAvatarUrlChange,
  errors,
}: ProfileFormProps) {
  return (
    <>
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
            onChange={(e) => onAvatarUrlChange(e.target.value)}
            placeholder="输入头像 URL"
          />
          {errors.avatarUrl && <div style={{ color: 'red' }}>{errors.avatarUrl}</div>}
        </div>
      </div>

      {/* Nickname + Bio */}
      <div>
        <div>
          <label>昵称</label>
          <input
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
          />
          {errors.nickname && <div style={{ color: 'red' }}>{errors.nickname}</div>}
        </div>
        <div>
          <label>简介</label>
          <textarea
            value={bio}
            onChange={(e) => onBioChange(e.target.value)}
          />
          {errors.bio && <div style={{ color: 'red' }}>{errors.bio}</div>}
        </div>
      </div>
    </>
  );
}
