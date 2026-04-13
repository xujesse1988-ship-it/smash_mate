import React from 'react';

interface UserInfoSectionProps {
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  showBio: boolean;
  phone?: string | null;
}

export function UserInfoSection({
  nickname,
  avatarUrl,
  bio,
  showBio,
  phone,
}: UserInfoSectionProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={nickname}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1px solid var(--surface-2)',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          role="img"
          aria-label={nickname}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--surface-2)',
            border: '1px solid var(--surface-2)',
            flexShrink: 0,
          }}
        />
      )}

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: 'var(--text-1)' }}>
          {nickname}
        </div>
        {phone && <div style={{ marginTop: 6, fontSize: 16, color: 'var(--text-2)' }}>{phone}</div>}
        {showBio && bio && (
          <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>{bio}</div>
        )}
      </div>
    </div>
  );
}
