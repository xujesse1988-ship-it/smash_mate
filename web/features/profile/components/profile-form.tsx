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
    <div
      style={{
        padding: '24px 20px 28px',
        background: '#fff',
        border: '1px solid #ececec',
        borderRadius: 18,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div style={{ position: 'relative' }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="头像预览"
              style={{
                width: 168,
                height: 168,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #d9d9d9',
                background: '#f3f3f3',
              }}
            />
          ) : (
            <div
              style={{
                width: 168,
                height: 168,
                borderRadius: '50%',
                border: '2px solid #d9d9d9',
                background: '#f3f3f3',
              }}
            />
          )}

          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              width: 42,
              height: 42,
              borderRadius: 12,
              background: '#111',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.16)',
            }}
          >
            +
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        <div
          style={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'start', gap: 16 }}
        >
          <label style={{ fontSize: 16, fontWeight: 500, color: '#111', paddingTop: 10 }}>
            头像
          </label>
          <div>
            <input
              value={avatarUrl}
              onChange={(e) => onAvatarUrlChange(e.target.value)}
              placeholder="输入头像 URL"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: errors.avatarUrl ? '1px solid #ff4d4f' : '1px solid #cfcfcf',
                borderRadius: 0,
                boxSizing: 'border-box',
                fontSize: 16,
              }}
            />
            {errors.avatarUrl && (
              <div style={{ marginTop: 6, color: '#ff4d4f', fontSize: 12 }}>{errors.avatarUrl}</div>
            )}
          </div>
        </div>

        <div
          style={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'start', gap: 16 }}
        >
          <label style={{ fontSize: 16, fontWeight: 500, color: '#111', paddingTop: 10 }}>
            昵称
          </label>
          <input
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: errors.nickname ? '1px solid #ff4d4f' : '1px solid #cfcfcf',
              borderRadius: 0,
              boxSizing: 'border-box',
              fontSize: 16,
            }}
          />
          {errors.nickname && (
            <div style={{ gridColumn: '2 / 3', marginTop: 6, color: '#ff4d4f', fontSize: 12 }}>
              {errors.nickname}
            </div>
          )}
        </div>

        <div
          style={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'start', gap: 16 }}
        >
          <label style={{ fontSize: 16, fontWeight: 500, color: '#111', paddingTop: 10 }}>
            简介
          </label>
          <div>
            <textarea
              value={bio}
              onChange={(e) => onBioChange(e.target.value)}
              placeholder="介绍一下自己"
              rows={6}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: errors.bio ? '1px solid #ff4d4f' : '1px solid #cfcfcf',
                borderRadius: 0,
                boxSizing: 'border-box',
                fontSize: 16,
                lineHeight: 1.5,
                resize: 'vertical',
                minHeight: 160,
              }}
            />
            {errors.bio && (
              <div style={{ marginTop: 6, color: '#ff4d4f', fontSize: 12 }}>{errors.bio}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
