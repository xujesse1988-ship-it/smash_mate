import React from 'react';

interface UserInfoSectionProps {
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  showBio: boolean;
}

export function UserInfoSection({ nickname, avatarUrl, bio, showBio }: UserInfoSectionProps) {
  return (
    <div>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={nickname}
          style={{ width: 64, height: 64, borderRadius: '50%' }}
        />
      ) : (
        <div
          role="img"
          aria-label={nickname}
          style={{ width: 64, height: 64, borderRadius: '50%', background: '#eee' }}
        />
      )}
      <div>{nickname}</div>
      {showBio && bio && <div>{bio}</div>}
    </div>
  );
}
